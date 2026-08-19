import { z } from "zod";
import { prisma } from "../../db";
import { ApiError } from "../../http";
import { log } from "../../log";
import { enqueue } from "../../jobs/queues";
import { parseAmount, parseCsvRecords, pick } from "../../csv";
import { createOrder } from "../orders/service";

/** Import size ceiling. Beyond this, split the file. */
export const IMPORT_LIMIT = 10_000;

/** Anything larger than this goes to a worker instead of the request. */
export const INLINE_LIMIT = 25;

export const importRowSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(4),
  city: z.string().min(1),
  address: z.string().optional(),
  product: z.string().min(1),
  variant: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  price: z.number().nonnegative(),
  notes: z.string().optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type RowError = { line: number; message: string };

/**
 * Maps a merchant CSV onto import rows. Column names are matched loosely
 * because every storefront and spreadsheet exports slightly different headers.
 */
export function parseOrderCsv(csv: string) {
  const { records } = parseCsvRecords(csv);
  const rows: ImportRow[] = [];
  const errors: RowError[] = [];

  records.forEach((record, index) => {
    const line = index + 2; // 1-based, plus the header row
    const candidate = {
      name: pick(record, "name", "customer", "customer name", "client", "nom"),
      phone: pick(record, "phone", "telephone", "tel", "mobile", "gsm", "phone number"),
      city: pick(record, "city", "ville", "town"),
      address: pick(record, "address", "adresse", "street"),
      product: pick(record, "product", "produit", "item", "article", "sku"),
      variant: pick(record, "variant", "variante", "option", "size", "taille"),
      quantity: Number(pick(record, "quantity", "qty", "quantite", "qte") ?? 1),
      price: parseAmount(pick(record, "price", "prix", "amount", "total", "montant")) ?? NaN,
      notes: pick(record, "notes", "note", "remarque", "comment"),
    };

    const parsed = importRowSchema.safeParse(candidate);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      errors.push({
        line,
        message: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; "),
      });
    }
  });

  return { rows, errors };
}

export async function startOrderImport(opts: {
  organizationId: string;
  userId: string;
  csv?: string;
  rows?: unknown[];
}) {
  const parsed = opts.csv
    ? parseOrderCsv(opts.csv)
    : {
        rows: [] as ImportRow[],
        errors: [] as RowError[],
      };

  if (!opts.csv && opts.rows) {
    opts.rows.forEach((raw, index) => {
      const result = importRowSchema.safeParse(raw);
      if (result.success) parsed.rows.push(result.data);
      else
        parsed.errors.push({
          line: index + 1,
          message: result.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; "),
        });
    });
  }

  if (!parsed.rows.length) {
    throw new ApiError(400, "EMPTY_IMPORT", "No importable rows were found.", {
      errors: parsed.errors.slice(0, 20),
    });
  }
  if (parsed.rows.length > IMPORT_LIMIT) {
    throw new ApiError(
      400,
      "IMPORT_TOO_LARGE",
      `This import has ${parsed.rows.length} rows; the limit is ${IMPORT_LIMIT}. Split the file.`,
    );
  }

  const job = await prisma.jobRun.create({
    data: {
      organizationId: opts.organizationId,
      kind: "orders.import",
      total: parsed.rows.length,
      createdById: opts.userId,
      // The rows live on the job row, so an import survives a Redis restart
      // and can be retried without re-uploading the file.
      result: { rows: parsed.rows, parseErrors: parsed.errors.slice(0, 200) },
    },
  });

  if (parsed.rows.length <= INLINE_LIMIT) {
    const result = await runOrderImport(job.id);
    return { mode: "inline" as const, jobRunId: job.id, parseErrors: parsed.errors, ...result };
  }

  const queued = await enqueue("imports", { jobRunId: job.id }, `import:${job.id}`);
  if (!queued.queued) {
    const result = await runOrderImport(job.id);
    return { mode: "inline" as const, jobRunId: job.id, parseErrors: parsed.errors, ...result };
  }
  return {
    mode: "queued" as const,
    jobRunId: job.id,
    total: parsed.rows.length,
    parseErrors: parsed.errors.slice(0, 20),
  };
}

export async function runOrderImport(jobRunId: string) {
  const job = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
  if (!job) throw new ApiError(404, "NOT_FOUND", "Import job not found.");

  const payload = (job.result ?? {}) as { rows?: ImportRow[] };
  const rows = payload.rows ?? [];

  await prisma.jobRun.update({
    where: { id: job.id },
    data: { status: "running", startedAt: new Date(), total: rows.length },
  });

  let processed = 0;
  let failed = 0;
  const errors: RowError[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      await createOrder({
        organizationId: job.organizationId,
        userId: job.createdById ?? undefined,
        customer: { name: row.name, phone: row.phone, city: row.city, address: row.address },
        items: [{ name: row.product, variant: row.variant, quantity: row.quantity, price: row.price }],
        notes: row.notes,
        source: "import",
      });
      processed += 1;
    } catch (err) {
      failed += 1;
      errors.push({ line: index + 1, message: err instanceof Error ? err.message : "Unknown error" });
      log.warn("Import row failed", { jobRunId: job.id, line: index + 1, error: (err as Error).message });
    }

    if ((processed + failed) % 25 === 0) {
      await prisma.jobRun.update({ where: { id: job.id }, data: { processed, failed } });
    }
  }

  await prisma.jobRun.update({
    where: { id: job.id },
    data: {
      status: failed && !processed ? "failed" : "completed",
      processed,
      failed,
      finishedAt: new Date(),
      errors: errors.slice(0, 100),
      result: { created: processed, failed },
    },
  });

  return { created: processed, failed, errors: errors.slice(0, 20) };
}
