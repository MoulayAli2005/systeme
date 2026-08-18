import { z } from "zod";
import { prisma } from "../db";
import { ApiError } from "../http";
import { hashPassword, verifyPassword, createSession, destroySession, getTokenFromRequest } from "./session";
import { writeAudit } from "../audit";
import { seedRolesForOrg, seedStatuses, ensurePermissions } from "../org/bootstrap";
import { generateSecret, generateURI, verifySync } from "otplib";
import { encryptSecret, decryptSecret, sha256, randomToken } from "../crypto";
import { env } from "../env";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2),
});

export async function register(input: unknown, ip?: string, ua?: string) {
  const data = registerSchema.parse(input);
  const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (exists) throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.");
  await ensurePermissions();
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: await hashPassword(data.password),
    },
  });
  const slug = data.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) + "-" + user.id.slice(0, 6);
  const org = await prisma.organization.create({
    data: { name: data.organizationName, slug },
  });
  await seedRolesForOrg(org.id);
  await seedStatuses(org.id);
  const owner = await prisma.role.findFirst({ where: { organizationId: org.id, key: "owner" } });
  await prisma.membership.create({
    data: { organizationId: org.id, userId: user.id, roleId: owner!.id },
  });
  await prisma.subscription.create({ data: { organizationId: org.id, plan: "FREE" } });
  const verify = randomToken();
  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash: sha256(verify), expiresAt: new Date(Date.now() + 864e5) },
  });
  const session = await createSession(user.id, org.id, ip, ua);
  await writeAudit({ organizationId: org.id, userId: user.id, action: "auth.register", entity: "User", entityId: user.id, ip });
  return { session, user: { id: user.id, email: user.email, name: user.name }, organization: org, verifyToken: verify };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function login(input: unknown, ip?: string, ua?: string) {
  const data = loginSchema.parse(input);
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user?.passwordHash || user.deletedAt) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) {
    await prisma.loginEvent.create({
      data: { userId: user.id, ip, userAgent: ua, success: false, reason: "bad_password" },
    });
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  if (user.totpEnabled) {
    if (!data.totp || !user.totpSecretEnc) throw new ApiError(401, "TOTP_REQUIRED", "Two-factor code required.");
    const secret = decryptSecret(user.totpSecretEnc);
    const totp = verifySync({ secret, token: data.totp });
    if (!totp.valid) throw new ApiError(401, "TOTP_INVALID", "Invalid authenticator code.");
  }
  const orgId =
    data.organizationId ??
    user.memberships[0]?.organizationId ??
    (user.isPlatformAdmin ? null : null);
  if (!orgId && !user.isPlatformAdmin) throw new ApiError(403, "NO_ORG", "No workspace membership.");
  const session = await createSession(user.id, orgId, ip, ua);
  await prisma.loginEvent.create({
    data: { userId: user.id, ip, userAgent: ua, success: true },
  });
  return {
    session,
    user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin },
    organizations: user.memberships.map((m) => m.organization),
  };
}

export async function logout(req: Request) {
  const token = await getTokenFromRequest(req);
  if (token) await destroySession(token);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return { ok: true };
  const token = randomToken();
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
  });
  const { enqueue } = await import("../jobs/queues");
  await enqueue("email", {
    to: email,
    subject: "Reset your Nexora password",
    text: `Use this token in /reset: ${token}`,
  });
  return { ok: true, demoToken: env.NODE_ENV === "development" ? token : undefined };
}

export async function resetPassword(token: string, password: string) {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new ApiError(400, "INVALID_TOKEN", "Reset link expired.");
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: row.userId } });
}

export async function verifyEmail(token: string) {
  const row = await prisma.emailVerification.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.expiresAt < new Date()) throw new ApiError(400, "INVALID_TOKEN", "Verification link expired.");
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function setup2fa(userId: string) {
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: encryptSecret(secret), totpEnabled: false },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const otpauth = generateURI({ issuer: "Nexora", label: user.email, secret });
  return { secret, otpauth };
}

export async function enable2fa(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecretEnc) throw new ApiError(400, "NO_SECRET", "Start 2FA setup first.");
  const totp = verifySync({ secret: decryptSecret(user.totpSecretEnc), token: code });
  if (!totp.valid) {
    throw new ApiError(400, "TOTP_INVALID", "Invalid authenticator code.");
  }
  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
}

export function googleOAuthUrl() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(501, "INTEGRATION_NOT_CONNECTED", "Google OAuth is not configured.");
  }
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  u.searchParams.set("redirect_uri", `${env.APP_URL}/api/v1/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "email profile");
  return u.toString();
}
