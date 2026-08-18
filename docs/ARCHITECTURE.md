# Nexora — Architecture

Production multi-tenant COD operating system. Original product, original UI, original schema. Comparable in *capability* to modern COD ops platforms, not a clone.

## Current repository (as found)

Existing app was a **Next.js 16 marketing site + client-side localStorage demo**. No database, no auth, no tenant isolation. This document describes the production architecture that replaces that demo.

## 1. Architecture diagram

```
                    ┌─────────────────────────────────────────┐
                    │              Next.js 16 (App Router)     │
                    │  Marketing  │  Org app  │  Platform admin│
                    └──────────────┬───────────┬───────────────┘
                                   │ REST /api/v1
                    ┌──────────────▼───────────▼───────────────┐
                    │         Modular domain services          │
                    │  auth · rbac · orders · shipping · …     │
                    │  Provider adapters (never in core)       │
                    └──────┬──────────┬──────────┬─────────────┘
                           │          │          │
                    ┌──────▼──┐ ┌─────▼────┐ ┌───▼────────────┐
                    │ Postgres│ │  Redis   │ │ BullMQ workers │
                    │ +Prisma │ │ sessions │ │ notify/ship/ai │
                    └─────────┘ │ queues   │ └────────────────┘
                                └──────────┘
```

Single deployable app (`apps` conceptually live in this repo): UI + REST API share `server/` business logic. Workers run as `npm run worker`.

## 2. Folder structure

```
app/                      UI (App Router)
  api/v1/                 REST API
  api/health/             liveness/readiness
  api/webhooks/[provider] inbound webhooks
  app/                    tenant workspace
  platform/               platform-admin (superuser)
  login|signup|pricing
server/
  db.ts                   Prisma singleton
  http.ts                 request helpers, errors
  auth/                   sessions, password, 2FA
  rbac/                   permissions
  audit/
  crypto.ts               credential encryption
  modules/                one folder per domain
  providers/              shipping | messaging | phone | ads | store | ai
  jobs/                   queues + workers
prisma/schema.prisma
docker-compose.yml        Postgres + Redis
docs/
```

## 3. Database ERD (logical)

- **Platform**: User (optional platformAdmin), Subscription, UsageRecord
- **Tenant root**: Organization 1—* Membership *—1 User; Organization 1—* Role *—* Permission
- **Commerce**: Store, Warehouse, Product, ProductVariant, InventoryItem, InventoryMovement, Supplier
- **CRM**: Customer (riskScore, LTV), CustomerNote
- **Orders**: Order, OrderItem, OrderEvent, OrderTag, StatusDefinition (org-configurable)
- **Call center**: Team, AgentProfile, Call, Callback
- **Comms**: Conversation, Message, MessageTemplate
- **Fulfillment**: Carrier, Shipment, ReturnCase
- **Marketing**: Campaign, Ad, AdSpend, Attribution
- **Automation**: Automation, AutomationRun
- **Platform plumbing**: Integration, WebhookEndpoint, WebhookDelivery, ApiKey, Notification, Task, AuditLog, LoginEvent, Session

Every tenant-owned row has `organizationId`. Queries never trust client-supplied org IDs.

## 4. Module dependency map

```
auth → users, organizations, rbac, audit
stores → organizations, warehouses, integrations
products → stores, inventory, suppliers
customers → organizations (risk engine reads orders)
orders → customers, products, stores, warehouses, audit, automations
call-center → orders, customers, phone providers
inbox → conversations, messaging providers, orders
shipping → orders, carrier providers, warehouses
returns → orders, inventory, shipping
ads → campaigns, orders (attribution)
analytics → orders, ads, shipping, call-center (read-only)
automations → all modules via action registry
ai → orders/inbox/analytics via AI provider
billing → organizations (isolated from commerce)
webhooks → event bus
```

Core order/customer/product modules **must not** import a specific Twilio/Shopify/Aramex SDK. They call interfaces in `server/providers/*`.

## 5. API route map

Prefix: `/api/v1`

