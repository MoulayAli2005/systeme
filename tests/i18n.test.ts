import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  LOCALES,
  LOCALE_META,
  directionOf,
  isLocale,
  translate,
} from "../lib/i18n";

describe("i18n", () => {
  it("defaults to French and maps Arabic to RTL", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
    expect(directionOf("fr")).toBe("ltr");
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("ar")).toBe("rtl");
  });

  it("accepts only known locale codes", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("es")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("exposes a native name for every language", () => {
    expect(LOCALES).toEqual(["fr", "en", "ar"]);
    for (const locale of LOCALES) {
      expect(LOCALE_META[locale].native.length).toBeGreaterThan(0);
      expect(DICTIONARIES[locale].language.length).toBeGreaterThan(0);
    }
  });

  it("translates chrome strings in all three languages", () => {
    expect(translate("fr", "login.submit")).toBe("Se connecter");
    expect(translate("en", "login.submit")).toBe("Sign in");
    expect(translate("ar", "login.submit")).toBe("دخول");
    expect(translate("fr", "partners.kicker")).toBe("Partenaire officiel");
    expect(translate("en", "partners.title")).toMatch(/Shopify/);
    expect(translate("ar", "partners.carriers")).toMatch(/المغرب/);
  });
});
