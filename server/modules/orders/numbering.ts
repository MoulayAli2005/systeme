import { prisma, type Db } from "../../db";

export const DEFAULT_ORDER_PREFIX = "NX";
const FIRST_NUMBER = 10000;

/**
 * Reserves the next order number for an organization.
 *
 * A single upsert-and-return statement makes the increment atomic, so two
 * simultaneous creates can never be handed the same number. Called inside the
 * order transaction: if the order rolls back the number is released with it.
 */
export async function nextOrderNumber(
  organizationId: string,
  prefix = DEFAULT_ORDER_PREFIX,
  client: Db = prisma,
) {
  const rows = await client.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "OrderCounter" ("organizationId", "value", "updatedAt")
    VALUES (${organizationId}, 1, now())
    ON CONFLICT ("organizationId")
    DO UPDATE SET "value" = "OrderCounter"."value" + 1, "updatedAt" = now()
    RETURNING "value"
  `;
  const value = rows[0]?.value ?? 1;
  return `${prefix}-${FIRST_NUMBER + value}`;
}

/** Organizations can brand their numbers, e.g. `CH-10412`. */
export function orderPrefixOf(settings: unknown) {
  if (settings && typeof settings === "object" && "orderPrefix" in settings) {
    const raw = (settings as { orderPrefix?: unknown }).orderPrefix;
    if (typeof raw === "string") {
      const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (clean) return clean;
    }
  }
  return DEFAULT_ORDER_PREFIX;
}
