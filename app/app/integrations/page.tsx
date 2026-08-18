"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function IntegrationsPage() {
  const q = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      api<{ rows: Array<{ id: string; kind: string; provider: string; name: string; connected: boolean }> }>(
        "/api/v1/integrations",
      ),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () =>
      api<{ rows: Array<{ kind: string; name: string; configured: boolean }>; demoMode: boolean }>("/api/v1/providers"),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading integrations…</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-zinc-500">
          Adapters live in <code>server/providers</code>. Live credentials (Twilio, SendGrid, carrier HTTP, OpenAI) are
          used only when env vars are set. Otherwise the UI stays on the demo adapter and never fakes a live send.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(providers.data?.rows ?? []).map((i) => (
          <article key={i.kind} className="rounded-2xl border border-sand bg-white p-4">
            <div className="text-xs uppercase text-zinc-400">{i.kind}</div>
            <div className="font-semibold">{i.name}</div>
            <div className="text-xs text-zinc-500">
              {i.configured ? "Adapter ready" : "Not configured — demo adapter only"}
            </div>
          </article>
        ))}
        {(q.data?.rows ?? []).map((i) => (
          <article key={i.id} className="rounded-2xl border border-sand bg-white p-4">
            <div className="text-xs uppercase text-zinc-400">{i.kind}</div>
            <div className="font-semibold">{i.name}</div>
            <div className="text-xs text-zinc-500">{i.connected ? "Workspace record connected" : "Not configured"}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
