import { Worker } from "bullmq";
import { QUEUES, redis } from "./queues";
import { prisma } from "../db";
import { messagingProvider, shippingProvider, emailProvider } from "../providers/registry";
import { deliverWebhook } from "../modules/webhooks/dispatch";

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
      include: { customer: true },
    });
    if (!order) return;
    const result = await shippingProvider().createShipment({
      orderId: order.id,
      city: order.customer.city,
      address: order.customer.address ?? order.customer.city,
      phone: order.customer.phone,
      codAmount: Number(order.codAmount),
    });
    await prisma.shipment.create({
      data: {
        organizationId: order.organizationId,
        orderId: order.id,
        awb: result.awb,
        trackingUrl: result.trackingUrl,
        status: "created",
      },
    });
  }
  if (queue === "webhooks" && data.endpointId) {
    await deliverWebhook(String(data.endpointId), String(data.event ?? "event"), data.payload);
  }
}

export function startWorkers() {
  return QUEUES.map(
    (name) =>
      new Worker(
        name,
        async (job) => handle(name, job.data as Record<string, unknown>),
        { connection: redis() },
      ),
  );
}

if (process.argv[1]?.includes("worker")) {
  startWorkers();
  console.log("Nexora workers listening on", QUEUES.join(", "));
}
