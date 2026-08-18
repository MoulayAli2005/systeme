import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, json, parsePage } from "../http";
import { prisma } from "../db";
import { requirePermission } from "../auth/session";
import { writeAudit } from "../audit";
import { toCsv } from "../csv";
import {
  importStatement,
  outstandingCod,
  parseStatementCsv,
  settleRemittance,
} from "../modules/reconciliation/service";
import { overdueSettlements, quoteShipment, syncShipment } from "../modules/shipping/service";

const statementSchema = z.object({
  reference: z.string().min(2),
  carrierId: z.string().optional(),
  declaredTotal: z.number().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  csv: z.string().optional(),
  lines: z
    .array(
      z.object({
        awb: z.string().min(1),
        amount: z.number(),
        fee: z.number().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
});

/** COD money: carrier statements, payouts and what is still owed. */
export async function handleFinance(
  req: NextRequest,
  method: string,
  path: string,
  url: URL,
  body: unknown,
  ip: string,
): Promise<Response | null> {
  if (path === "reconciliation/summary" && method === "GET") {
    const ctx = await requirePermission("finance.read", req);
    const [summary, overdue] = await Promise.all([
      outstandingCod(ctx.organizationId),
      overdueSettlements(ctx.organizationId),
    ]);
    return json({
      ...summary,
      overdue: { count: overdue.length, amount: overdue.reduce((s, r) => s + r.codAmount, 0) },
    });
  }

  if (path === "reconciliation/overdue" && method === "GET") {
    const ctx = await requirePermission("finance.read", req);
    return json({ rows: await overdueSettlements(ctx.organizationId) });
  }

  if (path === "remittances" && method === "GET") {
    const ctx = await requirePermission("finance.read", req);
    const page = parsePage(url);
    const status = url.searchParams.get("status") ?? undefined;
    const rows = await prisma.remittance.findMany({
      where: { organizationId: ctx.organizationId, ...(status ? { status } : {}) },
      include: { carrier: { select: { name: true } }, _count: { select: { lines: true } } },
      orderBy: { createdAt: "desc" },
      take: page.take + 1,
      ...(page.cursor ? { skip: 1, cursor: { id: page.cursor } } : {}),
    });
    const nextCursor = rows.length > page.take ? rows.pop()!.id : null;
    return json({ rows, nextCursor });
  }

  if (path === "remittances" && method === "POST") {
    const ctx = await requirePermission("finance.write", req);
    const data = statementSchema.parse(body);

    const parsed = data.csv ? parseStatementCsv(data.csv) : { lines: [], errors: [] };
    const lines = data.csv ? parsed.lines : (data.lines ?? []);
    if (!lines.length) {
      throw new ApiError(400, "EMPTY_STATEMENT", "No statement lines could be read.", {
        errors: parsed.errors.slice(0, 20),
      });
    }

    const result = await importStatement({
      organizationId: ctx.organizationId,
      reference: data.reference,
      carrierId: data.carrierId,
      declaredTotal: data.declaredTotal,
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
      lines,
    });

    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "remittance.import",
      entity: "Remittance",
      entityId: result.remittance.id,
      after: result.summary,
      ip,
    });

    return json({ ...result, parseErrors: parsed.errors.slice(0, 20) }, 201);
  }

  if (path.match(/^remittances\/[^/]+$/) && method === "GET") {
    const ctx = await requirePermission("finance.read", req);
    const id = path.split("/")[1];
    const remittance = await prisma.remittance.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        carrier: { select: { name: true } },
        lines: { orderBy: { status: "asc" }, take: 1000 },
      },
    });
    if (!remittance) throw new ApiError(404, "NOT_FOUND", "Remittance not found.");
    return json(remittance);
  }

  if (path.match(/^remittances\/[^/]+\/settle$/) && method === "POST") {
    const ctx = await requirePermission("finance.write", req);
    const id = path.split("/")[1];
    const result = await settleRemittance({
      organizationId: ctx.organizationId,
      remittanceId: id,
      userId: ctx.userId,
    });
    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "remittance.settle",
      entity: "Remittance",
      entityId: id,
      after: { settledAt: result.settledAt ?? null },
      ip,
    });
    return json(result);
  }

  if (path.match(/^remittances\/[^/]+\/export$/) && method === "GET") {
    const ctx = await requirePermission("finance.read", req);
    const id = path.split("/")[1];
    const remittance = await prisma.remittance.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { lines: true },
    });
    if (!remittance) throw new ApiError(404, "NOT_FOUND", "Remittance not found.");

    const csv = toCsv([
      ["awb", "status", "declared", "expected", "fee", "variance", "note"],
      ...remittance.lines.map((l) => [
        l.awb,
        l.status,
        Number(l.declaredAmount),
        Number(l.expectedAmount),
        Number(l.feeAmount),
        Number(l.variance),
        l.note ?? "",
      ]),
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=remittance-${remittance.reference}.csv`,
      },
    });
  }

  if (path === "carrier-rates" && method === "GET") {
    const ctx = await requirePermission("shipping.read", req);
    const rows = await prisma.carrierRate.findMany({
      where: { organizationId: ctx.organizationId },
      include: { carrier: { select: { name: true } } },
      orderBy: [{ carrierId: "asc" }, { city: "asc" }],
    });
    return json({ rows });
  }

  if (path === "carrier-rates" && method === "POST") {
    const ctx = await requirePermission("shipping.dispatch", req);
    const data = z
      .object({
        carrierId: z.string(),
        /** Empty means the carrier's default rate. */
        city: z.string().default(""),
        deliveryFee: z.number().nonnegative(),
        returnFee: z.number().nonnegative().default(0),
        codFeePercent: z.number().min(0).max(100).default(0),
      })
      .parse(body);

    const carrier = await prisma.carrier.findFirst({
      where: { id: data.carrierId, organizationId: ctx.organizationId },
    });
    if (!carrier) throw new ApiError(404, "NOT_FOUND", "Carrier not found.");

    const row = await prisma.carrierRate.upsert({
      where: { carrierId_city: { carrierId: data.carrierId, city: data.city } },
      update: {
        deliveryFee: data.deliveryFee,
        returnFee: data.returnFee,
        codFeePercent: data.codFeePercent,
      },
      create: {
        organizationId: ctx.organizationId,
        carrierId: data.carrierId,
        city: data.city,
        deliveryFee: data.deliveryFee,
        returnFee: data.returnFee,
        codFeePercent: data.codFeePercent,
      },
    });
    return json(row, 201);
  }

  if (path === "shipping/quote" && method === "GET") {
    const ctx = await requirePermission("shipping.read", req);
    const carrierId = url.searchParams.get("carrierId");
    const city = url.searchParams.get("city") ?? "";
    const codAmount = Number(url.searchParams.get("codAmount") ?? 0);
    return json(
      await quoteShipment({ organizationId: ctx.organizationId, carrierId, city, codAmount }),
    );
  }

  if (path.match(/^shipments\/[^/]+\/sync$/) && method === "POST") {
    const ctx = await requirePermission("shipping.read", req);
    const id = path.split("/")[1];
    const shipment = await prisma.shipment.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!shipment) throw new ApiError(404, "NOT_FOUND", "Shipment not found.");
    return json(await syncShipment(shipment.id));
  }

  return null;
}
