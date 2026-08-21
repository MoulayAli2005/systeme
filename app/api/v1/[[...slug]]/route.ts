import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, json, parsePage, ApiError } from "@/server/http";
import { requireAuth, requirePermission, requirePlatformAdmin, sessionCookie, clearSessionCookie, resolveAuth } from "@/server/auth/session";
import * as auth from "@/server/auth/service";
import * as orders from "@/server/modules/orders/service";
import * as analytics from "@/server/modules/analytics/service";
import * as ai from "@/server/modules/ai/service";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { messagingProvider, phoneProvider, shippingProvider } from "@/server/providers/registry";
import { enqueue } from "@/server/jobs/queues";
import { health } from "@/server/health";
import { handleExtra } from "@/server/api/extra";

export const dynamic = "force-dynamic";

const hits = new Map<string, { n: number; t: number }>();
function rateLimit(key: string, limit = 30) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now - row.t > 60_000) {
    hits.set(key, { n: 1, t: now });
    return;
  }
  row.n += 1;
  if (row.n > limit) throw new ApiError(429, "RATE_LIMIT", "Too many requests.");
}

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

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
  try {
    const slug = params.slug ?? [];
    const path = slug.join("/");
    const url = new URL(req.url);
    let body: unknown = null;
    if (method !== "GET" && method !== "DELETE") {
      body = await req.json().catch(() => null);
    }
    return await route(req, method, path, url, body);
  } catch (err) {
    return errorResponse(err);
  }
}

