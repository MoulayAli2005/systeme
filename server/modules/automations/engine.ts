import { prisma } from "../../db";
import { messagingProvider, shippingProvider } from "../../providers/registry";
import { enqueue } from "../../jobs/queues";
import { matchConditions } from "../risk/engine";

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
    include: { customer: true, items: true },
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

async function applyAction(
  action: Record<string, string>,
  order: {
    id: string;
    organizationId: string;
    number: string;
    total: unknown;
    customer: { phone: string; name: string; city: string; address: string | null };
  },
) {
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
    const text = interpolate(action.text || `Update on ${order.number}`, order);
    await messagingProvider(channel).sendMessage({ to: order.customer.phone, text });
    await enqueue(channel, { to: order.customer.phone, text });
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

function interpolate(text: string, order: { number: string; total: unknown; customer: { name: string; city: string } }) {
  return text
    .replaceAll("{{customer_name}}", order.customer.name)
    .replaceAll("{{order_id}}", order.number)
    .replaceAll("{{total}}", String(order.total))
    .replaceAll("{{city}}", order.customer.city);
}