| Area | Methods |
|---|---|
| `/auth/register,login,logout,me,forgot,reset,verify-email,2fa/*` | POST/GET |
| `/organizations`, `/organizations/current` | GET/PATCH |
| `/users`, `/roles` | CRUD |
| `/stores`, `/products`, `/variants`, `/inventory` | CRUD |
| `/customers` | CRUD + risk |
| `/orders`, `/orders/:id`, `/orders/:id/status`, `/orders/bulk` | CRUD + pipeline |
| `/call-center/queue`, `/calls` | GET/POST |
| `/inbox/conversations`, `/inbox/messages` | GET/POST |
| `/shipments`, `/carriers`, `/returns` | CRUD |
| `/warehouses`, `/transfers` | CRUD |
| `/campaigns`, `/ads` | GET + sync jobs |
| `/analytics/overview`, `/analytics/*` | GET |
| `/automations` | CRUD + toggle |
| `/webhooks`, `/api-keys` | CRUD |
| `/billing/plan` | GET |
| `/tasks`, `/notifications`, `/search` | GET/POST |
| `/platform/*` | platform admin only |
| `/health` | public |

OpenAPI: `/api/openapi.json` and `/api/docs`.

## 6. Integration map (adapters + demo mode)

| Capability | Interface | Adapters | Status |
|---|---|---|---|
| Storefront | `StoreProvider` | Shopify, Woo, PrestaShop, YouCan, Generic HTTP, Demo | Demo + Generic live; others need OAuth creds |
| Shipping | `ShippingProvider` | Generic REST (`CARRIER_API_URL`), Demo | Live HTTP if env set; else demo AWB |
| Phone | `PhoneProvider` | Twilio Voice, Demo | Live if `TWILIO_*` set |
| WhatsApp | `MessagingProvider` | Twilio WhatsApp, Demo | Live if `TWILIO_WHATSAPP_FROM` set |
| SMS | `MessagingProvider` | Twilio SMS, Demo | Live if `TWILIO_FROM_NUMBER` set |
| Email | `EmailProvider` | SendGrid, Demo | Live if `SENDGRID_API_KEY` set |
| Ads | `AdsProvider` | Meta, TikTok, Google, Demo | Demo |
| AI | `AiProvider` | OpenAI-compatible, Demo | Live if `OPENAI_API_KEY` |

Unconfigured providers return `INTEGRATION_NOT_CONNECTED` — UI states this explicitly. No fake “sent to Shopify” success.

## 7. Security model

- **Tenant isolation**: `organizationId` taken from session membership, not request body.
- **RBAC**: permission keys (`orders.confirm`, `billing.read`, …); custom roles per org; platform admin bypasses tenant routes only via `/platform`.
- **Auth**: bcrypt passwords, httpOnly secure cookies, session table, rotation on login, optional TOTP.
- **Secrets**: integration credentials encrypted with `ENCRYPTION_KEY` (AES-256-GCM). Never in git.
- **Abuse**: rate limits on auth and public APIs; Zod validation; parameterized Prisma queries.
- **Webhooks**: HMAC signatures, timestamp skew, idempotency keys.
- **Audit**: mutating order/status/permission actions write `AuditLog`.

## 8. Implementation roadmap

1. Infra + Prisma + auth + tenancy + dashboard  
2. Stores, products, customers, orders  
3. Call center + Kanban pipeline  
4. Shipping, warehouses, inventory, returns  
5. WhatsApp/SMS/email + unified inbox  
6. Attribution + ads adapters  
7. Analytics + profitability  
8. Automation engine  
9. AI layer  
10. Billing, platform admin, hardening, tests  

After each phase: typecheck, lint, tests, README update.

## Scalability notes

- Indexes on `(organizationId, createdAt)`, `(organizationId, status)`, phone, AWB.  
- Cursor pagination on orders. Never send 5k rows to the browser.  
- Redis cache for dashboard KPIs (short TTL).  
- BullMQ for shipping, messages, webhooks, analytics rollups.  
- Risk: hot `Order` table at 10k+/day — partition by createdAt in a later migration; keep schema partition-ready (`createdAt` on every order query).
