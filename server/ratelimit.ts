import { ApiError } from "./http";
import { withRedis } from "./redis";

export type RateLimitRule = { limit: number; windowSec: number };

/**
 * Named rules so limits are reviewable in one place instead of scattered as
 * magic numbers across route handlers.
 */
export const RATE_LIMITS = {
  login: { limit: 20, windowSec: 60 },
  loginAccount: { limit: 10, windowSec: 300 },
  register: { limit: 10, windowSec: 60 },
  passwordReset: { limit: 5, windowSec: 900 },
  publicTracking: { limit: 60, windowSec: 60 },
  inboundWebhook: { limit: 600, windowSec: 60 },
  apiKey: { limit: 600, windowSec: 60 },
  mutation: { limit: 240, windowSec: 60 },
  read: { limit: 600, windowSec: 60 },
  aiAsk: { limit: 30, windowSec: 60 },
  bulk: { limit: 30, windowSec: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

type MemoryBucket = { count: number; resetAt: number };
const memory = new Map<string, MemoryBucket>();

function memoryHit(key: string, rule: RateLimitRule, now: number) {
  // Opportunistic pruning: the fallback is only used while Redis is down, so a
  // bounded sweep is enough to keep the map from growing without limit.
  if (memory.size > 10_000) {
    for (const [k, bucket] of memory) {
      if (bucket.resetAt <= now) memory.delete(k);
    }
  }
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + rule.windowSec * 1000 };
    memory.set(key, bucket);
    return bucket;
  }
  existing.count += 1;
  return existing;
}

export async function checkRateLimit(
  key: string,
  rule: RateLimitRule = RATE_LIMITS.read,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const bucketKey = `rl:${key}:${Math.floor(now / windowMs)}`;

  const count = await withRedis(async (client) => {
    const results = await client
      .multi()
      .incr(bucketKey)
      .pexpire(bucketKey, windowMs)
      .exec();
    const value = results?.[0]?.[1];
    return typeof value === "number" ? value : Number(value);
  }, null as number | null);

  if (count === null) {
    const bucket = memoryHit(bucketKey, rule, now);
    return {
      allowed: bucket.count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - bucket.count),
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export async function enforceRateLimit(key: string, rule: RateLimitRule = RATE_LIMITS.read) {
  const result = await checkRateLimit(key, rule);
  if (result.allowed) return result;
  throw new ApiError(429, "RATE_LIMIT", "Too many requests. Slow down and retry shortly.", undefined, {
    "Retry-After": String(result.retryAfterSec),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": "0",
  });
}
