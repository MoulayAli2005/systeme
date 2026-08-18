import { describe, expect, it } from "vitest";
import { publicReply } from "../server/modules/ai/public";
import { copilotReply } from "../server/modules/ai/demo";

describe("public chatbot", () => {
  it("answers pricing in French", () => {
    const r = publicReply("c'est quoi le prix ?");
    expect(r.provider).toBe("faq");
    expect(r.answer.toLowerCase()).toMatch(/pricing|tarif|free|enterprise|sandbox/);
  });

  it("points Arabic visitors at login", () => {
    const r = publicReply("كيف نسجل الدخول");
    expect(r.answer).toMatch(/login|amine@atlasatelier/);
  });
});

describe("ops copilot demo replies", () => {
  const stats = {
    count: 100,
    delivered: 80,
    cancelled: 10,
    returned: 5,
    confirmationRate: 85,
    deliveryRate: 88.9,
    profit: 12000,
    shippingCost: 2400,
    cities: [
      { city: "Casa", orders: 40, deliveryRate: 92 },
      { city: "Oujda", orders: 12, deliveryRate: 61 },
    ],
    products: [{ name: "Linen Shirt", profit: 4000 }],
  };

  it("cites delivery numbers instead of telling the user to open a page", () => {
    const answer = copilotReply("combien de livraisons ?", stats);
    expect(answer).toContain("80");
    expect(answer).toContain("Oujda");
  });

  it("surfaces a looked-up order", () => {
    const answer = copilotReply("NX-11546", stats, [
      { kind: "order", title: "NX-11546", detail: "SHIPPED · Nabil · Marrakech · 289 MAD" },
    ]);
    expect(answer).toContain("NX-11546");
    expect(answer).toContain("SHIPPED");
  });
});
