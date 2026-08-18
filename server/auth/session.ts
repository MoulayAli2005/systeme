import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../crypto";
import {
  API_KEY_DEFAULT_SCOPES,
  API_KEY_GRANTABLE,
  isPermissionKey,
  type PermissionKey,
} from "../rbac/catalog";

export const COOKIE = "nexora_session";
const SESSION_DAYS = 14;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, organizationId: string | null, ip?: string, ua?: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({
    data: {
      userId,
      organizationId,
      tokenHash: sha256(token),
      ip,
      userAgent: ua?.slice(0, 300),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  organizationId: string;
  organizationName: string;
  roleKey: string;
  permissions: PermissionKey[];
  /** Set when the caller authenticated with an API key rather than a session. */
  apiKeyId?: string;
};

export async function getTokenFromRequest(req?: Request) {
  if (req) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) return header.slice(7);
    const apiKey = req.headers.get("x-api-key");
    if (apiKey) return apiKey;
    const cookie = req.headers.get("cookie") ?? "";
    const match = cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`));
    if (match) return decodeURIComponent(match.split("=")[1] ?? "");
  }
  const jar = await cookies();
  return jar.get(COOKIE)?.value;
}

export async function resolveAuth(req?: Request): Promise<AuthContext | null> {
  const token = await getTokenFromRequest(req);
  if (!token) return null;
  if (token.startsWith("nxk_")) return resolveApiKey(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;

  const orgId = session.organizationId;
  if (!orgId) {
    if (session.user.isPlatformAdmin) {
      return {
        userId: session.userId,
        email: session.user.email,
        name: session.user.name,
        isPlatformAdmin: true,
        organizationId: "",
        organizationName: "Platform",
        roleKey: "platform",
        permissions: [],
      };
    }
    return null;
  }
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: session.userId } },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      organization: true,
    },
  });
  if (!membership || membership.status !== "active") return null;

  return {
    userId: session.userId,
    email: session.user.email,
    name: session.user.name,
    isPlatformAdmin: session.user.isPlatformAdmin,
    organizationId: orgId,
    organizationName: membership.organization.name,
    roleKey: membership.role.key,
    permissions: membership.role.permissions.map((p) => p.permission.key) as PermissionKey[],
  };
}

/** Avoids a write on every single API call just to refresh a timestamp. */
const LAST_USED_THROTTLE_MS = 60_000;

async function resolveApiKey(token: string): Promise<AuthContext | null> {
  const key = await prisma.apiKey.findUnique({ where: { hash: sha256(token) } });
  if (!key || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: key.organizationId, role: { key: "owner" }, status: "active" },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      organization: true,
      user: true,
    },
  });
  if (!membership) return null;

  // A key is the intersection of three things: what its scopes ask for, what
  // the workspace owner can do, and what any key is ever allowed to do. It is
  // never simply "whatever the owner can do", which is what it used to be.
  const requested = key.scopes.length
    ? (key.scopes.filter(isPermissionKey) as PermissionKey[])
    : API_KEY_DEFAULT_SCOPES;
  const ownerPermissions = new Set(membership.role.permissions.map((p) => p.permission.key));
  const grantable = new Set<string>(API_KEY_GRANTABLE);
  const permissions = requested.filter((p) => ownerPermissions.has(p) && grantable.has(p));

  return {
    userId: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    isPlatformAdmin: false,
    organizationId: key.organizationId,
    organizationName: membership.organization.name,
    roleKey: `api_key:${key.prefix}`,
    permissions,
    apiKeyId: key.id,
  };
}

export async function requireAuth(req?: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) throw new ApiError(401, "UNAUTHENTICATED", "Sign in required.");
  return ctx;
}

export async function requirePermission(key: PermissionKey, req?: Request) {
  const ctx = await requireAuth(req);
  if (ctx.isPlatformAdmin) return ctx;
  if (!ctx.permissions.includes(key)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this action.");
  }
  return ctx;
}

export async function requirePlatformAdmin(req?: Request) {
  const ctx = await requireAuth(req);
  if (!ctx.isPlatformAdmin) throw new ApiError(403, "FORBIDDEN", "Platform admin only.");
  return ctx;
}

export function sessionCookie(token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === "production";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
