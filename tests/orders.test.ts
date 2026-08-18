import { describe, expect, it } from "vitest";
import "dotenv/config";
import { prisma } from "../server/db";
import { getOrder, createOrder } from "../server/modules/orders/service";

describe("order tenant isolation", () => {
  it("refuses to load a Casa Home order under Atlas", async () => {
    const atlas = await prisma.organization.findFirst({ where: { slug: "atlas-atelier" } });
    const casa = await prisma.organization.findFirst({ where: { slug: "casa-home" } });
    if (!atlas || !casa) return;
    const casaOrder = await prisma.order.findFirst({ where: { organizationId: casa.id } });
    if (!casaOrder) return;
    await expect(getOrder(atlas.id, casaOrder.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates an order scoped to the organization", async () => {
    const atlas = await prisma.organization.findFirst({ where: { slug: "atlas-atelier" } });
    const user = await prisma.user.findFirst({ where: { email: "amine@atlasatelier.ma" } });
    if (!atlas || !user) return;
    const phone = `+2126${Date.now().toString().slice(-8)}`;
    const result = await createOrder({
      organizationId: atlas.id,
      userId: user.id,
      customer: { name: "Test Isolation", phone, city: "Casablanca", address: "Test street" },
      items: [{ name: "Test SKU", quantity: 1, price: 199 }],
    });
    expect(result.order.organizationId).toBe(atlas.id);
    expect(result.order.number).toMatch(/^NX-/);
    const leak = await prisma.order.findFirst({
      where: { id: result.order.id, organizationId: { not: atlas.id } },
    });
    expect(leak).toBeNull();
  });
});
