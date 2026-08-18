import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import { log } from "../log";
import { redis } from "../redis";

export { redis };

export const QUEUES = [
  "orders",
  "shipping",
  "tracking",
  "notifications",
  "whatsapp",
  "sms",
  "email",
  "analytics",
  "marketing-sync",
  "webhooks",
  "ai",
  "inventory",
  "imports",
  "bulk",
] as const;

export type QueueName = (typeof QUEUES)[number];

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName) {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: redis() });
    queues.set(name, q);
  }
  return q;
}

export async function enqueue(
  name: QueueName,
  payload: object,
  jobId?: string,
  options?: JobsOptions,
) {
  try {
    await getQueue(name).add(name, payload, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
      ...options,
    });
    return { queued: true };
  } catch (err) {
    log.warn(`Queue ${name} unavailable`, { error: (err as Error).message });
    return { queued: false };
  }
}

/**
 * Registers a job that BullMQ re-adds on a cron schedule. Safe to call on every
 * worker boot: the scheduler id makes it idempotent.
 */
export async function scheduleRepeatable(
  name: QueueName,
  schedulerId: string,
  everyMs: number,
  payload: object = {},
) {
  try {
    await getQueue(name).upsertJobScheduler(
      schedulerId,
      { every: everyMs },
      { name, data: payload, opts: { removeOnComplete: 100, removeOnFail: 500 } },
    );
    return { scheduled: true };
  } catch (err) {
    log.warn(`Could not schedule ${schedulerId} on ${name}`, { error: (err as Error).message });
    return { scheduled: false };
  }
}

export function queueEvents(name: QueueName) {
  return new QueueEvents(name, { connection: redis() });
}
