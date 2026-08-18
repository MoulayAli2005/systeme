import { prisma } from "../../db";
import { aiProvider } from "../../providers/registry";
import { overview } from "../analytics/service";

export async function ask(organizationId: string, question: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 864e5);
  const stats = await overview(organizationId, from, to);
  const context = JSON.stringify(
    {
      last7Days: {
        orders: stats.count,
        delivered: stats.delivered,
        deliveryRate: stats.deliveryRate,
        profit: stats.profit,
        topCities: stats.cities.slice(0, 5),
        topProducts: stats.products.slice(0, 5),
      },
    },
    null,
    2,
  );
  const answer = await aiProvider().complete(question, context);
  return { answer, provider: aiProvider().name, configured: aiProvider().configured };
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
