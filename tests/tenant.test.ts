import { describe, expect, it } from "vitest";
import "dotenv/config";
import { prisma } from "../server/db";

describe("tenant isolation", () => {
  it("keeps Atlas and Casa Home orders apart", async () => {
    const orgs = await prisma.organization.findMany({ select: { id: true, slug: true } });
    if (orgs.length < 2) return;
    const [a, b] = orgs;
    const aCount = await prisma.order.count({ where: { organizationId: a.id } });
    const leak = await prisma.order.count({
      where: { organizationId: a.id, store: { organizationId: b.id } },
    });
    expect(aCount).toBeGreaterThan(0);
    expect(leak).toBe(0);
  });
});
