import { prisma } from "../../db";
import { ApiError } from "../../http";
import { log } from "../../log";
import { parseAmount, parseCsvRecords, pick } from "../../csv";

/**
 * COD reconciliation.
 *
 * A carrier delivers an order, collects cash from the customer, keeps its fees
 * and later transfers the rest in a batch. Until that batch is matched back to
 * individual shipments, the merchant does not know what has actually been paid.
 * This module turns a carrier statement into matched lines and a variance
 * figure per order.
 */

export type StatementLine = {
  awb: string;
  amount: number;
  fee?: number;
  date?: Date;
  note?: string;
};

export type ParsedStatement = {
  lines: StatementLine[];
  errors: Array<{ line: number; message: string }>;
};

export function parseStatementCsv(csv: string): ParsedStatement {
  const { records } = parseCsvRecords(csv);
  const lines: StatementLine[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  records.forEach((record, index) => {
    const lineNumber = index + 2;
    const awb = pick(record, "awb", "tracking", "trackingnumber", "colis", "bl", "barcode", "reference");
    const amount = parseAmount(
      pick(record, "amount", "codamount", "collected", "montant", "encaisse", "cash", "total"),
    );
    const fee = parseAmount(pick(record, "fee", "fees", "frais", "commission", "charges"));
    const rawDate = pick(record, "date", "deliverydate", "datelivraison", "paiddate");

    if (!awb) {
      errors.push({ line: lineNumber, message: "Missing AWB / tracking column." });
      return;
    }
    if (amount === null) {
      errors.push({ line: lineNumber, message: `No readable amount for AWB ${awb}.` });
      return;
    }

    const parsedDate = rawDate ? new Date(rawDate) : undefined;
    lines.push({
      awb: awb.trim(),
      amount,
      fee: fee ?? undefined,
      date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
      note: pick(record, "note", "remarque", "status", "statut"),
    });
  });

  return { lines, errors };
}

const ROUNDING_TOLERANCE = 0.01;

export type ImportStatementInput = {
  organizationId: string;
  reference: string;
  carrierId?: string | null;
  declaredTotal?: number;
  periodStart?: Date;
  periodEnd?: Date;
  lines: StatementLine[];
};

/**
 * Creates a remittance and matches every statement line to a shipment by AWB.
 *
 * Lines are classified as:
 *  - `matched`    the carrier paid exactly what the order was worth
 *  - `variance`   paid, but short or over (partial payment, wrong change, fraud)
 *  - `unmatched`  no shipment with that AWB in this workspace
 *  - `duplicate`  the AWB was already settled by an earlier remittance
 */
export async function importStatement(input: ImportStatementInput) {
  if (!input.lines.length) {
    throw new ApiError(400, "EMPTY_STATEMENT", "The statement has no usable lines.");
  }

  const existing = await prisma.remittance.findUnique({
    where: { organizationId_reference: { organizationId: input.organizationId, reference: input.reference } },
  });
  if (existing) {
    throw new ApiError(
      409,
      "REMITTANCE_EXISTS",
      `Statement "${input.reference}" was already imported on ${existing.createdAt.toISOString().slice(0, 10)}.`,
    );
  }

  const awbs = [...new Set(input.lines.map((l) => l.awb))];
  const shipments = await prisma.shipment.findMany({
    where: { organizationId: input.organizationId, awb: { in: awbs } },
    select: {
      id: true,
      awb: true,
      orderId: true,
      codAmount: true,
      codFee: true,
      settledAt: true,
      order: { select: { number: true } },
    },
  });
  const byAwb = new Map(shipments.map((s) => [s.awb!, s]));

  const seen = new Set<string>();
  const rows = input.lines.map((line) => {
    const shipment = byAwb.get(line.awb);
    const declared = round(line.amount);
    const fee = round(line.fee ?? (shipment ? Number(shipment.codFee) : 0));

    if (!shipment) {
      return {
        organizationId: input.organizationId,
        awb: line.awb,
        status: "unmatched" as const,
        declaredAmount: declared,
        expectedAmount: 0,
        feeAmount: fee,
        variance: 0,
        note: line.note ?? "No shipment with this AWB in this workspace.",
      };
    }

    const expected = round(Number(shipment.codAmount));
    const variance = round(declared + fee - expected);
    const duplicate = seen.has(line.awb) || shipment.settledAt !== null;
    seen.add(line.awb);

    return {
      organizationId: input.organizationId,
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      awb: line.awb,
      status: duplicate
        ? ("duplicate" as const)
        : Math.abs(variance) <= ROUNDING_TOLERANCE
          ? ("matched" as const)
          : ("variance" as const),
      declaredAmount: declared,
      expectedAmount: expected,
      feeAmount: fee,
      variance,
      note: duplicate ? `Already settled for order ${shipment.order.number}.` : line.note,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.declared += row.declaredAmount;
      acc.fees += row.feeAmount;
      if (row.status === "matched" || row.status === "variance") {
        acc.matched += row.declaredAmount;
        acc.expected += row.expectedAmount;
        acc.variance += row.variance;
      }
      return acc;
    },
    { declared: 0, matched: 0, expected: 0, fees: 0, variance: 0 },
  );

  const remittance = await prisma.$transaction(async (tx) => {
    const created = await tx.remittance.create({
      data: {
        organizationId: input.organizationId,
        carrierId: input.carrierId ?? null,
        reference: input.reference,
        status: "matched",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        declaredTotal: round(input.declaredTotal ?? totals.declared),
        matchedTotal: round(totals.matched),
        expectedTotal: round(totals.expected),
        feeTotal: round(totals.fees),
        varianceTotal: round(totals.variance),
      },
    });

    // De-duplicate within the file itself: the unique index on
    // (remittanceId, awb) would otherwise abort the whole import.
    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!unique.has(row.awb)) unique.set(row.awb, row);
    }

    await tx.remittanceLine.createMany({
      data: [...unique.values()].map((row) => ({ ...row, remittanceId: created.id })),
    });
    return created;
  });

  log.info("Remittance imported", {
    organizationId: input.organizationId,
    reference: input.reference,
    lines: rows.length,
    variance: totals.variance,
  });

  return {
    remittance,
    summary: {
      lines: rows.length,
      matched: rows.filter((r) => r.status === "matched").length,
      variance: rows.filter((r) => r.status === "variance").length,
      unmatched: rows.filter((r) => r.status === "unmatched").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      declaredTotal: round(totals.declared),
      expectedTotal: round(totals.expected),
      varianceTotal: round(totals.variance),
      feeTotal: round(totals.fees),
    },
  };
}

