import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../server/rbac/catalog";

describe("permission keys", () => {
  it("are unique", () => {
    const keys = PERMISSIONS.map((p) => p[0]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
