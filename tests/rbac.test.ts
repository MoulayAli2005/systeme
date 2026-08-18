import { describe, expect, it } from "vitest";
import { permissionsForRole } from "../server/rbac/catalog";

describe("RBAC catalog", () => {
  it("gives owners every permission", () => {
    expect(permissionsForRole("owner")).toContain("orders.confirm");
    expect(permissionsForRole("owner")).toContain("users.manage");
  });
  it("keeps agents off billing and user admin", () => {
    const keys = permissionsForRole("call_center_agent");
    expect(keys).toContain("orders.confirm");
    expect(keys).not.toContain("billing.read");
    expect(keys).not.toContain("users.manage");
  });
  it("read-only cannot confirm", () => {
    expect(permissionsForRole("read_only")).not.toContain("orders.confirm");
  });
});
