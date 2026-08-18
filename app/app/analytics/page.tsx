"use client";

import { Kpi } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { money, STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export default function AnalyticsPage() {
  const { orders, agents, carriers } = useAppState();
  const confirmed = orders.filter((o) =>
    ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"].includes(o.status),
  ).length;
  const delivered = orders.filter((o) => o.status === "delivered");
  const rto = orders.filter((o) => o.status === "rto" || o.status === "returned").length;
  const gmv = orders.reduce((s, o) => s + o.total, 0);
  const collected = delivered.reduce((s, o) => s + o.total, 0);

  const byCity: Record<string, number> = {};
  for (const o of orders) byCity[o.customer.city] = (byCity[o.customer.city] || 0) + o.total;
  const cities = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
  const maxCity = cities[0]?.[1] || 1;

  const funnel: OrderStatus[] = [
    "new",
    "pending_confirmation",
    "confirmed",
    "shipped",
    "delivered",
    "rto",
  ];
  const maxFunnel = Math.max(...funnel.map((s) => orders.filter((o) => o.status === s).length), 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-zinc-500">Last 48 hours of Atlas Atelier · live sample data</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="GMV" value={money(gmv)} hint="All orders created" />
        <Kpi label="Collected" value={money(collected)} hint="Delivered COD + prepaid" delta="+9%" good />
        <Kpi
          label="Confirm rate"
          value={`${Math.round((confirmed / Math.max(orders.length, 1)) * 100)}%`}
        />
        <Kpi
          label="RTO rate"
          value={`${Math.round((rto / Math.max(orders.length, 1)) * 100)}%`}
          good={false}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Status funnel</div>
          <ul className="mt-4 space-y-2">
            {funnel.map((s) => {
              const n = orders.filter((o) => o.status === s).length;
              return (
                <li key={s}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{STATUS_LABEL[s]}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${(n / maxFunnel) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">GMV by city</div>
          <ul className="mt-4 space-y-2">
            {cities.map(([city, n]) => (
              <li key={city}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{city}</span>
                  <span className="font-semibold">{money(n)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-full rounded-full bg-mint-2"
                    style={{ width: `${(n / maxCity) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Agents</div>
          <ul className="mt-3 space-y-2 text-sm">
            {agents.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>
                  {a.name}
                  <span className="ml-2 text-xs text-zinc-400">{a.role}</span>
                </span>
                <span className="font-semibold">{a.confirmedToday}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Carriers</div>
          <ul className="mt-3 space-y-2 text-sm">
            {carriers.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span className="font-semibold">{c.deliveredRate}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
