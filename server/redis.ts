import IORedis from "ioredis";
import { env } from "./env";
import { log } from "./log";

let client: IORedis | null = null;
let degradedUntil = 0;

const DEGRADE_MS = 10_000;

export function redis() {
  if (!client) {
    client = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
    client.on("error", (err) => {
      if (Date.now() < degradedUntil) return;
      degradedUntil = Date.now() + DEGRADE_MS;
      log.warn("Redis connection error", { error: (err as Error).message });
    });
  }
  return client;
}

/**
 * Runs a Redis command, degrading to `fallback` when Redis is unreachable.
 * A short circuit-breaker window keeps a dead Redis from adding latency to
 * every request.
 */
export async function withRedis<T>(fn: (client: IORedis) => Promise<T>, fallback: T): Promise<T> {
  if (Date.now() < degradedUntil) return fallback;
  try {
    return await fn(redis());
  } catch (err) {
    degradedUntil = Date.now() + DEGRADE_MS;
    log.warn("Redis command failed, using fallback", { error: (err as Error).message });
    return fallback;
  }
}

export function redisDegraded() {
  return Date.now() < degradedUntil;
}
