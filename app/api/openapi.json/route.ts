import { json } from "@/server/http";

const security = [{ cookie: [] }, { bearer: [] }, { apiKey: [] }];

export async function GET() {
  return json({
    openapi: "3.0.3",
    info: {
      title: "Nexora API",
      version: "1.0.0",
      description: "Multi-tenant COD operations API. Session cookie, Bearer session token, or nxk_ API key.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/auth/register": { post: { summary: "Register workspace", tags: ["Auth"] } },
      "/auth/login": { post: { summary: "Login", tags: ["Auth"] } },
      "/auth/logout": { post: { summary: "Logout", tags: ["Auth"] } },
      "/auth/me": { get: { summary: "Current session", tags: ["Auth"], security } },
      "/auth/forgot": { post: { summary: "Request password reset", tags: ["Auth"] } },
      "/auth/reset": { post: { summary: "Reset password", tags: ["Auth"] } },
      "/auth/verify-email": { post: { summary: "Verify email", tags: ["Auth"] } },
      "/auth/2fa/setup": { post: { summary: "Begin TOTP setup", tags: ["Auth"], security } },
      "/auth/2fa/enable": { post: { summary: "Enable TOTP", tags: ["Auth"], security } },
      "/auth/sessions": { get: { summary: "List sessions", tags: ["Auth"], security } },
      "/auth/login-history": { get: { summary: "Login history", tags: ["Auth"], security } },
      "/orders": {
        get: { summary: "List orders (cursor pagination)", tags: ["Orders"], security },
        post: { summary: "Create order", tags: ["Orders"], security },
      },
      "/orders/{id}": { get: { summary: "Get order", tags: ["Orders"], security } },
      "/orders/{id}/status": { post: { summary: "Change status (automations + audit + webhooks)", tags: ["Orders"], security } },
      "/orders/bulk": { post: { summary: "Bulk actions", tags: ["Orders"], security } },
      "/customers": { get: { summary: "List customers", tags: ["CRM"], security }, post: { summary: "Create customer", tags: ["CRM"], security } },
      "/products": { get: { summary: "List products", tags: ["Catalog"], security }, post: { summary: "Create product", tags: ["Catalog"], security } },
      "/inventory": { get: { summary: "List inventory", tags: ["Inventory"], security } },
      "/inventory/adjust": { post: { summary: "Adjust stock", tags: ["Inventory"], security } },
      "/call-center/queue": { get: { summary: "Confirmation queue", tags: ["Call center"], security } },
      "/call-center/call": { post: { summary: "Place a call via PhoneProvider", tags: ["Call center"], security } },
      "/call-center/assign": { post: { summary: "Dispatch next order", tags: ["Call center"], security } },
      "/inbox": { get: { summary: "Unified inbox", tags: ["Inbox"], security } },
      "/shipments": { get: { summary: "List shipments", tags: ["Shipping"], security }, post: { summary: "Dispatch", tags: ["Shipping"], security } },
      "/returns": { get: { summary: "List returns", tags: ["Returns"], security }, post: { summary: "Open return", tags: ["Returns"], security } },
      "/analytics/overview": { get: { summary: "KPI overview + profit", tags: ["Analytics"], security } },
      "/analytics/agents": { get: { summary: "Agent leaderboard", tags: ["Analytics"], security } },
      "/automations": { get: { summary: "List automations", tags: ["Automations"], security }, post: { summary: "Create rule", tags: ["Automations"], security } },
      "/automations/whatsapp": {
        get: { summary: "WhatsApp automation presets", tags: ["Automations"], security },
        post: { summary: "Enable or disable a WhatsApp preset", tags: ["Automations"], security },
      },
      "/ai/ask": { post: { summary: "Ask the operations copilot", tags: ["AI"], security } },
      "/webhooks": { get: { summary: "Outgoing webhook endpoints", tags: ["Integrations"], security }, post: { summary: "Create endpoint", tags: ["Integrations"], security } },
      "/api-keys": { get: { summary: "List API keys", tags: ["Integrations"], security }, post: { summary: "Create API key", tags: ["Integrations"], security } },
      "/billing": { get: { summary: "Subscription", tags: ["Billing"], security } },
      "/search": { get: { summary: "Global search", tags: ["Search"], security } },
      "/platform/organizations": { get: { summary: "All tenants (platform admin)", tags: ["Platform"], security } },
    },
    components: {
      securitySchemes: {
        cookie: { type: "apiKey", in: "cookie", name: "nexora_session" },
        bearer: { type: "http", scheme: "bearer" },
        apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
      },
    },
  });
}
