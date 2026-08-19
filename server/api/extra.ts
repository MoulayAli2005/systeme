import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, json } from "../http";
import { prisma } from "../db";
import { hashPassword, requireAuth, requirePermission } from "../auth/session";
import { randomToken, sha256 } from "../crypto";
import { writeAudit } from "../audit";
import { env } from "../env";
import { PLANS } from "../modules/billing/plans";
import { API_KEY_DEFAULT_SCOPES, API_KEY_GRANTABLE, isPermissionKey } from "../rbac/catalog";
import { adjustStock } from "../modules/inventory/service";
import { assignNext, setPresence, type DispatchStrategy } from "../modules/call-center/dispatch";
import { agentLeaderboard } from "../modules/analytics/service";
import { providerStatus } from "../providers/registry";
import * as orders from "../modules/orders/service";
import {
  WHATSAPP_PRESETS,
  presetActions,
  presetById,
  presetConditions,
} from "../modules/automations/whatsapp";

export async function handleExtra(
  req: NextRequest,
  method: string,
  path: string,
  url: URL,
  body: unknown,
  ip: string,
): Promise<Response | null> {
  if (path === "auth/sessions" && method === "GET") {
    const ctx = await requireAuth(req);
    const rows = await prisma.session.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true, organizationId: true },
    });
    return json({ rows });
  }
  if (path.match(/^auth\/sessions\/[^/]+$/) && method === "DELETE") {
    const ctx = await requireAuth(req);
    const id = path.split("/")[2];
    await prisma.session.deleteMany({ where: { id, userId: ctx.userId } });
    return json({ ok: true });
  }
  if (path === "auth/login-history" && method === "GET") {
    const ctx = await requireAuth(req);
    const rows = await prisma.loginEvent.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return json({ rows });
  }
  if (path === "auth/switch-org" && method === "POST") {
    const ctx = await requireAuth(req);
    const organizationId = z.object({ organizationId: z.string() }).parse(body).organizationId;
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: ctx.userId } },
    });
    if (!membership) throw new ApiError(403, "FORBIDDEN", "No membership in that workspace.");
    const token = req.headers.get("cookie")?.match(/nexora_session=([^;]+)/)?.[1];
    if (token) {
      await prisma.session.updateMany({
        where: { tokenHash: sha256(decodeURIComponent(token)), userId: ctx.userId },
        data: { organizationId },
      });
    }
    return json({ ok: true, organizationId });
  }
  if (path === "auth/google/callback" && method === "GET") {
    const code = url.searchParams.get("code");
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new ApiError(501, "INTEGRATION_NOT_CONNECTED", "Google OAuth is not configured.");
    }
    if (!code) throw new ApiError(400, "BAD_REQUEST", "Missing OAuth code.");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.APP_URL}/api/v1/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new ApiError(401, "OAUTH_FAILED", "Google token exchange failed.");
    const tokens = (await tokenRes.json()) as { access_token: string };
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as { email?: string; name?: string };
    if (!profile.email) throw new ApiError(401, "OAUTH_FAILED", "Google profile missing email.");
    return json({
      email: profile.email,
      name: profile.name,
      next: "Complete sign-in by registering or linking this email in Nexora. Account linking UI is in Settings.",
    });
  }

  if (path === "products" && method === "POST") {
    const ctx = await requirePermission("products.write", req);
    const data = z
      .object({
        name: z.string().min(2),
        sku: z.string().min(2),
        price: z.number(),
        cost: z.number().optional(),
        category: z.string().optional(),
      })
      .parse(body);
    const warehouse = await prisma.warehouse.findFirst({
      where: { organizationId: ctx.organizationId, isDefault: true },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        sku: data.sku,
        price: data.price,
        cost: data.cost ?? 0,
        category: data.category,
        variants: {
          create: {
            name: "Default",
            sku: `${data.sku}-DEF`,
            price: data.price,
            cost: data.cost ?? 0,
          },
        },
      },
      include: { variants: true },
    });
    if (warehouse && product.variants[0]) {
      await prisma.inventoryItem.create({
        data: {
          organizationId: ctx.organizationId,
          warehouseId: warehouse.id,
          variantId: product.variants[0].id,
          onHand: 0,
        },
      });
    }
    return json(product, 201);
  }

  if (path === "customers" && method === "POST") {
    const ctx = await requirePermission("customers.write", req);
    const data = z
      .object({
        name: z.string(),
        phone: z.string(),
        city: z.string(),
        address: z.string().optional(),
        email: z.string().email().optional(),
      })
      .parse(body);
    const row = await prisma.customer.create({
      data: { organizationId: ctx.organizationId, ...data },
    });
    return json(row, 201);
  }
  if (path.match(/^customers\/[^/]+$/) && method === "PATCH") {
    const ctx = await requirePermission("customers.write", req);
    const id = path.split("/")[1];
    const data = z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(body);
    const row = await prisma.customer.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data,
    });
    if (!row.count) throw new ApiError(404, "NOT_FOUND", "Customer not found.");
    return json({ ok: true });
  }

  if (path === "inventory/adjust" && method === "POST") {
    const ctx = await requirePermission("inventory.write", req);
    const data = z
      .object({
        itemId: z.string(),
        quantity: z.number().int(),
        type: z.enum(["adjust", "receive", "damage", "return", "reserve", "release"]),
        reason: z.string().optional(),
      })
      .parse(body);
    return json(await adjustStock({ organizationId: ctx.organizationId, ...data }));
  }

  if (path === "automations/whatsapp" && method === "GET") {
    const ctx = await requirePermission("automations.read", req);
    const rows = await prisma.automation.findMany({ where: { organizationId: ctx.organizationId } });
    const whatsapp = providerStatus().whatsapp;
    return json({
      configured: whatsapp.configured,
      provider: whatsapp.name,
      presets: WHATSAPP_PRESETS.map((preset) => {
        const row = rows.find((r) => {
          const conditions = (r.conditions ?? {}) as Record<string, unknown>;
          return conditions.preset === preset.id || r.name === preset.name;
        });
        return {
          ...preset,
          enabled: row?.enabled ?? false,
          automationId: row?.id ?? null,
          runsToday: row?.runsToday ?? 0,
        };
      }),
    });
  }

  if (path === "automations/whatsapp" && method === "POST") {
    const ctx = await requirePermission("automations.write", req);
    const data = z.object({ id: z.string(), enabled: z.boolean() }).parse(body);
    const preset = presetById(data.id);
    if (!preset) throw new ApiError(404, "NOT_FOUND", "Unknown WhatsApp automation.");
    const existing = await prisma.automation.findMany({ where: { organizationId: ctx.organizationId } });
    const row = existing.find((r) => {
      const conditions = (r.conditions ?? {}) as Record<string, unknown>;
      return conditions.preset === preset.id || r.name === preset.name;
    });
    if (row) {
      await prisma.automation.update({ where: { id: row.id }, data: { enabled: data.enabled } });
      return json({ ok: true, id: row.id, enabled: data.enabled });
    }
    if (!data.enabled) return json({ ok: true, enabled: false });
    const created = await prisma.automation.create({
      data: {
        organizationId: ctx.organizationId,
        name: preset.name,
        trigger: preset.trigger,
        conditions: presetConditions(preset),
        actions: presetActions(preset),
        enabled: true,
      },
    });
    return json({ ok: true, id: created.id, enabled: true }, 201);
  }

  if (path === "automations" && method === "POST") {
    const ctx = await requirePermission("automations.write", req);
    const data = z
      .object({
        name: z.string(),
        trigger: z.string(),
        conditions: z.record(z.string(), z.unknown()).optional(),
        actions: z.array(z.record(z.string(), z.string())),
      })
      .parse(body);
    const row = await prisma.automation.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        trigger: data.trigger,
        conditions: (data.conditions ?? {}) as object,
        actions: data.actions,
      },
    });
    return json(row, 201);
  }

  if (path === "tasks" && method === "POST") {
    const ctx = await requireAuth(req);
    const data = z
      .object({
        title: z.string().min(2),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        orderId: z.string().optional(),
        priority: z.string().optional(),
        dueAt: z.string().optional(),
      })
      .parse(body);
    const row = await prisma.task.create({
      data: {
        organizationId: ctx.organizationId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        creatorId: ctx.userId,
        orderId: data.orderId,
        priority: data.priority ?? "medium",
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      },
    });
    return json(row, 201);
  }
  if (path.match(/^tasks\/[^/]+$/) && method === "PATCH") {
    const ctx = await requireAuth(req);
    const id = path.split("/")[1];
    const data = z.object({ status: z.string().optional(), title: z.string().optional() }).parse(body);
    await prisma.task.updateMany({ where: { id, organizationId: ctx.organizationId }, data });
    return json({ ok: true });
  }

  if (path === "returns" && method === "POST") {
    const ctx = await requirePermission("returns.write", req);
    const data = z
      .object({ orderId: z.string(), reason: z.string().optional(), refundAmount: z.number().optional() })
      .parse(body);
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, organizationId: ctx.organizationId },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");
    const row = await prisma.returnCase.create({
      data: {
        organizationId: ctx.organizationId,
        orderId: order.id,
        reason: data.reason,
        refundAmount: data.refundAmount,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "RETURNED" } });
    return json(row, 201);
  }

  if (path.match(/^orders\/[^/]+\/notes$/) && method === "POST") {
    const ctx = await requirePermission("orders.write", req);
    const id = path.split("/")[1];
    const note = z.object({ note: z.string().min(1) }).parse(body).note;
    const order = await prisma.order.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");
    await prisma.orderEvent.create({
      data: { orderId: order.id, title: "Note", detail: note, actorId: ctx.userId },
    });
    await prisma.order.update({ where: { id: order.id }, data: { notes: note } });
    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "order.note",
      entity: "Order",
      entityId: order.id,
      after: { note },
      ip,
    });
    return json({ ok: true });
  }

  if (path === "call-center/presence" && method === "POST") {
    const ctx = await requirePermission("callcenter.work", req);
    const state = z.object({ state: z.string() }).parse(body).state;
    return json(await setPresence(ctx.organizationId, ctx.userId, state));
  }
  if (path === "call-center/assign" && method === "POST") {
    const ctx = await requirePermission("callcenter.manage", req);
    const data = z
      .object({
        strategy: z.enum(["round_robin", "least_loaded", "performance", "random", "manual"]).optional(),
        agentId: z.string().optional(),
      })
      .parse(body);
    return json(
      await assignNext({
        organizationId: ctx.organizationId,
        strategy: (data.strategy ?? "round_robin") as DispatchStrategy,
        agentId: data.agentId,
      }),
    );
  }
  if (path === "call-center/next" && method === "GET") {
    const ctx = await requirePermission("callcenter.work", req);
    return json(await assignNext({ organizationId: ctx.organizationId, strategy: "least_loaded" }));
  }

  if (path === "api-keys" && method === "GET") {
    const ctx = await requirePermission("integrations.manage", req);
    const rows = await prisma.apiKey.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return json({
      rows: rows.map((row) => ({
        ...row,
        // Surfaced so the UI can explain what a key with no explicit scopes can do.
        effectiveScopes: row.scopes.length ? row.scopes : API_KEY_DEFAULT_SCOPES,
      })),
      grantable: API_KEY_GRANTABLE,
    });
  }
  if (path === "api-keys" && method === "POST") {
    const ctx = await requirePermission("integrations.manage", req);
    const data = z
      .object({
        name: z.string().min(2),
        scopes: z.array(z.string()).optional(),
        expiresInDays: z.number().int().positive().max(3650).optional(),
      })
      .parse(body);

    const requested = data.scopes?.filter(isPermissionKey) ?? [];
    const rejected = (data.scopes ?? []).filter((s) => !API_KEY_GRANTABLE.includes(s as never));
    if (rejected.length) {
      throw new ApiError(
        400,
        "SCOPE_NOT_GRANTABLE",
        `These scopes cannot be given to an API key: ${rejected.join(", ")}.`,
      );
    }

    const secret = `nxk_${randomToken(24)}`;
    const row = await prisma.apiKey.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        prefix: secret.slice(0, 12),
        hash: sha256(secret),
        scopes: requested,
        expiresAt: data.expiresInDays
          ? new Date(Date.now() + data.expiresInDays * 864e5)
          : null,
      },
    });
    await writeAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api_key.create",
      entity: "ApiKey",
      entityId: row.id,
      after: { scopes: requested, expiresAt: row.expiresAt },
      ip,
    });
    // The secret is shown once; only its hash is stored.
    return json(
      { id: row.id, prefix: row.prefix, secret, scopes: requested, expiresAt: row.expiresAt },
      201,
    );
  }
  if (path.match(/^api-keys\/[^/]+$/) && method === "DELETE") {
    const ctx = await requirePermission("integrations.manage", req);
    const id = path.split("/")[1];
    await prisma.apiKey.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { revokedAt: new Date() },
    });
    return json({ ok: true });
  }

  if (path === "billing/plans" && method === "GET") {
    await requireAuth(req);
    return json({ plans: PLANS });
  }
  if (path === "billing/checkout" && method === "POST") {
    await requirePermission("billing.read", req);
    if (!env.STRIPE_SECRET_KEY) {
      throw new ApiError(
        501,
        "INTEGRATION_NOT_CONNECTED",
        "Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout.",
      );
    }
    return json({ url: null, message: "Stripe checkout session would be created here with the configured secret." });
  }

  if (path === "templates" && method === "GET") {
    const ctx = await requireAuth(req);
    return json({
      rows: await prisma.messageTemplate.findMany({ where: { organizationId: ctx.organizationId } }),
    });
  }

  if (path === "analytics/agents" && method === "GET") {
    const ctx = await requirePermission("analytics.read", req);
    const days = Number(url.searchParams.get("days") ?? 30);
    const to = new Date();
    const from = new Date(to.getTime() - days * 864e5);
    return json({ rows: await agentLeaderboard(ctx.organizationId, from, to) });
  }

  if (path === "providers" && method === "GET") {
    await requireAuth(req);
    const status = providerStatus();
    return json({
      rows: Object.entries(status)
        .filter(([k]) => k !== "demoMode")
        .map(([kind, p]) => ({
          kind,
          name: typeof p === "object" && p && "name" in p ? p.name : kind,
          configured: typeof p === "object" && p && "configured" in p ? p.configured : false,
        })),
      demoMode: status.demoMode,
    });
  }

  if (path.match(/^notifications\/[^/]+\/read$/) && method === "POST") {
    const ctx = await requireAuth(req);
    const id = path.split("/")[1];
    await prisma.notification.updateMany({
      where: { id, organizationId: ctx.organizationId },
      data: { readAt: new Date() },
    });
    return json({ ok: true });
  }

  if (path === "users" && method === "POST") {
    const ctx = await requirePermission("users.manage", req);
    const data = z
      .object({
        email: z.string().email(),
        name: z.string(),
        roleKey: z.string(),
        password: z.string().min(8).optional(),
      })
      .parse(body);
    const role = await prisma.role.findFirst({
      where: { organizationId: ctx.organizationId, key: data.roleKey },
    });
    if (!role) throw new ApiError(400, "BAD_REQUEST", "Unknown role.");
    const passwordHash = await hashPassword(data.password ?? randomToken(8));
    const user = await prisma.user.upsert({
      where: { email: data.email.toLowerCase() },
      update: { name: data.name },
      create: { email: data.email.toLowerCase(), name: data.name, passwordHash },
    });
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: ctx.organizationId, userId: user.id } },
      update: { roleId: role.id },
      create: { organizationId: ctx.organizationId, userId: user.id, roleId: role.id },
    });
    const profile = await prisma.agentProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      await prisma.agentProfile.create({
        data: { organizationId: ctx.organizationId, userId: user.id, state: "offline" },
      });
    }
    return json({ user: { id: user.id, email: user.email, name: user.name } }, 201);
  }

  if (path === "statuses" && method === "POST") {
    const ctx = await requirePermission("settings.manage", req);
    const data = z
      .object({ key: z.string(), label: z.string(), color: z.string().optional(), category: z.string().optional() })
      .parse(body);
    const row = await prisma.statusDefinition.create({
      data: {
        organizationId: ctx.organizationId,
        key: data.key.toUpperCase().replace(/\s+/g, "_"),
        label: data.label,
        color: data.color ?? "zinc",
        category: data.category ?? "open",
        sortOrder: 50,
      },
    });
    return json(row, 201);
  }

  return null;
}
