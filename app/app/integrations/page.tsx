"use client";

import { Toggle } from "@/components/ui";
import { toggleIntegration, useAppState } from "@/lib/store";

const labels: Record<string, string> = {
  store: "Stores",
  ads: "Ads & leads",
  channel: "Channels",
  carrier: "Carriers",
  sheet: "Sheets",
};

export default function IntegrationsPage() {
  const { integrations } = useAppState();
  const kinds = ["store", "channel", "ads", "carrier", "sheet"] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-zinc-500">
          Keep Shopify, WhatsApp and your carriers. Nexora sits in the middle.
        </p>
      </div>
      {kinds.map((kind) => (
        <section key={kind}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {labels[kind]}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {integrations
              .filter((i) => i.kind === kind)
              .map((i) => (
                <article
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-sand bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-semibold">{i.name}</div>
                    <div className="text-xs text-zinc-500">{i.detail}</div>
                  </div>
                  <Toggle checked={i.connected} onChange={() => toggleIntegration(i.id)} />
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
