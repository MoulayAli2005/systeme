import { prisma } from "../../db";

export async function overview(organizationId: string, from: Date, to: Date, storeId?: string) {
  const where = {
    organizationId,
    deletedAt: null,
    createdAt: { gte: from, lte: to },
    ...(storeId ? { storeId } : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    select: {
      status: true,
      total: true,
      paymentMethod: true,
      source: true,
      createdAt: true,
      customer: { select: { city: true } },
      items: { select: { name: true, quantity: true, price: true, cost: true } },
    },
  });
  const count = orders.length;
  const byStatus = (s: string) => orders.filter((o) => o.status === s);
  const delivered = byStatus("DELIVERED");
  const cancelled = byStatus("CANCELLED");
  const returned = [...byStatus("RETURNED")];
  const confirmed = orders.filter((o) =>
    ["CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status),
  );
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const deliveredRevenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const productCost = delivered.reduce(
    (s, o) => s + o.items.reduce((x, i) => x + Number(i.cost) * i.quantity, 0),
    0,
  );
  const spend = await prisma.adSpend.aggregate({
    where: { organizationId, date: { gte: from, lte: to } },
    _sum: { spend: true },
  });
  const adCost = Number(spend._sum.spend ?? 0);
  const shippingCost = delivered.length * 25;
  const profit = deliveredRevenue - productCost - shippingCost - adCost;
  const pct = (n: number) => (count ? Math.round((n / count) * 1000) / 10 : 0);

  const cities: Record<string, { orders: number; revenue: number; delivered: number }> = {};
  for (const o of orders) {
    const c = o.customer.city;
    cities[c] ??= { orders: 0, revenue: 0, delivered: 0 };
    cities[c].orders += 1;
    cities[c].revenue += Number(o.total);
    if (o.status === "DELIVERED") cities[c].delivered += 1;
  }

  const products: Record<string, { orders: number; revenue: number; cost: number }> = {};
  for (const o of orders) {
    for (const i of o.items) {
      products[i.name] ??= { orders: 0, revenue: 0, cost: 0 };
      products[i.name].orders += i.quantity;
      products[i.name].revenue += Number(i.price) * i.quantity;
      products[i.name].cost += Number(i.cost) * i.quantity;
    }
  }

  const byDay: Record<string, number> = {};
  for (const o of orders) {
    const d = o.createdAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + 1;
  }

  return {
    count,
    revenue,
    deliveredRevenue,
    pendingRevenue: revenue - deliveredRevenue,
    cancelled: cancelled.length,
    returned: returned.length,
    delivered: delivered.length,
    confirmed: confirmed.length,
    confirmationRate: pct(confirmed.length),
    deliveryRate: pct(delivered.length),
    cancellationRate: pct(cancelled.length),
    returnRate: pct(returned.length),
    aov: count ? Math.round(revenue / count) : 0,
    productCost,
    shippingCost,
    adCost,
    profit,
    margin: deliveredRevenue ? Math.round((profit / deliveredRevenue) * 1000) / 10 : 0,
    cities: Object.entries(cities)
      .map(([city, v]) => ({
        city,
        ...v,
        deliveryRate: v.orders ? Math.round((v.delivered / v.orders) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.orders - a.orders),
    products: Object.entries(products)
      .map(([name, v]) => ({
        name,
        ...v,
        profit: v.revenue - v.cost,
        margin: v.revenue ? Math.round(((v.revenue - v.cost) / v.revenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.profit - a.profit),
    byDay: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders })),
  };
}

export async function agentLeaderboard(organizationId: string, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { organizationId, deletedAt: null, createdAt: { gte: from, lte: to }, agentId: { not: null } },
    select: { agentId: true, status: true, total: true, agent: { select: { name: true } } },
  });
  const map: Record<
    string,
    { name: string; assigned: number; confirmed: number; cancelled: number; delivered: number; revenue: number }
  > = {};
  for (const o of orders) {
    const id = o.agentId!;
    map[id] ??= {
      name: o.agent?.name ?? "Agent",
      assigned: 0,
      confirmed: 0,
      cancelled: 0,
      delivered: 0,
      revenue: 0,
    };
    map[id].assigned += 1;
    if (["CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status)) {
      map[id].confirmed += 1;
    }
    if (o.status === "CANCELLED") map[id].cancelled += 1;
    if (o.status === "DELIVERED") {
      map[id].delivered += 1;
      map[id].revenue += Number(o.total);
    }
  }
  return Object.entries(map)
    .map(([id, v]) => ({
      agentId: id,
      ...v,
      confirmationRate: v.assigned ? Math.round((v.confirmed / v.assigned) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.confirmed - a.confirmed);
}
