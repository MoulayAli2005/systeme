import { describe, expect, it } from "vitest";
import { ALL_PARTNERS, CARRIER_PARTNERS, STORE_PARTNERS } from "../components/partners";

describe("partner logos", () => {
  it("lists Shopify, YouCan, Dropify and Moroccan carriers", () => {
    expect(STORE_PARTNERS.map((p) => p.id)).toEqual(["shopify", "youcan", "dropify"]);
    expect(CARRIER_PARTNERS.map((p) => p.id)).toEqual(
      expect.arrayContaining(["ozon", "ameex", "aramex", "sendit", "cathedis", "chronopost", "ctm", "tawssil", "dhl", "olivraison"]),
    );
  });

  it("gives every partner a unique id and an official asset path", () => {
    const ids = ALL_PARTNERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const partner of ALL_PARTNERS) {
      expect(partner.src.startsWith("/partners/")).toBe(true);
      expect(partner.href.startsWith("https://")).toBe(true);
    }
  });
});
