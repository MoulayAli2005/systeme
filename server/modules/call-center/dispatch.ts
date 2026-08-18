import { prisma } from "../../db";
import { ApiError } from "../../http";

export type DispatchStrategy = "round_robin" | "least_loaded" | "performance" | "random" | "manual";

export async function setPresence(organizationId: string, userId: string, state: string) {
  const allowed = ["available", "busy", "offline", "break"];
  if (!allowed.includes(state)) throw new ApiError(400, "BAD_REQUEST", "Invalid agent state.");
  const row = await prisma.agentProfile.updateMany({
    where: { organizationId, userId },
    data: { state },
  });
  if (!row.count) throw new ApiError(404, "NOT_FOUND", "Agent profile not found.");
  return { ok: true, state };
}

export async function pickAgent(organizationId: string, strategy: DispatchStrategy, manualId?: string) {
  if (strategy === "manual" && manualId) return manualId;

  const agents = await prisma.agentProfile.findMany({
    where: { organizationId, state: "available" },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!agents.length) return null;

  if (strategy === "random") {
    return agents[Math.floor(Math.random() * agents.length)].userId;
  }

  const loads = await prisma.order.groupBy({
    by: ["agentId"],
    where: {
      organizationId,
      deletedAt: null,
      status: { in: ["NEW", "TO_CONFIRM", "CALLING", "NO_ANSWER", "CALLBACK"] },
      agentId: { in: agents.map((a) => a.userId) },
    },
    _count: true,
  });
  const loadMap = Object.fromEntries(loads.map((l) => [l.agentId ?? "", l._count]));

  if (strategy === "least_loaded") {
    return [...agents].sort((a, b) => (loadMap[a.userId] ?? 0) - (loadMap[b.userId] ?? 0))[0].userId;
  }
  if (strategy === "performance") {
    return [...agents].sort((a, b) => b.confirmedToday - a.confirmedToday)[0].userId;
  }

  return [...agents].sort((a, b) => (loadMap[a.userId] ?? 0) - (loadMap[b.userId] ?? 0))[0].userId;
}

export async function assignNext(opts: {
  organizationId: string;
  strategy?: DispatchStrategy;
  agentId?: string;
}) {
  const strategy = opts.strategy ?? "round_robin";
  const agentId = await pickAgent(opts.organizationId, strategy, opts.agentId);
  const order = await prisma.order.findFirst({
    where: {
      organizationId: opts.organizationId,
      deletedAt: null,
      status: { in: ["NEW", "TO_CONFIRM"] },
      ...(strategy === "manual" || !agentId ? {} : { OR: [{ agentId: null }, { agentId }] }),
    },
    orderBy: { createdAt: "asc" },
    include: { customer: true, items: true },
  });
  if (!order) return { order: null, agentId };
  if (agentId && order.agentId !== agentId) {
    await prisma.order.update({ where: { id: order.id }, data: { agentId } });
  }
  return { order: { ...order, agentId: agentId ?? order.agentId }, agentId };
}
