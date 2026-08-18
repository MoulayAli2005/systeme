import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../../db";
import { withRedis } from "../../redis";
import { log } from "../../log";

/**
 * Analytics is computed in SQL. The previous implementation pulled every order
 * of the period into Node and reduced it in JavaScript, which cannot survive a
 * workspace doing thousands of orders a day.
 *
 * Costs come from what the carrier actually charges (the rate grid recorded on
 * each shipment) instead of a hard-coded flat fee, and delivered revenue counts
 * cash actually collected once a remittance has been settled.
 */

const CACHE_TTL_SECONDS = 60;

type Scope = { organizationId: string; from: Date; to: Date; storeId?: string };

function orderScope({ organizationId, from, to, storeId }: Scope) {
  return Prisma.sql`
    o."organizationId" = ${organizationId}
    AND o."deletedAt" IS NULL
    AND o."createdAt" >= ${from}
    AND o."createdAt" <= ${to}
    ${storeId ? Prisma.sql`AND o."storeId" = ${storeId}` : Prisma.empty}
  `;
}

const num = (value: unknown) => Number(value ?? 0);

export async function overview(organizationId: string, from: Date, to: Date, storeId?: string) {
  const cacheKey = `analytics:overview:${organizationId}:${from.getTime()}:${to.getTime()}:${storeId ?? "all"}`;

  const cached = await withRedis(async (client) => client.get(cacheKey), null);
  if (cached) {
    try {
      return { ...(JSON.parse(cached) as Awaited<ReturnType<typeof compute>>), cached: true };
    } catch {
      log.warn("Discarding malformed analytics cache entry", { cacheKey });
    }
  }

  const result = await compute({ organizationId, from, to, storeId });
  await withRedis(
    async (client) => client.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS),
    null,
  );
  return { ...result, cached: false };
}

