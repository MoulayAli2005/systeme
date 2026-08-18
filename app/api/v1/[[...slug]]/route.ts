import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, json, parsePage, cursorArgs, withCursor, ApiError } from "@/server/http";
import { toCsv } from "@/server/csv";
import { requireAuth, requirePermission, requirePlatformAdmin, sessionCookie, clearSessionCookie, resolveAuth } from "@/server/auth/session";
import * as auth from "@/server/auth/service";
import * as orders from "@/server/modules/orders/service";
import { BULK_ACTIONS, startBulk } from "@/server/modules/orders/bulk";
import { createShipmentForOrder, overdueSettlements } from "@/server/modules/shipping/service";
import * as analytics from "@/server/modules/analytics/service";
import * as ai from "@/server/modules/ai/service";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { messagingProvider, phoneProvider, shippingProvider } from "@/server/providers/registry";
import { enqueue } from "@/server/jobs/queues";
import { health } from "@/server/health";
import { handleExtra } from "@/server/api/extra";
import { handleFinance } from "@/server/api/finance";
import { handleOps } from "@/server/api/ops";
import { enforceRateLimit, RATE_LIMITS } from "@/server/ratelimit";
import { log, requestIdOf } from "@/server/log";
import { clientIp, identityKey } from "@/server/request";

export const dynamic = "force-dynamic";

const ip = clientIp;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handle(req, await ctx.params, "GET");
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handle(req, await ctx.params, "POST");
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handle(req, await ctx.params, "PATCH");
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handle(req, await ctx.params, "DELETE");
}

async function handle(req: NextRequest, params: { slug?: string[] }, method: string) {
  const requestId = requestIdOf(req);
  const started = Date.now();
  const path = (params.slug ?? []).join("/");
  try {
    const url = new URL(req.url);
    let body: unknown = null;
    if (method !== "GET" && method !== "DELETE") {
      body = await req.json().catch(() => null);
    }
    await enforceRateLimit(
      `${method === "GET" ? "read" : "write"}:${identityKey(req)}`,
      method === "GET" ? RATE_LIMITS.read : RATE_LIMITS.mutation,
    );
    const res = await route(req, method, path, url, body);
    res.headers.set("X-Request-Id", requestId);
    log.info("api", { requestId, method, path, status: res.status, ms: Date.now() - started });
    return res;
  } catch (err) {
    const res = errorResponse(err, requestId);
    log.info("api", { requestId, method, path, status: res.status, ms: Date.now() - started });
    return res;
  }
}

