import { prisma } from "../../db";
import { ApiError } from "../../http";

/**
 * Default flow for the built-in statuses. Organizations can override it by
 * editing `StatusDefinition.allowedNext`.
 */
export const DEFAULT_TRANSITIONS: Record<string, string[]> = {
  NEW: ["TO_CONFIRM", "CALLING", "CONFIRMED", "CANCELLED"],
  TO_CONFIRM: ["CALLING", "NO_ANSWER", "CALLBACK", "CONFIRMED", "CANCELLED"],
  CALLING: ["TO_CONFIRM", "NO_ANSWER", "CALLBACK", "CONFIRMED", "CANCELLED"],
  NO_ANSWER: ["TO_CONFIRM", "CALLING", "CALLBACK", "CONFIRMED", "CANCELLED"],
  CALLBACK: ["TO_CONFIRM", "CALLING", "NO_ANSWER", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "SHIPPED", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "SHIPPED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export type StatusGraph = {
  /** Status key -> keys it may move to. An empty list means unrestricted. */
  transitions: Record<string, string[]>;
  known: Set<string>;
};

export function buildGraph(
  rows: Array<{ key: string; allowedNext: string[] }>,
): StatusGraph {
  const transitions: Record<string, string[]> = {};
  for (const row of rows) transitions[row.key] = row.allowedNext ?? [];
  return { transitions, known: new Set(rows.map((r) => r.key)) };
}

export type TransitionCheck =
  | { ok: true; noop?: boolean }
  | { ok: false; code: "UNKNOWN_STATUS" | "INVALID_TRANSITION"; message: string };

/**
 * Pure transition check so the rules can be unit tested without a database.
 */
export function checkTransition(from: string, to: string, graph: StatusGraph): TransitionCheck {
  if (graph.known.size && !graph.known.has(to)) {
    return {
      ok: false,
      code: "UNKNOWN_STATUS",
      message: `"${to}" is not a status in this workspace.`,
    };
  }
  if (from === to) return { ok: true, noop: true };

  const allowed = graph.transitions[from];
  // No configured successors means the organization has not described this
  // part of its flow yet; allow it rather than block real operations.
  if (!allowed || allowed.length === 0) return { ok: true };
  if (allowed.includes(to)) return { ok: true };

  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: `Cannot move an order from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}.`,
  };
}

export async function loadGraph(organizationId: string): Promise<StatusGraph> {
  const rows = await prisma.statusDefinition.findMany({
    where: { organizationId },
    select: { key: true, allowedNext: true },
  });
  if (!rows.length) {
    return buildGraph(
      Object.entries(DEFAULT_TRANSITIONS).map(([key, allowedNext]) => ({ key, allowedNext })),
    );
  }
  return buildGraph(rows);
}

/**
 * Throws unless the move is legal. `force` lets an operator with settings
 * permission repair an order that a carrier or import left in a wrong state,
 * and the override is recorded by the caller in the audit log.
 */
export async function assertTransition(
  organizationId: string,
  from: string,
  to: string,
  force = false,
) {
  const graph = await loadGraph(organizationId);
  const result = checkTransition(from, to, graph);
  if (result.ok) return result;
  if (force && result.code === "INVALID_TRANSITION") return { ok: true as const };
  throw new ApiError(409, result.code, result.message);
}
