import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { json, errorResponse, ApiError } from "@/server/http";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

function verify(secret: string, raw: string, signature: string | null) {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await ctx.params;
    const raw = await req.text();
    const payload = raw ? JSON.parse(raw) : {};
    const orgId = req.nextUrl.searchParams.get("org");
    if (!orgId) throw new ApiError(400, "BAD_REQUEST", "org query param required");
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new ApiError(404, "NOT_FOUND", "Unknown organization.");
    const secret = process.env.WEBHOOK_DEV_SECRET ?? "demo";
    const sig = req.headers.get("x-nexora-signature") ?? req.headers.get("x-shopify-hmac-sha256");
    if (secret !== "demo" && !verify(secret, raw, sig)) {
      throw new ApiError(401, "INVALID_SIGNATURE", "Webhook signature mismatch.");
    }
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: `webhook.${provider}`,
        entity: "Webhook",
        after: { event: req.headers.get("x-nexora-event") ?? payload.event ?? "unknown" },
      },
    });
    return json({ ok: true, provider, demo: secret === "demo" });
  } catch (e) {
    return errorResponse(e);
  }
}
