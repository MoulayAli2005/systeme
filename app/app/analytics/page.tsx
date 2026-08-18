"use client";

import { useQuery } from "@tanstack/react-query";
import { Kpi } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

type Overview = {
  count: number;
  revenue: number;
  deliveredRevenue: number;
  confirmationRate: number;
  deliveryRate: number;
  returnRate: number;
  cancellationRate: number;
  profit: number;
  margin: number;
  productCost: number;
  shippingCost: number;
  adCost: number;
  cities: Array<{ city: string; orders: number; revenue: number; deliveryRate: number }>;
  products: Array<{ name: string; orders: number; revenue: number; profit: number; margin: number }>;
  byDay: Array<{ date: string; orders: number }>;
};

export default function AnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<Overview>("/api/v1/analytics/overview?days=30"),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Crunching numbers…</p>;
  if (!q.data) return <p className="text-sm text-rose-600">Could not load analytics.</p>;
  const d = q.data;
  const maxCity = d.cities[0]?.orders || 1;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Analytics & profit</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="GMV" value={money(d.revenue)} />
        <Kpi label="Delivered" value={money(d.deliveredRevenue)} />
        <Kpi label="Net profit" value={money(d.profit)} hint={`${d.margin}% margin`} />
        <Kpi label="Confirm / deliver / RTO" value={`${d.confirmationRate}% / ${d.deliveryRate}% / ${d.returnRate}%`} />
      </div>
      <p className="text-xs text-zinc-500">
        Profit = delivered revenue − product cost ({money(d.productCost)}) − shipping ({money(d.shippingCost)}) − ads (
        {money(d.adCost)}).
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Cities</div>
          <ul className="mt-3 space-y-2">
            {d.cities.slice(0, 10).map((c) => (
              <li key={c.city}>
                <div className="flex justify-between text-xs">
                  <span>{c.city}</span>
                  <span>
                    {c.orders} · {c.deliveryRate}% · {money(c.revenue)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-paper">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${(c.orders / maxCity) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Agent leaderboard</div>
          <AgentBoard />
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Product profitability</div>
          <ul className="mt-3 space-y-2 text-sm">
            {d.products.slice(0, 10).map((p) => (
              <li key={p.name} className="flex justify-between">
                <span className="truncate pr-2">{p.name}</span>
                <span className="font-semibold">
                  {money(p.profit)} · {p.margin}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function AgentBoard() {
  const q = useQuery({
    queryKey: ["analytics-agents"],
    queryFn: () =>
      api<{
        rows: Array<{
          agentId: string;
          name: string;
          assigned: number;
          confirmed: number;
          confirmationRate: number;
          revenue: number;
        }>;
      }>("/api/v1/analytics/agents?days=30"),
  });
  if (q.isLoading) return <p className="mt-3 text-xs text-zinc-500">Loading agents…</p>;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {(q.data?.rows ?? []).slice(0, 8).map((a) => (
        <li key={a.agentId} className="flex justify-between">
          <span>{a.name}</span>
          <span className="text-xs text-zinc-500">
            {a.confirmed}/{a.assigned} · {a.confirmationRate}% · {money(a.revenue)}
          </span>
        </li>
      ))}
    </ul>
  );
}
