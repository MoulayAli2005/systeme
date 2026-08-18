import { prisma } from "../../db";
import { messagingProvider, shippingProvider } from "../../providers/registry";
import { matchConditions } from "../risk/engine";
import { interpolateWhatsApp } from "./whatsapp";

export async function runAutomations(input: {
  organizationId: string;
  trigger: string;
  orderId: string;
  payload: Record<string, unknown>;
}) {
  const rules = await prisma.automation.findMany({
    where: { organizationId: input.organizationId, enabled: true, trigger: input.trigger },
  });
  if (!rules.length) return;
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, organizationId: input.organizationId },
    include: { customer: true, items: true, shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return;

  for (const rule of rules) {
    const conditions = (rule.conditions ?? {}) as Record<string, unknown>;
    if (!matchConditions(conditions, order, input.payload)) continue;
    const actions = (Array.isArray(rule.actions) ? rule.actions : []) as Array<Record<string, string>>;
    for (const action of actions) {
      await applyAction(action, order);
    }
    await prisma.automation.update({
      where: { id: rule.id },
      data: { runsToday: { increment: 1 } },
    });
    await prisma.automationRun.create({
      data: {
        automationId: rule.id,
        orderId: order.id,
        status: "ok",
        log: JSON.stringify(actions),
      },
    });
  }
}

type AutomationOrder = {
  id: string;
  customerId: string;
  organizationId: string;
  number: string;
  total: unknown;
  customer: { phone: string; name: string; city: string; address: string | null };
  items: Array<{ name: string }>;
    shipments: Array<{ awb: string | null; trackingUrl: string | null }>;
};

async function applyAction(action: Record<string, string>, order: AutomationOrder) {
  const type = action.type;
  if (type === "change_status" && action.status) {
    await prisma.order.update({ where: { id: order.id }, data: { status: action.status } });
  }
  if (type === "add_tag" && action.tag) {
    await prisma.order.update({ where: { id: order.id }, data: { tags: { push: action.tag } } });
  }
  if (type === "assign_agent" && action.agentId) {
    await prisma.order.update({ where: { id: order.id }, data: { agentId: action.agentId } });
  }
  if (type === "send_whatsapp" || type === "send_sms") {
    const channel = type === "send_sms" ? "sms" : "whatsapp";
    const shipment = order.shipments[0];
    const text = interpolateWhatsApp(action.text || `Update on ${order.number}`, {
      number: order.number,
      total: order.total,
      customer: order.customer,
      product: order.items[0]?.name,
      awb: shipment?.awb ?? undefined,
      trackingUrl: shipment?.trackingUrl ?? undefined,
    });
    const sent = await messagingProvider(channel).sendMessage({ to: order.customer.phone, text });
    if (channel === "whatsapp") {
      await logOutboundWhatsApp(order, text, sent.id, sent.status);
    }
  }
  if (type === "create_shipment") {
    const ship = await shippingProvider().createShipment({
      orderId: order.id,
      city: order.customer.city,
      address: order.customer.address ?? order.customer.city,
      phone: order.customer.phone,
      codAmount: Number(order.total),
    });
    await prisma.shipment.create({
      data: {
        organizationId: order.organizationId,
        orderId: order.id,
        awb: ship.awb,
        trackingUrl: ship.trackingUrl,
      },
    });
  }
}

async function logOutboundWhatsApp(
  order: AutomationOrder,
  text: string,
  providerId: string,
  status: string,
) {
  let conv = await prisma.conversation.findFirst({
    where: { organizationId: order.organizationId, customerId: order.customerId, channel: "whatsapp" },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        organizationId: order.organizationId,
        customerId: order.customerId,
        orderId: order.id,
        channel: "whatsapp",
        lastMessage: text,
        lastAt: new Date(),
      },
    });
  }
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      from: "automation",
      text,
      providerId,
      status,
    },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessage: text, lastAt: new Date(), orderId: order.id },
  });
}