/**
 * Marks a remittance as settled: the money landed in the bank. Every matched
 * shipment records the cash actually collected, which is what profit reporting
 * reads instead of assuming every delivered order was paid in full.
 */
export async function settleRemittance(opts: {
  organizationId: string;
  remittanceId: string;
  userId?: string;
}) {
  const remittance = await prisma.remittance.findFirst({
    where: { id: opts.remittanceId, organizationId: opts.organizationId },
    include: { lines: true },
  });
  if (!remittance) throw new ApiError(404, "NOT_FOUND", "Remittance not found.");
  if (remittance.settledAt) return { alreadySettled: true, remittance };

  const settledAt = new Date();
  await prisma.$transaction(async (tx) => {
    for (const line of remittance.lines) {
      if (!line.shipmentId || line.status === "unmatched" || line.status === "duplicate") continue;
      await tx.shipment.update({
        where: { id: line.shipmentId },
        data: {
          codCollected: line.declaredAmount,
          codFee: line.feeAmount,
          settledAt,
        },
      });
    }
    await tx.remittance.update({
      where: { id: remittance.id },
      data: { status: "settled", settledAt },
    });
  });

  return { alreadySettled: false, settledAt, lines: remittance.lines.length };
}

/** Cash that customers paid but which the carrier has not transferred yet. */
export async function outstandingCod(organizationId: string) {
  const [pending, settled] = await Promise.all([
    prisma.shipment.aggregate({
      where: { organizationId, status: "delivered", settledAt: null },
      _sum: { codAmount: true },
      _count: true,
    }),
    prisma.shipment.aggregate({
      where: { organizationId, settledAt: { not: null } },
      _sum: { codCollected: true, codFee: true },
      _count: true,
    }),
  ]);

  const variance = await prisma.remittanceLine.aggregate({
    where: { organizationId, status: "variance" },
    _sum: { variance: true },
    _count: true,
  });

  return {
    awaitingSettlement: {
      shipments: pending._count,
      amount: Number(pending._sum.codAmount ?? 0),
    },
    settled: {
      shipments: settled._count,
      collected: Number(settled._sum.codCollected ?? 0),
      fees: Number(settled._sum.codFee ?? 0),
    },
    disputed: {
      lines: variance._count,
      amount: round(Number(variance._sum.variance ?? 0)),
    },
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
