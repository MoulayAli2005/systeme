import { prisma } from "./db";
import { redis } from "./jobs/queues";

export async function health() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (e) {
    checks.database = { ok: false, detail: (e as Error).message };
  }
  try {
    const pong = await redis().ping();
    checks.redis = { ok: pong === "PONG" };
  } catch (e) {
    checks.redis = { ok: false, detail: (e as Error).message };
  }
  checks.queues = { ok: checks.redis?.ok ?? false, detail: "BullMQ uses Redis" };
  const ok = Boolean(checks.database?.ok);
  return { ok, checks, time: new Date().toISOString() };
}
