import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { PERMISSIONS, permissionsForRole, ROLE_KEYS } from "../rbac/catalog";
import { DEFAULT_TRANSITIONS } from "../modules/orders/status";

export const DEFAULT_STATUSES = [
  { key: "NEW", label: "New", color: "sky", sortOrder: 0, category: "open" },
  { key: "TO_CONFIRM", label: "To confirm", color: "amber", sortOrder: 1, category: "open" },
  { key: "CALLING", label: "Calling", color: "amber", sortOrder: 2, category: "open" },
  { key: "NO_ANSWER", label: "No answer", color: "orange", sortOrder: 3, category: "open" },
  { key: "CALLBACK", label: "Callback", color: "orange", sortOrder: 4, category: "open" },
  { key: "CONFIRMED", label: "Confirmed", color: "emerald", sortOrder: 5, category: "open" },
  { key: "PREPARING", label: "Preparing", color: "indigo", sortOrder: 6, category: "open" },
  { key: "SHIPPED", label: "Shipped", color: "cyan", sortOrder: 7, category: "open" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", color: "blue", sortOrder: 8, category: "open" },
  { key: "DELIVERED", label: "Delivered", color: "emerald", sortOrder: 9, category: "closed", isTerminal: true },
  { key: "CANCELLED", label: "Cancelled", color: "zinc", sortOrder: 10, category: "closed", isTerminal: true },
  { key: "RETURNED", label: "Returned", color: "rose", sortOrder: 11, category: "closed", isTerminal: true },
];

export async function ensurePermissions() {
  for (const [key, module, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { module, name },
      create: { key, module, name },
    });
  }
}

export async function seedRolesForOrg(organizationId: string) {
  const perms = await prisma.permission.findMany();
  const byKey = Object.fromEntries(perms.map((p) => [p.key, p.id]));
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { name: key.replaceAll("_", " ") },
      create: {
        organizationId,
        key,
        name: key.replaceAll("_", " "),
        isSystem: true,
      },
    });
    const wanted = permissionsForRole(key);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (wanted.length) {
      await prisma.rolePermission.createMany({
        data: wanted
          .filter((k) => byKey[k])
          .map((k) => ({ roleId: role.id, permissionId: byKey[k] })),
      });
    }
  }
}

export async function seedStatuses(organizationId: string) {
  const existing = await prisma.statusDefinition.findMany({
    where: { organizationId },
    select: { key: true, allowedNext: true },
  });
  const byKey = new Map(existing.map((row) => [row.key, row]));

  for (const status of DEFAULT_STATUSES) {
    const current = byKey.get(status.key);
    const allowedNext = DEFAULT_TRANSITIONS[status.key] ?? [];
    if (!current) {
      await prisma.statusDefinition.create({
        data: { organizationId, ...status, allowedNext },
      });
      continue;
    }
    // Only fill in a missing transition list. An organization that has edited
    // its own flow keeps it.
    if (current.allowedNext.length === 0 && allowedNext.length) {
      await prisma.statusDefinition.update({
        where: { organizationId_key: { organizationId, key: status.key } },
        data: { allowedNext },
      });
    }
  }
}

/**
 * Re-applies the permission catalog to every workspace. Adding a permission to
 * `PERMISSIONS` only affects new organizations otherwise, so this runs on
 * deploy (`npm run db:sync-rbac`) to backfill existing ones.
 */
export async function syncAllOrganizations() {
  await ensurePermissions();
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    await seedRolesForOrg(org.id);
    await seedStatuses(org.id);
  }
  return { organizations: orgs.length };
}

export function orgWhere(organizationId: string): { organizationId: string } {
  return { organizationId };
}

export type JsonValue = Prisma.InputJsonValue;
