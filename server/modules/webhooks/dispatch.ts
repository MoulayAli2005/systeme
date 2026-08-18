import { createHmac } from "crypto";
import { prisma } from "../../db";
import { enqueue } from "../../jobs/queues";

export function signWebhook(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchOutgoing(opts: {
  organizationId: string;
  event: string;
  payload: Record<string, unknown>;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: opts.organizationId, enabled: true },
  });
  for (const endpoint of endpoints) {
    const events = endpoint.events ?? [];
    if (events.length && !events.includes("*") && !events.includes(opts.event)) continue;
    await enqueue(
      "webhooks",
      {
        endpointId: endpoint.id,
        event: opts.event,
        payload: opts.payload,
      },
      `wh:${endpoint.id}:${opts.event}:${String(opts.payload.orderId ?? Date.now())}`,
    );
  }
}

export async function deliverWebhook(endpointId: string, event: string, payload: unknown) {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint?.enabled) return { skipped: true };
  const body = JSON.stringify(payload ?? {});
  const signature = signWebhook(endpoint.secret, body);
  let status = "failed";
  let response = "";
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nexora-Signature": signature,
        "X-Nexora-Event": event,
      },
      body,
    });
    status = res.ok ? "delivered" : "failed";
    response = String(res.status);
  } catch (err) {
    response = err instanceof Error ? err.message : "error";
  }
  await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event,
      payload: (payload ?? {}) as object,
      status,
      attempts: 1,
      response,
    },
  });
  return { status };
}
