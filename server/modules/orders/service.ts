import { prisma, type Db } from "../../db";
import { ApiError } from "../../http";
import { writeAudit } from "../../audit";
import { runAutomations } from "../automations/engine";
import { scoreRisk } from "../risk/engine";
import { routeWarehouse } from "../warehouses/routing";
import { releaseForOrder, reserveForOrder } from "../inventory/service";
import { dispatchOutgoing } from "../webhooks/dispatch";
import { nextOrderNumber, orderPrefixOf } from "./numbering";
import { assertTransition, checkTransition, loadGraph } from "./status";

export async function listOrders(organizationId: string, params: {
  take: number;
  cursor?: string | null;
  q?: string;
  status?: string;
  city?: string;
  storeId?: string;
  agentId?: string;
  source?: string;
}) {
  const where = {
    organizationId,
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(params.storeId ? { storeId: params.storeId } : {}),
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.city ? { customer: { city: params.city } } : {}),
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q, mode: "insensitive" as const } },
            { customer: { name: { contains: params.q, mode: "insensitive" as const } } },
            { customer: { phone: { contains: params.q } } },
            { shipments: { some: { awb: { contains: params.q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const rows = await prisma.order.findMany({
    where,
    take: params.take + 1,
    ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      items: true,
      store: true,
      agent: { select: { id: true, name: true } },
      shipments: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  const nextCursor = rows.length > params.take ? rows.pop()!.id : null;
  return { rows, nextCursor };
}

export async function getOrder(organizationId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      customer: true,
      items: true,
      events: { orderBy: { createdAt: "desc" } },
      store: true,
      warehouse: true,
      agent: { select: { id: true, name: true, email: true } },
      shipments: { include: { carrier: true } },
      returns: true,
      conversations: { include: { messages: { take: 20, orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");
  return order;
}

export async function changeStatus(opts: {
  organizationId: string;
  userId?: string;
  id: string;
  status: string;
  note?: string;
  ip?: string;
  /** Set by operators allowed to repair a wrong state; recorded in the audit log. */
  force?: boolean;
  /** Where the change came from, e.g. `carrier-sync`. */
  source?: string;
}) {
  const order = await prisma.order.findFirst({
    where: { id: opts.id, organizationId: opts.organizationId, deletedAt: null },
    select: { id: true, number: true, status: true, warehouseId: true },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");

  const check = await assertTransition(opts.organizationId, order.status, opts.status, opts.force);
  if ("noop" in check && check.noop) {
    return prisma.order.findFirstOrThrow({ where: { id: order.id } });
  }
  const overridden = opts.force === true && !(await isAllowed(opts.organizationId, order.status, opts.status));

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id: order.id },
      data: { status: opts.status },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        title: `Status → ${opts.status}`,
        detail: overridden ? `${opts.note ? `${opts.note} · ` : ""}forced override` : opts.note,
        tone: ["DELIVERED", "CONFIRMED"].includes(opts.status)
          ? "success"
          : ["CANCELLED", "RETURNED"].includes(opts.status)
            ? "danger"
            : "default",
        actorId: opts.userId,
      },
    });
    // A cancelled order never ships, so its stock reservation must come back.
    if (opts.status === "CANCELLED") {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id, variantId: { not: null } },
        select: { variantId: true, quantity: true },
      });
      for (const item of items) {
        await releaseForOrder(
          {
            organizationId: opts.organizationId,
            warehouseId: order.warehouseId,
            variantId: item.variantId!,
            quantity: item.quantity,
          },
          tx,
        );
      }
    }
    return row;
  });

  await writeAudit({
    organizationId: opts.organizationId,
    userId: opts.userId,
    action: overridden ? "order.status.override" : "order.status",
    entity: "Order",
    entityId: order.id,
    before: { status: order.status },
    after: { status: opts.status, source: opts.source ?? "app" },
    ip: opts.ip,
  });
  await runAutomations({
    organizationId: opts.organizationId,
    trigger: "order.status",
    orderId: order.id,
    payload: { status: opts.status, previous: order.status },
  });
  await dispatchOutgoing({
    organizationId: opts.organizationId,
    event: `order.${opts.status.toLowerCase()}`,
    payload: { orderId: order.id, number: order.number, status: opts.status },
  });
  return updated;
}

async function isAllowed(organizationId: string, from: string, to: string) {
  const graph = await loadGraph(organizationId);
  return checkTransition(from, to, graph).ok;
}

export async function findDuplicates(
  organizationId: string,
  phone: string,
  hours = 48,
  client: Db = prisma,
) {
  const since = new Date(Date.now() - hours * 3600_000);
  return client.order.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
      customer: { phone },
    },
    include: { customer: true, items: true },
    take: 10,
  });
}

