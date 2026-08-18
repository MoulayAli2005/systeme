import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

let connection: IORedis | null = null;

export function redis() {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  }
  return connection;
}

export const QUEUES = [
  "orders",
  "shipping",
  "notifications",
  "whatsapp",
  "sms",
  "email",
  "analytics",
  "marketing-sync",
  "webhooks",
  "ai",
  "inventory",
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

export async function enqueue(name: QueueName, payload: object, jobId?: string) {
  try {
    await getQueue(name).add(name, payload, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  } catch (err) {
    console.warn(`Queue ${name} unavailable, running inline`, (err as Error).message);
    return { inline: true };
  }
}

export function queueEvents(name: QueueName) {
  return new QueueEvents(name, { connection: redis() });
}
