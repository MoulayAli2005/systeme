import { describe, expect, it } from "vitest";
import { matchConditions, scoreRisk } from "../server/modules/risk/engine";
import { signWebhook } from "../server/modules/webhooks/dispatch";
import { parsePage } from "../server/http";
import { PLANS } from "../server/modules/billing/plans";

describe("risk engine", () => {
  it("marks high-velocity cancellers as high risk", () => {
    const r = scoreRisk({
      totalOrders: 10,
      cancelled: 6,
      returned: 4,
      refused: 2,
      uniquePhones: 4,
      uniqueAddresses: 5,
      velocity24h: 5,
    });
    expect(r.score).toBeGreaterThan(80);
    expect(r.requireManualVerification).toBe(true);
    expect(r.label).toBe("high_risk");
  });

  it("keeps a clean customer in the reliable/normal band", () => {
    const r = scoreRisk({
      totalOrders: 8,
      cancelled: 0,
      returned: 0,
      refused: 0,
      uniquePhones: 1,
      uniqueAddresses: 1,
      velocity24h: 1,
    });
    expect(r.score).toBeLessThan(25);
    expect(r.requireManualVerification).toBe(false);
  });
});

describe("automation conditions", () => {
  const order = { total: 600, paymentMethod: "cod", status: "NEW", callAttempts: 3 };
  it("matches min total and payment method", () => {
    expect(matchConditions({ minTotal: 500, paymentMethod: "cod" }, order)).toBe(true);
    expect(matchConditions({ minTotal: 900 }, order)).toBe(false);
    expect(matchConditions({ paymentMethod: "prepaid" }, order)).toBe(false);
  });
  it("matches status from payload", () => {
    expect(matchConditions({ status: "CONFIRMED" }, order, { status: "CONFIRMED" })).toBe(true);
    expect(matchConditions({ status: "CONFIRMED" }, order, { status: "NEW" })).toBe(false);
  });
  it("matches city, tag and risk score", () => {
    const rich = {
      ...order,
      city: "Casablanca",
      source: "shopify",
      tags: ["vip"],
      riskScore: 70,
    };
    expect(matchConditions({ city: "casablanca", hasTag: "vip", minRiskScore: 55 }, rich)).toBe(true);
    expect(matchConditions({ city: "Marrakech" }, rich)).toBe(false);
    expect(matchConditions({ hasTag: "rto" }, rich)).toBe(false);
    expect(matchConditions({ minRiskScore: 80 }, rich)).toBe(false);
    expect(matchConditions({ source: "youcan" }, rich)).toBe(false);
  });
});

describe("webhook signatures", () => {
  it("is deterministic HMAC-SHA256", () => {
    const a = signWebhook("whsec_test", "{\"ok\":true}");
    const b = signWebhook("whsec_test", "{\"ok\":true}");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("pagination helper", () => {
  it("clamps limit and reads cursor", () => {
    const page = parsePage(new URL("http://x.local/api/v1/orders?limit=500&cursor=abc&q=casa"));
    expect(page.take).toBe(100);
    expect(page.cursor).toBe("abc");
    expect(page.q).toBe("casa");
  });
});

describe("billing plans", () => {
  it("defines the five SaaS tiers", () => {
    expect(Object.keys(PLANS)).toEqual(["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"]);
    expect(PLANS.ENTERPRISE.orders).toBe(-1);
  });
});
