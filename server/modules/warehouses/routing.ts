import { prisma, type Db } from "../../db";

type Rule = { city?: string; region?: string };

export async function routeWarehouse(
  organizationId: string,
  city: string,
  storeWarehouseId?: string | null,
  client: Db = prisma,
) {
  const warehouses = await client.warehouse.findMany({ where: { organizationId } });
  if (!warehouses.length) return storeWarehouseId ?? null;

  const needle = city.trim().toLowerCase();
  for (const warehouse of warehouses) {
    const rules = (Array.isArray(warehouse.routingRules) ? warehouse.routingRules : []) as Rule[];
    if (rules.some((rule) => rule.city?.toLowerCase() === needle)) {
      return warehouse.id;
    }
  }

  const fallback = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  return storeWarehouseId ?? fallback.id;
}
