# Nexora

Operations platform for cash-on-delivery e-commerce — in the spirit of [eGrow](https://egrow.com). Confirm orders on WhatsApp, auto-dispatch carriers, run a shared inbox, and reconcile returns from one workspace.

This repo is a **working product demo** (not a live Meta/Shopify integration). It ships with a seeded Moroccan fashion store, **Atlas Atelier**, so you can click through a real COD day.

## What’s included

- Marketing site, pricing, login / signup
- Dashboard with live KPIs and pipeline
- Orders (filters, detail, manual create, live-order simulator)
- Confirmation desk (WhatsApp + call scripts)
- Shared inbox (WhatsApp / Instagram / email + AI drafts)
- Shipping manifests and multi-carrier dispatch
- Returns, RTO, exchanges, COD reconciliation
- Catalog, campaigns, automations, AI agent, analytics, team, integrations
- Public tracking page at `/t/[AWB]` (try `OZ771042659CR12`)

State lives in the browser (`localStorage`). Reset it from **Settings**.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open demo** (any password works).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript
