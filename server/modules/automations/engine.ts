import { prisma } from "../../db";
import { messagingProvider, shippingProvider } from "../../providers/registry";
import { enqueue } from "../../jobs/queues";
import { matchConditions } from "../risk/engine";
import { pickAgent, type DispatchStrategy } from "../call-center/dispatch";

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
    if (
      !matchConditions(
        conditions,
        {
          total: order.total,
          paymentMethod: order.paymentMethod,
          status: order.status,
          callAttempts: order.callAttempts,
          city: order.customer.city,
          source: order.source,
          tags: order.tags,
          riskScore: order.riskScore,
        },
        input.payload,
      )
    ) {
      continue;
    }
    const actions = (Array.isArray(rule.actions) ? rule.actions : []) as Array<Record<string, string>>;
    const logs: Array<{ type: string; status: string; detail?: string }> = [];
    let ok = true;
    for (const action of actions) {
      try {
        await applyAction(action, order);
        logs.push({ type: action.type, status: "ok" });
      } catch (err) {
        ok = false;
        logs.push({ type: action.type, status: "error", detail: (err as Error).message });
      }
    }
    await prisma.automation.update({
      where: { id: rule.id },
      data: { runsToday: { increment: 1 } },
    });
    await prisma.automationRun.create({
      data: {
        automationId: rule.id,
        orderId: order.id,
        status: ok ? "ok" : "error",
        log: JSON.stringify(logs),
      },
    });
  }
}

type AutomationOrder = {
  id: string;
  organizationId: string;
  number: string;
  total: unknown;
  customer: { phone: string; name: string; city: string; address: string | null };
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
  if (type === "assign_queue") {
    const strategy = (action.strategy as DispatchStrategy) || "least_loaded";
    const agentId = await pickAgent(order.organizationId, strategy);
    if (agentId) {
      await prisma.order.update({ where: { id: order.id }, data: { agentId } });
    }
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
  if (type === "create_task") {
    await prisma.task.create({
      data: {
        organizationId: order.organizationId,
        orderId: order.id,
        title: interpolate(action.title || `Follow up ${order.number}`, order),
        description: interpolate(action.text || "", order) || undefined,
        priority: action.priority || "medium",
      },
    });
  }
  if (type === "notify") {
    await prisma.notification.create({
      data: {
        organizationId: order.organizationId,
        title: interpolate(action.title || "Automation", order),
        body: interpolate(action.text || `${order.number} matched a rule.`, order),
        kind: "automation",
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
