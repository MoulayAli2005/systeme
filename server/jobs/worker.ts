import { Worker } from "bullmq";
import { QUEUES, redis, scheduleRepeatable } from "./queues";
import { prisma } from "../db";
import { log } from "../log";
import { messagingProvider, emailProvider } from "../providers/registry";
import { deliverWebhook } from "../modules/webhooks/dispatch";
import { createShipmentForOrder, syncActiveShipments } from "../modules/shipping/service";
import { runBulk, type BulkAction } from "../modules/orders/bulk";
import { runOrderImport } from "../modules/imports/orders";

/** How often shipments in a non-final state are re-checked with the carrier. */
const TRACKING_INTERVAL_MS = Number(process.env.TRACKING_INTERVAL_MS ?? 10 * 60_000);

async function handle(queue: string, data: Record<string, unknown>) {
  if (queue === "whatsapp" || queue === "sms") {
    const channel = queue === "sms" ? "sms" : "whatsapp";
    await messagingProvider(channel).sendMessage({
      to: String(data.to ?? ""),
      text: String(data.text ?? ""),
    });
    return;
  }
  if (queue === "email") {
    await emailProvider().send({
      to: String(data.to ?? ""),
      subject: String(data.subject ?? "Nexora"),
      text: String(data.text ?? ""),
    });
    return;
  }
  if (queue === "shipping" && data.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: String(data.orderId) },
      select: { id: true, organizationId: true },
    });
    if (!order) return;
    await createShipmentForOrder({
      organizationId: order.organizationId,
      orderId: order.id,
      carrierId: data.carrierId ? String(data.carrierId) : undefined,
    });
    return;
  }
  if (queue === "tracking") {
    const result = await syncActiveShipments(Number(data.limit ?? 200));
    if (result.checked) log.info("Carrier tracking sweep", result);
    return;
  }
  if (queue === "bulk" && data.jobRunId) {
    await runBulk(
      {
        organizationId: String(data.organizationId),
        userId: String(data.userId),
        ids: (data.ids as string[]) ?? [],
        action: data.action as BulkAction,
        value: data.value ? String(data.value) : undefined,
      },
      String(data.jobRunId),
    );
    return;
  }
  if (queue === "imports" && data.jobRunId) {
    await runOrderImport(String(data.jobRunId));
    return;
  }
  if (queue === "webhooks" && data.endpointId) {
    await deliverWebhook(String(data.endpointId), String(data.event ?? "event"), data.payload);
  }
}

export function startWorkers() {
  const workers = QUEUES.map(
    (name) =>
      new Worker(name, async (job) => handle(name, job.data as Record<string, unknown>), {
        connection: redis(),
      }),
  );
  for (const worker of workers) {
    worker.on("failed", (job, err) => {
      log.error("Job failed", err, { queue: worker.name, jobId: job?.id, attempts: job?.attemptsMade });
    });
  }
  return workers;
}

if (process.argv[1]?.includes("worker")) {
  startWorkers();
  void scheduleRepeatable("tracking", "carrier-tracking-sweep", TRACKING_INTERVAL_MS, { limit: 200 });
  log.info("Nexora workers listening", {
    queues: QUEUES.join(", "),
    trackingIntervalMs: TRACKING_INTERVAL_MS,
  });
}