async function route(req: NextRequest, method: string, path: string, url: URL, body: unknown): Promise<Response> {
  const extra = await handleExtra(req, method, path, url, body, ip(req));
  if (extra) return extra;

  const finance = await handleFinance(req, method, path, url, body, ip(req));
  if (finance) return finance;

  const ops = await handleOps(req, method, path, url, body);
  if (ops) return ops;

  if (path.startsWith("track/") && method === "GET") {
    // Public and unauthenticated: without a budget this endpoint lets anyone
    // enumerate AWBs and read customer cities.
    await enforceRateLimit(`track:${ip(req)}`, RATE_LIMITS.publicTracking);
    const awb = decodeURIComponent(path.slice("track/".length));
    const row = await prisma.shipment.findFirst({
      where: { awb },
      include: { order: { select: { number: true, status: true, customer: { select: { city: true } } } } },
    });
    if (!row) throw new ApiError(404, "NOT_FOUND", "Tracking number not found.");
    return json({
      awb: row.awb,
      status: row.status,
      orderNumber: row.order.number,
      city: row.order.customer.city,
    });
  }

  if (path === "auth/register" && method === "POST") {
    await enforceRateLimit(`register:${ip(req)}`, RATE_LIMITS.register);
    const result = await auth.register(body, ip(req), req.headers.get("user-agent") ?? undefined);
    const res = json({ user: result.user, organization: result.organization });
    res.headers.set("Set-Cookie", sessionCookie(result.session.token, result.session.expiresAt));
    return res;
  }
  if (path === "auth/login" && method === "POST") {
    await enforceRateLimit(`login:${ip(req)}`, RATE_LIMITS.login);
    const email = typeof body === "object" && body && "email" in body ? String(body.email) : "";
    // Per-account budget too, so a botnet cannot spread a credential-stuffing
    // run for one victim across many source addresses.
    if (email) await enforceRateLimit(`login-account:${email.toLowerCase()}`, RATE_LIMITS.loginAccount);
    const result = await auth.login(body, ip(req), req.headers.get("user-agent") ?? undefined);
    const res = json({ user: result.user, organizations: result.organizations });
    res.headers.set("Set-Cookie", sessionCookie(result.session.token, result.session.expiresAt));
    return res;
  }
  if (path === "auth/logout" && method === "POST") {
    await auth.logout(req);
    const res = json({ ok: true });
    res.headers.set("Set-Cookie", clearSessionCookie());
    return res;
  }
  if (path === "auth/me" && method === "GET") {
    const ctx = await resolveAuth(req);
    if (!ctx) return json({ user: null }, 200);
    return json({ user: ctx });
  }
  if (path === "auth/forgot" && method === "POST") {
    const email = z.object({ email: z.string().email() }).parse(body).email;
    await enforceRateLimit(`forgot:${ip(req)}`, RATE_LIMITS.passwordReset);
    await enforceRateLimit(`forgot-account:${email.toLowerCase()}`, RATE_LIMITS.passwordReset);
    return json(await auth.forgotPassword(email));
  }
  if (path === "auth/reset" && method === "POST") {
    const data = z.object({ token: z.string(), password: z.string().min(8) }).parse(body);
    await auth.resetPassword(data.token, data.password);
    return json({ ok: true });
  }
  if (path === "auth/verify-email" && method === "POST") {
    await auth.verifyEmail(z.object({ token: z.string() }).parse(body).token);
    return json({ ok: true });
  }
  if (path === "auth/google" && method === "GET") {
    return json({ url: auth.googleOAuthUrl() });
  }
  if (path === "auth/2fa/setup" && method === "POST") {
    const ctx = await requireAuth(req);
    return json(await auth.setup2fa(ctx.userId));
  }
  if (path === "auth/2fa/enable" && method === "POST") {
    const ctx = await requireAuth(req);
    await auth.enable2fa(ctx.userId, z.object({ code: z.string() }).parse(body).code);
    return json({ ok: true });
  }

  if (path === "orders" && method === "GET") {
    const ctx = await requirePermission("orders.read", req);
    const page = parsePage(url);
    return json(
      await orders.listOrders(ctx.organizationId, {
        ...page,
        status: url.searchParams.get("status") ?? undefined,
        city: url.searchParams.get("city") ?? undefined,
        storeId: url.searchParams.get("storeId") ?? undefined,
        agentId: url.searchParams.get("agentId") ?? undefined,
        source: url.searchParams.get("source") ?? undefined,
      }),
    );
  }
  if (path === "orders" && method === "POST") {
    const ctx = await requirePermission("orders.write", req);
    const data = z
      .object({
        customer: z.object({
          name: z.string(),
          phone: z.string(),
          city: z.string(),
          address: z.string().optional(),
        }),
        items: z.array(
          z.object({
            name: z.string(),
            variant: z.string().optional(),
            quantity: z.number().int().positive(),
            price: z.number(),
            variantId: z.string().optional(),
          }),
        ),
        storeId: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(body);
    return json(await orders.createOrder({ organizationId: ctx.organizationId, userId: ctx.userId, ...data }), 201);
  }
  if (path.startsWith("orders/") && method === "GET") {
    const ctx = await requirePermission("orders.read", req);
    const id = path.split("/")[1];
    if (id === "pipeline") {
      const grouped = await prisma.order.groupBy({
        by: ["status"],
        where: { organizationId: ctx.organizationId, deletedAt: null },
        _count: true,
      });
      return json({ grouped });
    }
    return json(await orders.getOrder(ctx.organizationId, id));
  }
  if (path.match(/^orders\/[^/]+\/status$/) && method === "POST") {
    const ctx = await requirePermission("orders.confirm", req);
    const id = path.split("/")[1];
    const status = z
      .object({ status: z.string(), note: z.string().optional(), force: z.boolean().optional() })
      .parse(body);
    return json(
      await orders.changeStatus({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        id,
        status: status.status,
        note: status.note,
        ip: ip(req),
        // Only workspace administrators may step outside the configured flow.
        force: status.force === true && ctx.permissions.includes("settings.manage"),
      }),
    );
  }
  if (path === "orders/bulk" && method === "POST") {
    const ctx = await requirePermission("orders.bulk", req);
    await enforceRateLimit(`bulk:${ctx.organizationId}`, RATE_LIMITS.bulk);
    const data = z
      .object({
        ids: z.array(z.string()).min(1).max(5000),
        action: z.enum(BULK_ACTIONS),
        value: z.string().optional(),
      })
      .parse(body);
    return json(await startBulk({ organizationId: ctx.organizationId, userId: ctx.userId, ...data }));
  }

  if (path === "customers" && method === "GET") {
    const ctx = await requirePermission("customers.read", req);
    const page = parsePage(url);
    const rows = await prisma.customer.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(page.q
          ? {
              OR: [
                { name: { contains: page.q, mode: "insensitive" } },
                { phone: { contains: page.q } },
              ],
            }
          : {}),
      },
      ...cursorArgs(page),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    return json(withCursor(rows, page));
  }
  if (path.startsWith("customers/") && method === "GET") {
    const ctx = await requirePermission("customers.read", req);
    const id = path.split("/")[1];
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { orders: { take: 20, orderBy: { createdAt: "desc" }, include: { items: true } } },
    });
    if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found.");
    return json(customer);
  }

  if (path === "products" && method === "GET") {
    const ctx = await requirePermission("products.read", req);
    const page = parsePage(url);
    const rows = await prisma.product.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(page.q
          ? {
              OR: [
                { name: { contains: page.q, mode: "insensitive" } },
                { sku: { contains: page.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      ...cursorArgs(page),
      include: { variants: { include: { inventory: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return json(withCursor(rows, page));
  }

  if (path === "inventory" && method === "GET") {
    const ctx = await requirePermission("inventory.read", req);
    const page = parsePage(url);
    const rows = await prisma.inventoryItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(url.searchParams.get("warehouseId")
          ? { warehouseId: url.searchParams.get("warehouseId")! }
          : {}),
        ...(url.searchParams.get("lowStock") === "true" ? { onHand: { lte: 5 } } : {}),
      },
      include: { variant: { include: { product: true } }, warehouse: true },
      ...cursorArgs(page),
      orderBy: [{ onHand: "asc" }, { id: "asc" }],
    });
    return json(withCursor(rows, page));
  }

  if (path === "stores" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({ rows: await prisma.store.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null } }) });
  }
  if (path === "warehouses" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({ rows: await prisma.warehouse.findMany({ where: { organizationId: ctx.organizationId } }) });
  }
  if (path === "team" && method === "GET") {
    const ctx = await requireAuth(req);
    const rows = await prisma.agentProfile.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true } }, team: true },
    });
    return json({ rows });
  }
  if (path === "statuses" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({
      rows: await prisma.statusDefinition.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { sortOrder: "asc" },
      }),
    });
  }

  if (path === "call-center/queue" && method === "GET") {
    const ctx = await requirePermission("callcenter.work", req);
    const rows = await prisma.order.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["NEW", "TO_CONFIRM", "CALLING", "NO_ANSWER", "CALLBACK"] },
      },
      include: { customer: true, items: true, agent: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    return json({ rows });
  }
  if (path === "call-center/call" && method === "POST") {
    const ctx = await requirePermission("callcenter.work", req);
    const data = z.object({ orderId: z.string(), to: z.string(), notes: z.string().optional() }).parse(body);
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, organizationId: ctx.organizationId },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");
    const provider = phoneProvider();
    const result = await provider.makeCall({ to: data.to, orderId: data.orderId });
    await prisma.call.create({
      data: {
        orderId: data.orderId,
        agentId: ctx.userId,
        provider: provider.name,
        status: result.status,
        notes: data.notes,
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { callAttempts: { increment: 1 }, status: "CALLING" },
    });
    return json({ result, configured: provider.configured });
  }

  if (path === "inbox" && method === "GET") {
    const ctx = await requirePermission("inbox.read", req);
    const page = parsePage(url);
    const rows = await prisma.conversation.findMany({
      where: { organizationId: ctx.organizationId },
      include: { customer: true, messages: { orderBy: { createdAt: "desc" }, take: 50 } },
      orderBy: [{ lastAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    // Messages are fetched newest-first so the take limit keeps the latest of a
    // long thread, then flipped back for display.
    const result = withCursor(rows, page);
    return json({
      ...result,
      rows: result.rows.map((row) => ({ ...row, messages: [...row.messages].reverse() })),
    });
  }
  if (path.match(/^inbox\/[^/]+\/messages$/) && method === "POST") {
    const ctx = await requirePermission("inbox.write", req);
    const id = path.split("/")[1];
    const text = z.object({ text: z.string().min(1), channel: z.enum(["whatsapp", "sms"]).optional() }).parse(body);
    const conv = await prisma.conversation.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { customer: true },
    });
    if (!conv) throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    const channel = text.channel ?? (conv.channel === "sms" ? "sms" : "whatsapp");
    const sent = await messagingProvider(channel).sendMessage({ to: conv.customer.phone, text: text.text });
    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        from: "agent",
        text: text.text,
        providerId: sent.id,
        status: sent.status,
      },
    });
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessage: text.text, lastAt: new Date(), unread: 0 },
    });
    return json({ message, delivery: sent });
  }

  if (path === "shipments" && method === "GET") {
    const ctx = await requirePermission("shipping.read", req);
    const page = parsePage(url);
    const status = url.searchParams.get("status");
    const rows = await prisma.shipment.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(status ? { status } : {}),
        ...(url.searchParams.get("unsettled") === "true"
          ? { settledAt: null, status: "delivered" }
          : {}),
      },
      include: { order: { include: { customer: true } }, carrier: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    return json(withCursor(rows, page));
  }
  if (path === "shipments" && method === "POST") {
    const ctx = await requirePermission("shipping.dispatch", req);
    const data = z
      .object({ orderIds: z.array(z.string()).min(1).max(500), carrierId: z.string().optional() })
      .parse(body);
    const created = [];
    const failed: Array<{ orderId: string; message: string }> = [];
    for (const orderId of data.orderIds) {
      try {
        const result = await createShipmentForOrder({
          organizationId: ctx.organizationId,
          orderId,
          carrierId: data.carrierId,
          userId: ctx.userId,
        });
        if (result.created) created.push(result.shipment);
      } catch (err) {
        failed.push({ orderId, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    return json({ created, failed });
  }
  if (path === "carriers" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({ rows: await prisma.carrier.findMany({ where: { organizationId: ctx.organizationId } }) });
  }

  if (path === "returns" && method === "GET") {
    const ctx = await requirePermission("returns.read", req);
    const page = parsePage(url);
    const rows = await prisma.returnCase.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(url.searchParams.get("status") ? { status: url.searchParams.get("status")! } : {}),
      },
      include: { order: { include: { customer: true, items: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    return json(withCursor(rows, page));
  }
  if (path.match(/^returns\/[^/]+$/) && method === "PATCH") {
    const ctx = await requirePermission("returns.write", req);
    const id = path.split("/")[1];
    const status = z.object({ status: z.string() }).parse(body).status;
    const row = await prisma.returnCase.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { status },
    });
    if (!row.count) throw new ApiError(404, "NOT_FOUND", "Return not found.");
    return json({ ok: true });
  }

  if (path === "analytics/overview" && method === "GET") {
    const ctx = await requirePermission("analytics.read", req);
    const days = Number(url.searchParams.get("days") ?? 30);
    const to = new Date();
    const from = new Date(to.getTime() - days * 864e5);
    return json(await analytics.overview(ctx.organizationId, from, to, url.searchParams.get("storeId") ?? undefined));
  }

  if (path === "campaigns" && method === "GET") {
    const ctx = await requirePermission("marketing.read", req);
    const rows = await prisma.campaign.findMany({
      where: { organizationId: ctx.organizationId },
      include: { ads: { include: { spend: true } } },
    });
    return json({ rows });
  }

  if (path === "automations" && method === "GET") {
    const ctx = await requirePermission("automations.read", req);
    return json({ rows: await prisma.automation.findMany({ where: { organizationId: ctx.organizationId } }) });
  }
  if (path.match(/^automations\/[^/]+$/) && method === "PATCH") {
    const ctx = await requirePermission("automations.write", req);
    const id = path.split("/")[1];
    const enabled = z.object({ enabled: z.boolean() }).parse(body).enabled;
    await prisma.automation.updateMany({ where: { id, organizationId: ctx.organizationId }, data: { enabled } });
    return json({ ok: true });
  }

  if (path === "ai/ask" && method === "POST") {
    const ctx = await requirePermission("ai.use", req);
    await enforceRateLimit(`ai:${ctx.organizationId}`, RATE_LIMITS.aiAsk);
    const question = z.object({ question: z.string().min(2) }).parse(body).question;
    return json(await ai.ask(ctx.organizationId, question));
  }

  if (path === "integrations" && method === "GET") {
    const ctx = await requirePermission("integrations.manage", req);
    return json({ rows: await prisma.integration.findMany({ where: { organizationId: ctx.organizationId } }) });
  }

  if (path === "webhooks" && method === "GET") {
    const ctx = await requirePermission("integrations.manage", req);
    return json({
      rows: await prisma.webhookEndpoint.findMany({
        where: { organizationId: ctx.organizationId },
        include: { deliveries: { take: 10, orderBy: { createdAt: "desc" } } },
      }),
    });
  }
  if (path === "webhooks" && method === "POST") {
    const ctx = await requirePermission("integrations.manage", req);
    const data = z.object({ url: z.string().url(), events: z.array(z.string()) }).parse(body);
    const row = await prisma.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        url: data.url,
        secret: `whsec_${crypto.randomUUID()}`,
        events: data.events,
      },
    });
    return json(row, 201);
  }

  if (path === "search" && method === "GET") {
    const ctx = await requireAuth(req);
    const q = url.searchParams.get("q")?.trim();
    if (!q) return json({ orders: [], customers: [], products: [] });
    const [o, c, p] = await Promise.all([
      prisma.order.findMany({
        where: { organizationId: ctx.organizationId, number: { contains: q, mode: "insensitive" } },
        take: 8,
      }),
      prisma.customer.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }],
        },
        take: 8,
      }),
      prisma.product.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }],
        },
        take: 8,
      }),
    ]);
    return json({ orders: o, customers: c, products: p });
  }

  if (path === "notifications" && method === "GET") {
    const ctx = await requireAuth(req);
    const page = parsePage(url);
    const rows = await prisma.notification.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(url.searchParams.get("unread") === "true" ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    return json(withCursor(rows, page));
  }
  if (path === "tasks" && method === "GET") {
    const ctx = await requireAuth(req);
    const page = parsePage(url);
    const rows = await prisma.task.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(url.searchParams.get("status") ? { status: url.searchParams.get("status")! } : {}),
      },
      include: { assignee: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    return json(withCursor(rows, page));
  }
  if (path === "audit" && method === "GET") {
    const ctx = await requirePermission("settings.manage", req);
    const page = parsePage(url);
    const rows = await prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...cursorArgs(page),
    });
    return json(withCursor(rows, page));
  }
  if (path === "billing" && method === "GET") {
    const ctx = await requirePermission("billing.read", req);
    const sub = await prisma.subscription.findUnique({ where: { organizationId: ctx.organizationId } });
    return json({
      subscription: sub,
      stripe: process.env.STRIPE_SECRET_KEY
        ? "configured"
        : "INTEGRATION_NOT_CONNECTED — set STRIPE_SECRET_KEY to enable checkout",
    });
  }
  if (path === "users" && method === "GET") {
    const ctx = await requirePermission("users.manage", req);
    const rows = await prisma.membership.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: true, role: true },
    });
    return json({ rows });
  }
  if (path === "export/orders" && method === "GET") {
    const ctx = await requirePermission("orders.read", req);
    const status = url.searchParams.get("status");
    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    // Streamed in keyset pages: the response starts immediately and memory
    // stays flat regardless of how many orders the workspace has.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            toCsv([
              [
                "number",
                "status",
                "customer",
                "phone",
                "city",
                "total",
                "cod",
                "source",
                "agent",
                "awb",
                "createdAt",
              ],
            ]) + "\n",
          ),
        );

        let cursor: string | undefined;
        try {
          for (;;) {
            const batch = await prisma.order.findMany({
              where,
              include: {
                customer: { select: { name: true, phone: true, city: true } },
                agent: { select: { name: true } },
                shipments: { select: { awb: true }, take: 1, orderBy: { createdAt: "desc" } },
              },
              orderBy: { id: "asc" },
              take: 500,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            });
            if (!batch.length) break;

            controller.enqueue(
              encoder.encode(
                toCsv(
                  batch.map((o) => [
                    o.number,
                    o.status,
                    o.customer.name,
                    o.customer.phone,
                    o.customer.city,
                    Number(o.total),
                    Number(o.codAmount),
                    o.source,
                    o.agent?.name ?? "",
                    o.shipments[0]?.awb ?? "",
                    o.createdAt.toISOString(),
                  ]),
                ) + "\n",
              ),
            );
            cursor = batch[batch.length - 1].id;
            if (batch.length < 500) break;
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=orders-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  }

  if (path === "platform/organizations" && method === "GET") {
    await requirePlatformAdmin(req);
    const rows = await prisma.organization.findMany({
      include: { _count: { select: { orders: true, memberships: true, stores: true } }, subscription: true },
    });
    return json({ rows });
  }
  if (path === "platform/health" && method === "GET") {
    await requirePlatformAdmin(req);
    return json(await health());
  }
  if (path === "platform/users" && method === "GET") {
    await requirePlatformAdmin(req);
    return json({
      rows: await prisma.user.findMany({
        take: 100,
        select: { id: true, email: true, name: true, isPlatformAdmin: true, createdAt: true },
      }),
    });
  }

  if (path === "settings" && method === "GET") {
    const ctx = await requireAuth(req);
    const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
    return json({ organization: org, permissions: ctx.permissions, role: ctx.roleKey });
  }
  if (path === "settings" && method === "PATCH") {
    const ctx = await requirePermission("settings.manage", req);
    const data = z.object({ name: z.string().optional(), timezone: z.string().optional() }).parse(body);
    const org = await prisma.organization.update({ where: { id: ctx.organizationId }, data });
    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "settings.update",
      entity: "Organization",
      entityId: org.id,
      after: data,
    });
    return json(org);
  }

  if (path === "jobs/enqueue" && method === "POST") {
    const ctx = await requirePermission("settings.manage", req);
    const data = z.object({ queue: z.string(), payload: z.record(z.string(), z.unknown()).optional() }).parse(body);
    await enqueue(data.queue as "webhooks", { organizationId: ctx.organizationId, ...(data.payload ?? {}) });
    return json({ ok: true });
  }

  throw new ApiError(404, "NOT_FOUND", `No route for ${method} /api/v1/${path}`);
}
