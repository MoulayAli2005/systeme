import { prisma } from "../../db";
import { ApiError } from "../../http";
import { log } from "../../log";
import { enqueue } from "../../jobs/queues";
import { messagingProvider } from "../../providers/registry";
import { createShipmentForOrder } from "../shipping/service";
import { changeStatus } from "./service";

export const BULK_ACTIONS = ["status", "assign", "tag", "untag", "whatsapp", "sms", "ship"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/**
 * Anything larger runs in a worker. A confirmation desk selecting a screenful
 * of orders still gets a synchronous answer; a 2,000-row selection no longer
 * holds an HTTP connection open until it times out.
 */
export const INLINE_LIMIT = 25;

export type BulkRequest = {
  organizationId: string;
  userId: string;
  ids: string[];
  action: BulkAction;
  value?: string;
};

export async function startBulk(req: BulkRequest) {
  if (req.action === "status" && !req.value) {
    throw new ApiError(400, "BAD_REQUEST", "A target status is required.");
  }

  if (req.ids.length <= INLINE_LIMIT) {
    const result = await runBulk(req);
    return { mode: "inline" as const, ...result };
  }

  const job = await prisma.jobRun.create({
    data: {
      organizationId: req.organizationId,
      kind: `orders.bulk.${req.action}`,
      total: req.ids.length,
      createdById: req.userId,
      result: { action: req.action, value: req.value ?? null },
    },
  });
  const queued = await enqueue("bulk", { jobRunId: job.id, ...req }, `bulk:${job.id}`);
  if (!queued.queued) {
    // No worker reachable: fall back to doing the work here rather than
    // silently accepting a job that will never run.
    const result = await runBulk(req, job.id);
    return { mode: "inline" as const, jobRunId: job.id, ...result };
  }
  return { mode: "queued" as const, jobRunId: job.id, total: req.ids.length };
}

export async function runBulk(req: BulkRequest, jobRunId?: string) {
  if (jobRunId) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: "running", startedAt: new Date() },
    });
  }

  const orders = await prisma.order.findMany({
    where: { organizationId: req.organizationId, id: { in: req.ids }, deletedAt: null },
    include: { customer: { select: { phone: true } } },
  });

  let processed = 0;
  let failed = 0;
  const errors: Array<{ orderId: string; number: string; message: string }> = [];

  for (const order of orders) {
    try {
      await applyOne(req, order);
      processed += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        orderId: order.id,
        number: order.number,
        message: err instanceof Error ? err.message : "Unknown error",
      });
      log.warn("Bulk action failed for one order", {
        orderId: order.id,
        action: req.action,
        error: (err as Error).message,
      });
    }
    if (jobRunId && (processed + failed) % 25 === 0) {
      await prisma.jobRun.update({ where: { id: jobRunId }, data: { processed, failed } });
    }
  }

  if (jobRunId) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: "completed",
        processed,
        failed,
        finishedAt: new Date(),
        // Truncated: a job over a huge selection should not store an
        // unbounded error blob in the row the UI polls.
        errors: errors.slice(0, 50),
      },
    });
  }

  return { updated: processed, failed, errors: errors.slice(0, 50) };
}

async function applyOne(
  req: BulkRequest,
  order: { id: string; number: string; tags: string[]; customer: { phone: string } },
) {
  switch (req.action) {
    case "status":
      await changeStatus({
        organizationId: req.organizationId,
        userId: req.userId,
        id: order.id,
        status: req.value!,
        source: "bulk",
      });
      return;
    case "assign":
      if (!req.value) throw new ApiError(400, "BAD_REQUEST", "An agent is required.");
      await prisma.order.update({ where: { id: order.id }, data: { agentId: req.value } });
      return;
    case "tag":
      if (!req.value) throw new ApiError(400, "BAD_REQUEST", "A tag is required.");
      if (order.tags.includes(req.value)) return;
      await prisma.order.update({ where: { id: order.id }, data: { tags: { push: req.value } } });
      return;
    case "untag":
      if (!req.value) throw new ApiError(400, "BAD_REQUEST", "A tag is required.");
      await prisma.order.update({
        where: { id: order.id },
        data: { tags: order.tags.filter((t) => t !== req.value) },
      });
      return;
    case "whatsapp":
    case "sms":
      await messagingProvider(req.action === "sms" ? "sms" : "whatsapp").sendMessage({
        to: order.customer.phone,
        text: req.value || `Update on ${order.number}`,
      });
      return;
    case "ship":
      await createShipmentForOrder({
        organizationId: req.organizationId,
        orderId: order.id,
        carrierId: req.value ?? undefined,
        userId: req.userId,
      });
      return;
  }
}
