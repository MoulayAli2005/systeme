import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../../db";
import { ApiError } from "../../http";
import { log } from "../../log";
import { env } from "../../env";
import { decryptSecret } from "../../crypto";
import { createOrder } from "../orders/service";
import { applyShipmentStatus, normalizeCarrierStatus } from "../shipping/service";

export const INBOUND_PROVIDERS = ["shopify", "woocommerce", "youcan", "carrier", "generic"] as const;
export type InboundProvider = (typeof INBOUND_PROVIDERS)[number];

export function isInboundProvider(value: string): value is InboundProvider {
  return (INBOUND_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Resolves the signing secret for a provider. An organization can store its own
 * secret on the Integration record; `WEBHOOK_DEV_SECRET` is the fallback for
 * local work. When neither exists the endpoint refuses to accept traffic rather
 * than trusting anonymous callers.
 */
export async function resolveSecret(organizationId: string, provider: string) {
  const integration = await prisma.integration.findFirst({
    where: { organizationId, provider },
    select: { credentialsEnc: true, config: true },
  });

  const config = (integration?.config ?? {}) as { webhookSecret?: string };
  if (config.webhookSecret) return config.webhookSecret;

  if (integration?.credentialsEnc) {
    try {
      const decoded = JSON.parse(decryptSecret(integration.credentialsEnc)) as {
        webhookSecret?: string;
      };
      if (decoded.webhookSecret) return decoded.webhookSecret;
    } catch {
      // A credential blob that is not JSON is not a webhook secret; fall through.
    }
  }

  return env.WEBHOOK_DEV_SECRET ?? null;
}

export function verifySignature(secret: string, raw: string, signature: string | null) {
  if (!signature) return false;
  // Shopify sends base64, most others hex; accept either rather than forcing
  // every integration through a bespoke adapter.
  const candidates = [
    createHmac("sha256", secret).update(raw, "utf8").digest("hex"),
    createHmac("sha256", secret).update(raw, "utf8").digest("base64"),
  ];
  const provided = Buffer.from(signature.trim());
  return candidates.some((expected) => {
    const a = Buffer.from(expected);
    return a.length === provided.length && timingSafeEqual(a, provided);
  });
}

/**
 * Senders retry aggressively and duplicate deliveries are normal. The unique
 * index on (organization, provider, externalId) makes a repeat a no-op instead
 * of a second order.
 */
export async function recordInboundEvent(input: {
  organizationId: string;
  provider: string;
  externalId: string;
  topic: string;
  payload: unknown;
  headers?: Record<string, string>;
}) {
  const existing = await prisma.inboundEvent.findUnique({
    where: {
      organizationId_provider_externalId: {
        organizationId: input.organizationId,
        provider: input.provider,
        externalId: input.externalId,
      },
    },
  });
  if (existing) return { event: existing, duplicate: true as const };

  const event = await prisma.inboundEvent.create({
    data: {
      organizationId: input.organizationId,
      provider: input.provider,
      externalId: input.externalId,
      topic: input.topic,
      payload: (input.payload ?? {}) as object,
      headers: (input.headers ?? {}) as object,
    },
  });
  return { event, duplicate: false as const };
}

export async function processInboundEvent(eventId: string) {
  const event = await prisma.inboundEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "NOT_FOUND", "Inbound event not found.");
  if (event.status === "processed") return { status: "processed" as const, orderId: event.orderId };

  try {
    const result = await route(event.organizationId, event.provider, event.topic, event.payload);
    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: {
        status: result.handled ? "processed" : "ignored",
        orderId: result.orderId,
        processedAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    });
    return { status: result.handled ? ("processed" as const) : ("ignored" as const), orderId: result.orderId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: { status: "failed", error: message, attempts: { increment: 1 } },
    });
    log.error("Inbound event processing failed", err, {
      eventId: event.id,
      provider: event.provider,
      topic: event.topic,
    });
    throw err;
  }
}

/** Re-runs a previously failed delivery without asking the sender to resend. */
export async function replayInboundEvent(organizationId: string, eventId: string) {
  const event = await prisma.inboundEvent.findFirst({ where: { id: eventId, organizationId } });
  if (!event) throw new ApiError(404, "NOT_FOUND", "Inbound event not found.");
  await prisma.inboundEvent.update({ where: { id: event.id }, data: { status: "received" } });
  return processInboundEvent(event.id);
}

type RouteResult = { handled: boolean; orderId?: string };

