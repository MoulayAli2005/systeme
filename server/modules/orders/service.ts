import { prisma } from "../../db";
import { ApiError } from "../../http";
import { writeAudit } from "../../audit";
import { messagingProvider, shippingProvider } from "../../providers/registry";
import { runAutomations } from "../automations/engine";
import { scoreRisk } from "../risk/engine";
import { routeWarehouse } from "../warehouses/routing";
import { reserveForOrder } from "../inventory/service";
import { dispatchOutgoing } from "../webhooks/dispatch";

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
  userId: string;
  id: string;
  status: string;
  note?: string;
  ip?: string;
}) {
  const order = await getOrder(opts.organizationId, opts.id);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: opts.status },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      title: `Status → ${opts.status}`,
      detail: opts.note,
      tone: ["DELIVERED", "CONFIRMED"].includes(opts.status)
        ? "success"
        : ["CANCELLED", "RETURNED"].includes(opts.status)
          ? "danger"
          : "default",
      actorId: opts.userId,
    },
  });
  await writeAudit({
    organizationId: opts.organizationId,
    userId: opts.userId,
    action: "order.status",
    entity: "Order",
    entityId: order.id,
    before: { status: order.status },
    after: { status: opts.status },
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

export async function bulkOrders(opts: {
  organizationId: string;
  userId: string;
  ids: string[];
  action: "status" | "assign" | "tag" | "untag" | "whatsapp" | "sms" | "ship";
  value?: string;
}) {
  const orders = await prisma.order.findMany({
    where: { organizationId: opts.organizationId, id: { in: opts.ids } },
    include: { customer: true },
  });
  for (const order of orders) {
    if (opts.action === "status" && opts.value) {
      await changeStatus({
        organizationId: opts.organizationId,
        userId: opts.userId,
        id: order.id,
        status: opts.value,
      });
    } else if (opts.action === "assign" && opts.value) {
      await prisma.order.update({ where: { id: order.id }, data: { agentId: opts.value } });
    } else if (opts.action === "tag" && opts.value) {
      await prisma.order.update({
        where: { id: order.id },
        data: { tags: { push: opts.value } },
      });
    } else if (opts.action === "whatsapp" || opts.action === "sms") {
      await messagingProvider(opts.action === "sms" ? "sms" : "whatsapp").sendMessage({
        to: order.customer.phone,
        text: opts.value || `Update on ${order.number}`,
      });
    } else if (opts.action === "ship") {
      const ship = await shippingProvider().createShipment({
        orderId: order.id,
        city: order.customer.city,
        address: order.customer.address ?? order.customer.city,
        phone: order.customer.phone,
        codAmount: Number(order.codAmount),
      });
      await prisma.shipment.create({
        data: {
          organizationId: opts.organizationId,
          orderId: order.id,
          awb: ship.awb,
          trackingUrl: ship.trackingUrl,
        },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
    }
  }
  return { updated: orders.length };
}

export async function findDuplicates(organizationId: string, phone: string, hours = 48) {
  const since = new Date(Date.now() - hours * 3600_000);
  return prisma.order.findMany({
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
  userId: string;
  customer: { name: string; phone: string; city: string; address?: string };
  items: Array<{ name: string; variant?: string; quantity: number; price: number; variantId?: string }>;
  storeId?: string;
  source?: string;
  notes?: string;
}) {
  const dupes = await findDuplicates(opts.organizationId, opts.customer.phone);
  let customer = await prisma.customer.findFirst({
    where: { organizationId: opts.organizationId, phone: opts.customer.phone },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        organizationId: opts.organizationId,
        name: opts.customer.name,
        phone: opts.customer.phone,
        city: opts.customer.city,
        address: opts.customer.address,
      },
    });
  }

  const history = await prisma.order.findMany({
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
  await prisma.customer.update({
    where: { id: customer.id },
    data: { riskScore: risk.score, riskLabel: risk.label },
  });

  const store = opts.storeId
    ? await prisma.store.findFirst({ where: { id: opts.storeId, organizationId: opts.organizationId } })
    : await prisma.store.findFirst({ where: { organizationId: opts.organizationId } });
  const warehouseId = await routeWarehouse(opts.organizationId, opts.customer.city, store?.warehouseId);
  const count = await prisma.order.count({ where: { organizationId: opts.organizationId } });
  const number = `NX-${10000 + count + 1}`;
  const subtotal = opts.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tags = [
    ...(dupes.length ? ["potential_duplicate"] : []),
    ...(risk.requireManualVerification ? ["manual_verification"] : []),
  ];
  const order = await prisma.order.create({
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
      await reserveForOrder({
        organizationId: opts.organizationId,
        warehouseId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }
  }
  await runAutomations({
    organizationId: opts.organizationId,
    trigger: "order.created",
    orderId: order.id,
    payload: { total: subtotal },
  });
  await dispatchOutgoing({
    organizationId: opts.organizationId,
    event: "order.created",
    payload: { orderId: order.id, number: order.number, total: subtotal },
  });
  if (risk.requireManualVerification) {
    await prisma.notification.create({
      data: {
        organizationId: opts.organizationId,
        title: "Risky order needs verification",
        body: `${order.number} scored ${risk.score} (${risk.label}).`,
        kind: "risk",
      },
    });
  }
  return { order, duplicates: dupes, risk };
}
