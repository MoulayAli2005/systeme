export const PERMISSIONS = [
  ["orders.read", "orders", "View orders"],
  ["orders.write", "orders", "Create and edit orders"],
  ["orders.confirm", "orders", "Confirm or cancel orders"],
  ["orders.bulk", "orders", "Bulk order actions"],
  ["customers.read", "customers", "View customers"],
  ["customers.write", "customers", "Edit customers"],
  ["products.read", "products", "View products"],
  ["products.write", "products", "Edit products"],
  ["inventory.read", "inventory", "View inventory"],
  ["inventory.write", "inventory", "Adjust inventory"],
  ["callcenter.work", "call-center", "Work the confirmation queue"],
  ["callcenter.manage", "call-center", "Manage agents and scripts"],
  ["inbox.read", "inbox", "View inbox"],
  ["inbox.write", "inbox", "Reply in inbox"],
  ["shipping.read", "shipping", "View shipments"],
  ["shipping.dispatch", "shipping", "Create shipments"],
  ["returns.read", "returns", "View returns"],
  ["returns.write", "returns", "Process returns"],
  ["analytics.read", "analytics", "View analytics"],
  ["finance.read", "finance", "View COD reconciliation and payouts"],
  ["finance.write", "finance", "Import carrier statements and settle payouts"],
  ["marketing.read", "marketing", "View campaigns"],
  ["marketing.write", "marketing", "Manage campaigns"],
  ["automations.read", "automations", "View automations"],
  ["automations.write", "automations", "Edit automations"],
  ["ai.use", "ai", "Use AI assistant"],
  ["integrations.manage", "integrations", "Manage integrations"],
  ["settings.manage", "settings", "Manage workspace settings"],
  ["billing.read", "billing", "View billing"],
  ["users.manage", "users", "Manage users and roles"],
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number][0];

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p[0]);

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Permissions an API key may ever hold. Managing users, roles, workspace
 * settings and billing stays with signed-in humans: a leaked integration token
 * must not be able to add an administrator or read invoices.
 */
export const API_KEY_GRANTABLE: PermissionKey[] = ALL_PERMISSIONS.filter(
  (key) => !["users.manage", "settings.manage", "billing.read", "integrations.manage"].includes(key),
);

/**
 * Applied when a key was created without an explicit scope list, which is the
 * case for every key issued before scopes existed.
 */
export const API_KEY_DEFAULT_SCOPES: PermissionKey[] = [
  "orders.read",
  "orders.write",
  "orders.confirm",
  "customers.read",
  "customers.write",
  "products.read",
  "inventory.read",
  "shipping.read",
  "shipping.dispatch",
  "returns.read",
  "analytics.read",
];

export const ROLE_KEYS = [
  "owner",
  "admin",
  "manager",
  "call_center_manager",
  "call_center_agent",
  "warehouse_manager",
  "warehouse_employee",
  "accountant",
  "marketing_manager",
  "read_only",
] as const;

export function permissionsForRole(role: string): PermissionKey[] {
  const all = PERMISSIONS.map((p) => p[0]);
  const read = all.filter((k) => k.endsWith(".read") || k === "ai.use");
  switch (role) {
    case "owner":
    case "admin":
      return [...all];
    case "manager":
      return all.filter((k) => k !== "billing.read" && k !== "users.manage");
    case "call_center_manager":
      return [
        "orders.read",
        "orders.write",
        "orders.confirm",
        "orders.bulk",
        "customers.read",
        "customers.write",
        "callcenter.work",
        "callcenter.manage",
        "inbox.read",
        "inbox.write",
        "analytics.read",
        "ai.use",
      ];
    case "call_center_agent":
      return [
        "orders.read",
        "orders.confirm",
        "customers.read",
        "callcenter.work",
        "inbox.read",
        "inbox.write",
        "ai.use",
      ];
    case "warehouse_manager":
      return [
        "orders.read",
        "products.read",
        "inventory.read",
        "inventory.write",
        "shipping.read",
        "shipping.dispatch",
        "returns.read",
        "returns.write",
      ];
    case "warehouse_employee":
      return ["orders.read", "inventory.read", "shipping.read", "returns.read"];
    case "accountant":
      return [
        "orders.read",
        "analytics.read",
        "billing.read",
        "customers.read",
        "shipping.read",
        "finance.read",
        "finance.write",
      ];
    case "marketing_manager":
      return ["orders.read", "analytics.read", "marketing.read", "marketing.write", "ai.use"];
    default:
      return read;
  }
}