async function route(req: NextRequest, method: string, path: string, url: URL, body: unknown): Promise<Response> {
  const extra = await handleExtra(req, method, path, url, body, ip(req));
  if (extra) return extra;

  if (path.startsWith("track/") && method === "GET") {
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
    rateLimit(`reg:${ip(req)}`, 10);
    const result = await auth.register(body, ip(req), req.headers.get("user-agent") ?? undefined);
    const res = json({ user: result.user, organization: result.organization });
    res.headers.set("Set-Cookie", sessionCookie(result.session.token, result.session.expiresAt));
    return res;
  }
  if (path === "auth/login" && method === "POST") {
    rateLimit(`login:${ip(req)}`, 20);
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
    const status = z.object({ status: z.string(), note: z.string().optional() }).parse(body);
    return json(
      await orders.changeStatus({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        id,
        status: status.status,
        note: status.note,
        ip: ip(req),
      }),
    );
  }
  if (path === "orders/bulk" && method === "POST") {
    const ctx = await requirePermission("orders.bulk", req);
    const data = z
      .object({
        ids: z.array(z.string()).min(1),
        action: z.enum(["status", "assign", "tag", "untag", "whatsapp", "sms", "ship"]),
        value: z.string().optional(),
      })
      .parse(body);
    return json(await orders.bulkOrders({ organizationId: ctx.organizationId, userId: ctx.userId, ...data }));
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
      take: page.take,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    return json({ rows });
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
        ...(page.q ? { name: { contains: page.q, mode: "insensitive" } } : {}),
      },
      take: page.take,
      include: { variants: { include: { inventory: true } } },
      orderBy: { name: "asc" },
    });
    return json({ rows });
  }

  if (path === "inventory" && method === "GET") {
    const ctx = await requirePermission("inventory.read", req);
    const rows = await prisma.inventoryItem.findMany({
      where: { organizationId: ctx.organizationId },
      include: { variant: { include: { product: true } }, warehouse: true },
      take: 200,
    });
    return json({ rows });
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
    const rows = await prisma.conversation.findMany({
      where: { organizationId: ctx.organizationId },
      include: { customer: true, messages: { orderBy: { createdAt: "asc" }, take: 50 } },
      orderBy: { lastAt: "desc" },
      take: 50,
    });
    return json({ rows });
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
    const rows = await prisma.shipment.findMany({
      where: { organizationId: ctx.organizationId },
      include: { order: { include: { customer: true } }, carrier: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json({ rows });
  }
  if (path === "shipments" && method === "POST") {
    const ctx = await requirePermission("shipping.dispatch", req);
    const data = z.object({ orderIds: z.array(z.string()), carrierId: z.string().optional() }).parse(body);
    const created = [];
    for (const orderId of data.orderIds) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, organizationId: ctx.organizationId },
        include: { customer: true },
      });
      if (!order) continue;
      const ship = await shippingProvider().createShipment({
        orderId: order.id,
        city: order.customer.city,
        address: order.customer.address ?? order.customer.city,
        phone: order.customer.phone,
        codAmount: Number(order.codAmount),
      });
      created.push(
        await prisma.shipment.create({
          data: {
            organizationId: ctx.organizationId,
            orderId: order.id,
            carrierId: data.carrierId,
            awb: ship.awb,
            trackingUrl: ship.trackingUrl,
          },
        }),
      );
      await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
    }
    return json({ created });
  }
  if (path === "carriers" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({ rows: await prisma.carrier.findMany({ where: { organizationId: ctx.organizationId } }) });
  }

  if (path === "returns" && method === "GET") {
    const ctx = await requirePermission("returns.read", req);
    const rows = await prisma.returnCase.findMany({
      where: { organizationId: ctx.organizationId },
      include: { order: { include: { customer: true, items: true } } },
      orderBy: { createdAt: "desc" },
    });
    return json({ rows });
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
    const rows = await prisma.automation.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        runs: { take: 5, orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true } },
      },
    });
    return json({ rows });
  }
  if (path.match(/^automations\/[^/]+\/runs$/) && method === "GET") {
    const ctx = await requirePermission("automations.read", req);
    const id = path.split("/")[1];
    const rule = await prisma.automation.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!rule) throw new ApiError(404, "NOT_FOUND", "Automation not found.");
    const rows = await prisma.automationRun.findMany({
      where: { automationId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return json({ rows });
  }
  if (path.match(/^automations\/[^/]+$/) && method === "PATCH") {
    const ctx = await requirePermission("automations.write", req);
    const id = path.split("/")[1];
    const data = z
      .object({
        enabled: z.boolean().optional(),
        name: z.string().min(1).optional(),
        trigger: z.string().optional(),
        conditions: z.record(z.string(), z.unknown()).optional(),
        actions: z.array(z.record(z.string(), z.string())).optional(),
      })
      .parse(body);
    const existing = await prisma.automation.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Automation not found.");
    const row = await prisma.automation.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.trigger !== undefined ? { trigger: data.trigger } : {}),
        ...(data.conditions !== undefined ? { conditions: data.conditions as object } : {}),
        ...(data.actions !== undefined ? { actions: data.actions } : {}),
      },
    });
    return json(row);
  }
  if (path.match(/^automations\/[^/]+$/) && method === "DELETE") {
    const ctx = await requirePermission("automations.write", req);
    const id = path.split("/")[1];
    const deleted = await prisma.automation.deleteMany({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!deleted.count) throw new ApiError(404, "NOT_FOUND", "Automation not found.");
    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "automation.delete",
      entity: "Automation",
      entityId: id,
    });
    return json({ ok: true });
  }

  if (path === "ai/ask" && method === "POST") {
    const ctx = await requirePermission("ai.use", req);
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
    return json({
      rows: await prisma.notification.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    });
  }
  if (path === "tasks" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({
      rows: await prisma.task.findMany({
        where: { organizationId: ctx.organizationId },
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    });
  }
  if (path === "audit" && method === "GET") {
    const ctx = await requirePermission("settings.manage", req);
    return json({
      rows: await prisma.auditLog.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    });
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
    const rows = await prisma.order.findMany({
      where: { organizationId: ctx.organizationId },
      include: { customer: true, items: true },
      take: 5000,
    });
    const header = "number,status,customer,phone,city,total,source,createdAt";
    const csv = [
      header,
      ...rows.map((o) =>
        [o.number, o.status, o.customer.name, o.customer.phone, o.customer.city, o.total, o.source, o.createdAt.toISOString()].join(","),
      ),
    ].join("\n");
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=orders.csv" },
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
