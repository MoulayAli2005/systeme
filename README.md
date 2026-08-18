# Nexora

Production-oriented **multi-tenant COD e-commerce operating system**. Confirm orders, run a call center, dispatch carriers, reconcile returns, and measure real profit — one workspace per company.

This is original software (architecture, schema, UI, brand). It is **not** a clone of any proprietary product.

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

Next.js 16 · TypeScript · PostgreSQL · Prisma 7 · Redis · BullMQ · Zod · session cookies · RBAC

## Quick start

```bash
cp .env.example .env
docker compose up -d          # Postgres + Redis (or use local services)
npm install
npm run db:generate
npm run db:migrate            # or: npx prisma db push
npm run db:seed
npm run dev
```

Optional worker process (queues for WhatsApp, shipping, webhooks, email):

```bash
npm run worker
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (after seed)

| Role | Email | Password |
|---|---|---|
| Atlas Atelier owner | amine@atlasatelier.ma | demo1234 |
| Call center manager | yasmine@atlasatelier.ma | demo1234 |
| Casa Home owner (2nd tenant) | sara@casahome.ma | demo1234 |
| Platform admin | nina.v@example.com | ChangeMeAdmin! |

Casa Home cannot see Atlas orders. That is tenant isolation, not a UI filter.

## What works now

- Email/password auth, sessions, password reset, TOTP setup, API keys (`nxk_…`), RBAC
- Organizations, stores, products, inventory adjustments, warehouses with city routing, customers, orders
- Duplicate detection, risk scoring, confirmation desk, Kanban pipeline, bulk actions, CSV export/import
- Unified inbox (Twilio WhatsApp/SMS when env is set; otherwise demo adapter)
- Shipments via `ShippingProvider` (generic HTTP carrier when `CARRIER_API_URL` is set)
- Returns workflow
- Analytics, city/product profit, agent leaderboard
- Automations (WHEN/THEN: status, WhatsApp, shipment, tags)
- AI copilot over analytics (OpenAI if `OPENAI_API_KEY`, else demo)
- Incoming webhooks `/api/webhooks/{provider}?org=` (HMAC when `WEBHOOK_DEV_SECRET` is set)
- Outgoing webhooks with HMAC signatures and retries
- REST `/api/v1/*`, health `/api/health`, OpenAPI `/api/openapi.json`
- Platform admin `/platform`

## What is adapter-ready, not live until you add keys

Shopify OAuth, Meta/TikTok/Google ads pull, Stripe Checkout, S3 uploads, SMTP (use SendGrid HTTP via `SENDGRID_API_KEY`). The UI **says** when an integration is not connected. Empty env vars never produce a fake “sent to Shopify” success.

## Tests

```bash
npm test
npm run typecheck
npm run lint
```

## Production notes

- Set `JWT_SECRET` and `ENCRYPTION_KEY` (64 hex chars = 32-byte AES key) to unguessable values
- Use `docker compose` or managed Postgres/Redis
- Run `npm run db:deploy` then `npm run start`
- Put `npm run worker` behind a process manager
- Never commit `.env`

## Deploy on Railway

The app listens on `0.0.0.0:$PORT`, runs `prisma migrate deploy` on boot, and health-checks `/api/health`.

1. Open this link and connect the GitHub repo **MoulayAli2005/systeme**:
   [https://railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**.
2. Add plugins to the same project:
   - **Postgres**
   - **Redis**
3. On the web service, set variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<long random string>
ENCRYPTION_KEY=<64 hex chars>
APP_URL=https://<your-service>.up.railway.app
DEMO_MODE=true
NODE_ENV=production
```

Generate `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

4. **Settings → Networking → Generate domain**.
5. Optional seed (demo accounts): Railway → service → one-off `npm run db:seed`.

CLI (after `railway login`):

```bash
npm i -g @railway/cli
railway login
railway init
railway add --database postgres
railway add --database redis
railway variables set JWT_SECRET=... ENCRYPTION_KEY=... DEMO_MODE=true
railway up
railway domain
```