async function compute(scope: Scope) {
  const where = orderScope(scope);

  const [statusRows, itemRows, cityRows, productRows, dayRows, shippingRows, spend] =
    await Promise.all([
      prisma.$queryRaw<Array<{ status: string; count: bigint; revenue: Prisma.Decimal }>>`
        SELECT o.status, COUNT(*) AS count, COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o
        WHERE ${where}
        GROUP BY o.status
      `,
      prisma.$queryRaw<Array<{ status: string; cost: Prisma.Decimal }>>`
        SELECT o.status, COALESCE(SUM(oi.cost * oi.quantity), 0) AS cost
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE ${where}
        GROUP BY o.status
      `,
      prisma.$queryRaw<
        Array<{ city: string; orders: bigint; revenue: Prisma.Decimal; delivered: bigint; cancelled: bigint }>
      >`
        SELECT c.city,
               COUNT(*) AS orders,
               COALESCE(SUM(o.total), 0) AS revenue,
               COUNT(*) FILTER (WHERE o.status = 'DELIVERED') AS delivered,
               COUNT(*) FILTER (WHERE o.status IN ('CANCELLED', 'RETURNED')) AS cancelled
        FROM "Order" o
        JOIN "Customer" c ON c.id = o."customerId"
        WHERE ${where}
        GROUP BY c.city
        ORDER BY orders DESC
        LIMIT 100
      `,
      prisma.$queryRaw<
        Array<{ name: string; units: bigint; revenue: Prisma.Decimal; cost: Prisma.Decimal; delivered: bigint }>
      >`
        SELECT oi.name,
               SUM(oi.quantity) AS units,
               COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
               COALESCE(SUM(oi.cost * oi.quantity), 0) AS cost,
               COUNT(*) FILTER (WHERE o.status = 'DELIVERED') AS delivered
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE ${where}
        GROUP BY oi.name
        ORDER BY (COALESCE(SUM(oi.price * oi.quantity), 0) - COALESCE(SUM(oi.cost * oi.quantity), 0)) DESC
        LIMIT 50
      `,
      prisma.$queryRaw<
        Array<{ date: Date; orders: bigint; delivered: bigint; revenue: Prisma.Decimal }>
      >`
        SELECT date_trunc('day', o."createdAt")::date AS date,
               COUNT(*) AS orders,
               COUNT(*) FILTER (WHERE o.status = 'DELIVERED') AS delivered,
               COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o
        WHERE ${where}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<
        Array<{
          delivery: Prisma.Decimal;
          codfee: Prisma.Decimal;
          returnfee: Prisma.Decimal;
          collected: Prisma.Decimal;
          settled: bigint;
        }>
      >`
        SELECT COALESCE(SUM(s."shippingCost"), 0) AS delivery,
               COALESCE(SUM(s."codFee"), 0) AS codfee,
               COALESCE(SUM(s."returnFee") FILTER (WHERE s.status IN ('returned', 'refused')), 0) AS returnfee,
               COALESCE(SUM(s."codCollected"), 0) AS collected,
               COUNT(*) FILTER (WHERE s."settledAt" IS NOT NULL) AS settled
        FROM "Shipment" s
        JOIN "Order" o ON o.id = s."orderId"
        WHERE ${where}
      `,
      prisma.adSpend.aggregate({
        where: { organizationId: scope.organizationId, date: { gte: scope.from, lte: scope.to } },
        _sum: { spend: true },
      }),
    ]);

  const byStatus = new Map(statusRows.map((r) => [r.status, { count: Number(r.count), revenue: num(r.revenue) }]));
  const statusCount = (status: string) => byStatus.get(status)?.count ?? 0;
  const statusRevenue = (status: string) => byStatus.get(status)?.revenue ?? 0;

  const count = statusRows.reduce((sum, r) => sum + Number(r.count), 0);
  const revenue = statusRows.reduce((sum, r) => sum + num(r.revenue), 0);

  const CONFIRMED_STATES = ["CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const confirmed = CONFIRMED_STATES.reduce((sum, s) => sum + statusCount(s), 0);
  const delivered = statusCount("DELIVERED");
  const cancelled = statusCount("CANCELLED");
  const returned = statusCount("RETURNED");
  const deliveredRevenue = statusRevenue("DELIVERED");

  // Orders still in the funnel cannot be counted as failures yet, so rates use
  // a decided denominator instead of every order in the window.
  const decided = confirmed + cancelled + returned;
  const shipped = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].reduce((s, k) => s + statusCount(k), 0);
  const shippedDecided = delivered + returned;

  const productCost = num(itemRows.find((r) => r.status === "DELIVERED")?.cost);
  const shipping = shippingRows[0];
  const deliveryCost = num(shipping?.delivery);
  const codFees = num(shipping?.codfee);
  const returnCost = num(shipping?.returnfee);
  const collected = num(shipping?.collected);
  const adCost = Number(spend._sum.spend ?? 0);

  const shippingCost = deliveryCost + returnCost;
  const profit = round(deliveredRevenue - productCost - shippingCost - codFees - adCost);
  const pct = (value: number, total: number) => (total ? Math.round((value / total) * 1000) / 10 : 0);

  return {
    count,
    revenue: round(revenue),
    deliveredRevenue: round(deliveredRevenue),
    pendingRevenue: round(revenue - deliveredRevenue),
    /** Cash the carrier has actually remitted for this period. */
    collectedRevenue: round(collected),
    settledShipments: Number(shipping?.settled ?? 0),
    cancelled,
    returned,
    delivered,
    confirmed,
    confirmationRate: pct(confirmed, decided),
    deliveryRate: pct(delivered, shippedDecided),
    cancellationRate: pct(cancelled, decided),
    returnRate: pct(returned, shippedDecided),
    inTransit: shipped - delivered,
    aov: count ? Math.round(revenue / count) : 0,
    productCost: round(productCost),
    shippingCost: round(shippingCost),
    codFees: round(codFees),
    adCost: round(adCost),
    profit,
    margin: deliveredRevenue ? Math.round((profit / deliveredRevenue) * 1000) / 10 : 0,
    cities: cityRows.map((row) => ({
      city: row.city,
      orders: Number(row.orders),
      revenue: round(num(row.revenue)),
      delivered: Number(row.delivered),
      cancelled: Number(row.cancelled),
      deliveryRate: pct(Number(row.delivered), Number(row.delivered) + Number(row.cancelled)),
    })),
    products: productRows.map((row) => ({
      name: row.name,
      orders: Number(row.units),
      delivered: Number(row.delivered),
      revenue: round(num(row.revenue)),
      cost: round(num(row.cost)),
      profit: round(num(row.revenue) - num(row.cost)),
      margin: num(row.revenue)
        ? Math.round(((num(row.revenue) - num(row.cost)) / num(row.revenue)) * 1000) / 10
        : 0,
    })),
    byDay: dayRows.map((row) => ({
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
      orders: Number(row.orders),
      delivered: Number(row.delivered),
      revenue: round(num(row.revenue)),
    })),
  };
}

export async function agentLeaderboard(organizationId: string, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<
    Array<{
      agentId: string;
      name: string | null;
      assigned: bigint;
      confirmed: bigint;
      cancelled: bigint;
      delivered: bigint;
      revenue: Prisma.Decimal;
    }>
  >`
    SELECT o."agentId" AS "agentId",
           u.name,
           COUNT(*) AS assigned,
           COUNT(*) FILTER (
             WHERE o.status IN ('CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED')
           ) AS confirmed,
           COUNT(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled,
           COUNT(*) FILTER (WHERE o.status = 'DELIVERED') AS delivered,
           COALESCE(SUM(o.total) FILTER (WHERE o.status = 'DELIVERED'), 0) AS revenue
    FROM "Order" o
    LEFT JOIN "User" u ON u.id = o."agentId"
    WHERE o."organizationId" = ${organizationId}
      AND o."deletedAt" IS NULL
      AND o."agentId" IS NOT NULL
      AND o."createdAt" >= ${from}
      AND o."createdAt" <= ${to}
    GROUP BY o."agentId", u.name
    ORDER BY confirmed DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    agentId: row.agentId,
    name: row.name ?? "Agent",
    assigned: Number(row.assigned),
    confirmed: Number(row.confirmed),
    cancelled: Number(row.cancelled),
    delivered: Number(row.delivered),
    revenue: round(num(row.revenue)),
    confirmationRate: Number(row.assigned)
      ? Math.round((Number(row.confirmed) / Number(row.assigned)) * 1000) / 10
      : 0,
  }));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
