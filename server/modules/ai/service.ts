import { prisma } from "../../db";
import { aiProvider } from "../../providers/registry";
import { overview } from "../analytics/service";
import { copilotReply, type Lookup } from "./demo";
import { lastUserMessage, publicReply, publicSystemPrompt, type ChatTurn } from "./public";

export async function ask(
  organizationId: string,
  question: string,
  history: ChatTurn[] = [],
) {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 864e5);
  const [stats, lookups] = await Promise.all([
    overview(organizationId, from, to),
    lookupMentions(organizationId, question),
  ]);
  const provider = aiProvider();
  const context = JSON.stringify(
    {
      last7Days: {
        orders: stats.count,
        delivered: stats.delivered,
        confirmationRate: stats.confirmationRate,
        deliveryRate: stats.deliveryRate,
        profit: stats.profit,
        shippingCost: stats.shippingCost,
        topCities: stats.cities.slice(0, 5),
        topProducts: stats.products.slice(0, 5),
      },
      lookups,
      history: history.slice(-6),
    },
    null,
    2,
  );

  // Demo provider is always "configured" so we skip it and answer from stats
  // ourselves — otherwise the visitor gets a "connect OPENAI_API_KEY" shrug.
  const live = provider.configured && provider.name !== "demo-ai";
  const answer = live
    ? await provider.complete(
        `${history.length ? `Recent turns:\n${history.map((t) => `${t.role}: ${t.content}`).join("\n")}\n\n` : ""}Question: ${question}`,
        context,
      )
    : copilotReply(question, stats, lookups);

  return {
    answer,
    provider: live ? provider.name : "nexora-copilot",
    configured: live,
  };
}

export async function publicChat(messages: ChatTurn[]) {
  const question = lastUserMessage(messages);
  if (!question) return { answer: "Ask me anything about Nexora.", provider: "faq", configured: false };

  const provider = aiProvider();
  if (provider.configured && provider.name !== "demo-ai") {
    const transcript = messages
      .slice(-8)
      .map((t) => `${t.role}: ${t.content}`)
      .join("\n");
    const answer = await provider.complete(`${publicSystemPrompt()}\n\n${transcript}\nassistant:`);
    return { answer, provider: provider.name, configured: true };
  }
  return { ...publicReply(question), configured: false };
}

async function lookupMentions(organizationId: string, question: string): Promise<Lookup[]> {
  const found: Lookup[] = [];
  const numbers = question.match(/\b(?:NX|CH)-\d+\b/gi) ?? [];
  const phones = question.match(/\b(?:\+212|0)[5-7]\d{8}\b/g) ?? [];
  const awbs = question.match(/\b(?:OZ|CH)\d{8,}\b/gi) ?? [];

  if (numbers.length) {
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        number: { in: numbers.map((n) => n.toUpperCase()) },
        deletedAt: null,
      },
      include: { customer: { select: { name: true, city: true, phone: true } } },
      take: 5,
    });
    for (const order of orders) {
      found.push({
        kind: "order",
        title: order.number,
        detail: `${order.status} · ${order.customer.name} · ${order.customer.city} · ${Number(order.total)} MAD`,
      });
    }
  }

  if (phones.length) {
    const customers = await prisma.customer.findMany({
      where: { organizationId, phone: { in: phones } },
      take: 5,
      include: { _count: { select: { orders: true } } },
    });
    for (const customer of customers) {
      found.push({
        kind: "customer",
        title: customer.name,
        detail: `${customer.phone} · ${customer.city} · ${customer._count.orders} orders · risk ${customer.riskLabel}`,
      });
    }
  }

  if (awbs.length) {
    const shipments = await prisma.shipment.findMany({
      where: { organizationId, awb: { in: awbs.map((a) => a.toUpperCase()) } },
      include: { order: { select: { number: true, status: true } } },
      take: 5,
    });
    for (const shipment of shipments) {
      found.push({
        kind: "shipment",
        title: shipment.awb ?? shipment.id,
        detail: `${shipment.status} · order ${shipment.order.number} (${shipment.order.status})`,
      });
    }
  }

  return found;
}

export async function summarizeOrderThread(organizationId: string, conversationId: string) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 40 }, customer: true },
  });
  if (!conv) return { answer: "Conversation not found." };
  const transcript = conv.messages.map((m) => `${m.from}: ${m.text}`).join("\n");
  const answer = await aiProvider().complete(
    "Summarize this customer thread and suggest the next agent reply.",
    transcript,
  );
  return { answer, provider: aiProvider().name };
}
