import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/server/db";
import { json, errorResponse, ApiError } from "@/server/http";
import { log, requestIdOf } from "@/server/log";
import { clientIp } from "@/server/request";
import { enforceRateLimit, RATE_LIMITS } from "@/server/ratelimit";
import { env } from "@/server/env";
import {
  processInboundEvent,
  recordInboundEvent,
  resolveSecret,
  verifySignature,
} from "@/server/modules/inbound/service";

export const dynamic = "force-dynamic";

/** Providers put their delivery id in different headers. */
function externalIdOf(req: NextRequest, provider: string, raw: string, payload: Record<string, unknown>) {
  const header =
    req.headers.get("x-shopify-webhook-id") ??
    req.headers.get("x-wc-webhook-delivery-id") ??
    req.headers.get("x-nexora-delivery-id") ??
    req.headers.get("idempotency-key");
  if (header) return `${provider}:${header}`;

  const bodyId = payload.id ?? payload.event_id ?? payload.awb ?? payload.tracking;
  if (bodyId) return `${provider}:${String(bodyId)}`;

  // Last resort: content hash. Identical retries collapse; genuinely distinct
  // events differ somewhere in the body.
  return `${provider}:sha:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

function topicOf(req: NextRequest, payload: Record<string, unknown>) {
  return (
    req.headers.get("x-shopify-topic") ??
    req.headers.get("x-wc-webhook-topic") ??
    req.headers.get("x-nexora-event") ??
    (typeof payload.event === "string" ? payload.event : null) ??
    (typeof payload.topic === "string" ? payload.topic : null) ??
    "unknown"
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const requestId = requestIdOf(req);
  try {
    const { provider } = await ctx.params;
    await enforceRateLimit(`inbound:${provider}:${clientIp(req)}`, RATE_LIMITS.inboundWebhook);

    const raw = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Webhook body is not valid JSON.");
    }

    const orgId = req.nextUrl.searchParams.get("org");
    if (!orgId) throw new ApiError(400, "BAD_REQUEST", "org query param required");
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw new ApiError(404, "NOT_FOUND", "Unknown organization.");

    const secret = await resolveSecret(orgId, provider);
    const signature =
      req.headers.get("x-nexora-signature") ??
      req.headers.get("x-shopify-hmac-sha256") ??
      req.headers.get("x-wc-webhook-signature");

    if (secret) {
      if (!verifySignature(secret, raw, signature)) {
        throw new ApiError(401, "INVALID_SIGNATURE", "Webhook signature mismatch.");
      }
    } else if (env.NODE_ENV === "production") {
      // Refusing is safer than silently trusting an unauthenticated caller
      // that can create orders.
      throw new ApiError(
        503,
        "WEBHOOK_NOT_CONFIGURED",
        "No signing secret is configured for this provider. Add one in Settings → Integrations.",
      );
    }

    const topic = topicOf(req, payload);
    const externalId = externalIdOf(req, provider, raw, payload);

    const { event, duplicate } = await recordInboundEvent({
      organizationId: orgId,
      provider,
      externalId,
      topic,
      payload,
      headers: { "user-agent": req.headers.get("user-agent") ?? "", requestId },
    });

    if (duplicate) {
      log.info("Inbound webhook ignored as duplicate", { provider, topic, externalId, requestId });
      return json({ ok: true, duplicate: true, eventId: event.id, status: event.status });
    }

    const result = await processInboundEvent(event.id);
    return json({ ok: true, eventId: event.id, ...result });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
