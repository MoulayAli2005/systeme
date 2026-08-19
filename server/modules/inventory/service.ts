import { prisma, type Db } from "../../db";
import { ApiError } from "../../http";

export async function listInventory(organizationId: string, take = 200) {
  return prisma.inventoryItem.findMany({
    where: { organizationId },
    include: { variant: { include: { product: true } }, warehouse: true },
    take,
    orderBy: { onHand: "asc" },
  });
}

export async function adjustStock(opts: {
  organizationId: string;
  itemId: string;
  quantity: number;
  type: "adjust" | "receive" | "damage" | "return" | "reserve" | "release";
  reason?: string;
}) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: opts.itemId, organizationId: opts.organizationId },
  });
  if (!item) throw new ApiError(404, "NOT_FOUND", "Inventory item not found.");

  const data =
    opts.type === "receive"
      ? { onHand: { increment: opts.quantity }, incoming: { decrement: Math.min(item.incoming, opts.quantity) } }
      : opts.type === "damage"
        ? { damaged: { increment: opts.quantity }, onHand: { decrement: opts.quantity } }
        : opts.type === "return"
          ? { returned: { increment: opts.quantity }, onHand: { increment: opts.quantity } }
          : opts.type === "reserve"
            ? { reserved: { increment: opts.quantity } }
            : opts.type === "release"
              ? { reserved: { decrement: Math.min(item.reserved, opts.quantity) } }
              : { onHand: { increment: opts.quantity } };

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data,
  });
  await prisma.inventoryMovement.create({
    data: {
      itemId: item.id,
      type: opts.type,
      quantity: opts.quantity,
      reason: opts.reason,
    },
  });
  return updated;
}

export async function reserveForOrder(
  opts: {
    organizationId: string;
    warehouseId: string | null;
    variantId: string;
    quantity: number;
  },
  client: Db = prisma,
) {
  if (!opts.warehouseId) return;
  const item = await client.inventoryItem.findFirst({
    where: {
      organizationId: opts.organizationId,
      warehouseId: opts.warehouseId,
      variantId: opts.variantId,
    },
  });
  if (!item) return;
  await client.inventoryItem.update({
    where: { id: item.id },
    data: { reserved: { increment: opts.quantity } },
  });
  await client.inventoryMovement.create({
    data: {
      itemId: item.id,
      type: "reserve",
      quantity: opts.quantity,
      reason: "order_created",
    },
  });
}

/** Releases a reservation when an order is cancelled before dispatch. */
export async function releaseForOrder(
  opts: {
    organizationId: string;
    warehouseId: string | null;
    variantId: string;
    quantity: number;
  },
  client: Db = prisma,
) {
  if (!opts.warehouseId) return;
  const item = await client.inventoryItem.findFirst({
    where: {
      organizationId: opts.organizationId,
      warehouseId: opts.warehouseId,
      variantId: opts.variantId,
    },
  });
  if (!item) return;
  await client.inventoryItem.update({
    where: { id: item.id },
    data: { reserved: { decrement: Math.min(item.reserved, opts.quantity) } },
  });
  await client.inventoryMovement.create({
    data: {
      itemId: item.id,
      type: "release",
      quantity: opts.quantity,
      reason: "order_cancelled",
    },
  });
}