export async function createOrder(opts: {
  organizationId: string;
  userId?: string;
  customer: { name: string; phone: string; city: string; address?: string };
  items: Array<{ name: string; variant?: string; quantity: number; price: number; variantId?: string }>;
  storeId?: string;
  source?: string;
  notes?: string;
}) {
  // Everything that must agree — customer, risk, number, items, reservations —
  // is written in one transaction. Provider calls and automations run only
  // after it commits, so a failure can never leave a half-created order or
  // fire a WhatsApp message for an order that does not exist.
  const { order, dupes, risk } = await prisma.$transaction(async (tx) => {
    const dupes = await findDuplicates(opts.organizationId, opts.customer.phone, 48, tx);
    let customer = await tx.customer.findFirst({
      where: { organizationId: opts.organizationId, phone: opts.customer.phone },
    });
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          organizationId: opts.organizationId,
          name: opts.customer.name,
          phone: opts.customer.phone,
          city: opts.customer.city,
          address: opts.customer.address,
        },
      });
    }

    const history = await tx.order.findMany({
      where: { organizationId: opts.organizationId, customerId: customer.id, deletedAt: null },
      select: { status: true, createdAt: true },
    });
    const dayAgo = Date.now() - 864e5;
    const risk = scoreRisk({
      totalOrders: history.length,
      cancelled: history.filter((o) => o.status === "CANCELLED").length,
      returned: history.filter((o) => o.status === "RETURNED").length,
      refused: history.filter((o) => o.status === "RETURNED").length,
      uniquePhones: 1,
      uniqueAddresses: customer.address ? 1 : 0,
      velocity24h: history.filter((o) => o.createdAt.getTime() >= dayAgo).length + 1,
    });
    await tx.customer.update({
      where: { id: customer.id },
      data: { riskScore: risk.score, riskLabel: risk.label },
    });

    const store = opts.storeId
      ? await tx.store.findFirst({ where: { id: opts.storeId, organizationId: opts.organizationId } })
      : await tx.store.findFirst({ where: { organizationId: opts.organizationId } });
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: opts.organizationId },
      select: { settings: true },
    });
    const warehouseId = await routeWarehouse(
      opts.organizationId,
      opts.customer.city,
      store?.warehouseId,
      tx,
    );
    const number = await nextOrderNumber(
      opts.organizationId,
      orderPrefixOf(organization.settings),
      tx,
    );
    const subtotal = opts.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tags = [
      ...(dupes.length ? ["potential_duplicate"] : []),
      ...(risk.requireManualVerification ? ["manual_verification"] : []),
    ];
    const order = await tx.order.create({
      data: {
        organizationId: opts.organizationId,
        storeId: store?.id,
        warehouseId,
        customerId: customer.id,
        number,
        status: "TO_CONFIRM",
        source: opts.source ?? "manual",
        subtotal,
        total: subtotal,
        codAmount: subtotal,
        notes: opts.notes,
        tags,
        duplicateOfId: dupes[0]?.id,
        riskScore: risk.score,
        items: {
          create: opts.items.map((i) => ({
            name: i.name,
            variant: i.variant,
            quantity: i.quantity,
            price: i.price,
            variantId: i.variantId,
          })),
        },
        events: {
          create: { title: "Order created", tone: "default", actorId: opts.userId },
        },
      },
      include: { customer: true, items: true },
    });
    for (const item of opts.items) {
      if (item.variantId) {
        await reserveForOrder(
          {
            organizationId: opts.organizationId,
            warehouseId,
            variantId: item.variantId,
            quantity: item.quantity,
          },
          tx,
        );
      }
    }
    if (risk.requireManualVerification) {
      await tx.notification.create({
        data: {
          organizationId: opts.organizationId,
          title: "Risky order needs verification",
          body: `${order.number} scored ${risk.score} (${risk.label}).`,
          kind: "risk",
        },
      });
    }
    return { order, dupes, risk };
  });

  await runAutomations({
    organizationId: opts.organizationId,
    trigger: "order.created",
    orderId: order.id,
    payload: { total: Number(order.subtotal) },
  });
  await dispatchOutgoing({
    organizationId: opts.organizationId,
    event: "order.created",
    payload: { orderId: order.id, number: order.number, total: Number(order.subtotal) },
  });
  return { order, duplicates: dupes, risk };
}