async function route(
  organizationId: string,
  provider: string,
  topic: string,
  payload: unknown,
): Promise<RouteResult> {
  if (provider === "carrier") return handleCarrierEvent(organizationId, payload);

  if (isOrderTopic(topic)) {
    const draft = mapOrder(provider, payload);
    if (!draft) return { handled: false };
    const { order } = await createOrder({
      organizationId,
      customer: draft.customer,
      items: draft.items,
      notes: draft.notes,
      source: provider,
    });
    return { handled: true, orderId: order.id };
  }

  return { handled: false };
}

function isOrderTopic(topic: string) {
  const normalized = topic.toLowerCase();
  return (
    normalized.includes("order") &&
    (normalized.includes("create") || normalized.includes("paid") || normalized.includes("new"))
  );
}

export type OrderDraft = {
  customer: { name: string; phone: string; city: string; address?: string };
  items: Array<{ name: string; variant?: string; quantity: number; price: number }>;
  notes?: string;
};

/**
 * Storefront payloads to our order shape. Kept as a pure function so each
 * provider's mapping is unit testable against a captured payload.
 */
export function mapOrder(provider: string, payload: unknown): OrderDraft | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, any>;

  if (provider === "shopify") {
    const shipping = body.shipping_address ?? body.billing_address ?? {};
    const customer = body.customer ?? {};
    const name =
      [shipping.first_name ?? customer.first_name, shipping.last_name ?? customer.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || shipping.name || "Unknown";
    const phone = shipping.phone ?? customer.phone ?? body.phone;
    const city = shipping.city ?? body.city;
    if (!phone || !city) return null;

    const items = (body.line_items ?? []).map((item: Record<string, any>) => ({
      name: item.title ?? item.name ?? "Item",
      variant: item.variant_title ?? undefined,
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? 0),
    }));
    if (!items.length) return null;

    return {
      customer: { name, phone: String(phone), city: String(city), address: shipping.address1 ?? undefined },
      items,
      notes: body.note ?? undefined,
    };
  }

  if (provider === "woocommerce") {
    const shipping = body.shipping ?? {};
    const billing = body.billing ?? {};
    const phone = billing.phone ?? shipping.phone;
    const city = shipping.city || billing.city;
    if (!phone || !city) return null;

    const items = (body.line_items ?? []).map((item: Record<string, any>) => ({
      name: item.name ?? "Item",
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? item.total ?? 0),
    }));
    if (!items.length) return null;

    return {
      customer: {
        name:
          [shipping.first_name ?? billing.first_name, shipping.last_name ?? billing.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || "Unknown",
        phone: String(phone),
        city: String(city),
        address: shipping.address_1 ?? billing.address_1 ?? undefined,
      },
      items,
      notes: body.customer_note ?? undefined,
    };
  }

  // YouCan and our documented generic shape are close enough to share a mapper.
  const customer = body.customer ?? body;
  const phone = customer.phone ?? body.phone;
  const city = customer.city ?? body.city;
  if (!phone || !city) return null;

  const rawItems = body.items ?? body.products ?? body.line_items ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : []).map((item: Record<string, any>) => ({
    name: item.name ?? item.title ?? item.product ?? "Item",
    variant: item.variant ?? undefined,
    quantity: Number(item.quantity ?? item.qty ?? 1),
    price: Number(item.price ?? item.unit_price ?? 0),
  }));
  if (!items.length) return null;

  return {
    customer: {
      name: String(customer.name ?? customer.full_name ?? "Unknown"),
      phone: String(phone),
      city: String(city),
      address: customer.address ?? body.address ?? undefined,
    },
    items,
    notes: body.note ?? body.notes ?? undefined,
  };
}

async function handleCarrierEvent(organizationId: string, payload: unknown): Promise<RouteResult> {
  const body = (payload ?? {}) as Record<string, any>;
  const awb = String(body.awb ?? body.tracking ?? body.tracking_number ?? "").trim();
  const rawStatus = String(body.status ?? body.state ?? body.event ?? "").trim();
  if (!awb || !rawStatus) return { handled: false };

  const status = normalizeCarrierStatus(rawStatus);
  if (!status) {
    log.warn("Carrier webhook used an unmapped status", { awb, rawStatus });
    return { handled: false };
  }

  const shipment = await prisma.shipment.findFirst({
    where: { organizationId, awb },
    select: { id: true, orderId: true },
  });
  if (!shipment) return { handled: false };

  const collected = body.collected_amount ?? body.cod_collected ?? body.amount;
  await applyShipmentStatus({
    shipmentId: shipment.id,
    status,
    detail: body.detail ?? body.message ?? undefined,
    source: "webhook",
    collectedAmount: collected === undefined ? undefined : Number(collected),
  });
  return { handled: true, orderId: shipment.orderId };
}
