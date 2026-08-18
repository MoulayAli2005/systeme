"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Kpi, StatusBadge, Avatar } from "@/components/ui";
import { injectLiveOrder, useAppState } from "@/lib/store";
import { money, relativeTime, STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { useRouter } from "next/navigation";

const PIPELINE: OrderStatus[] = [
  "new",
  "pending_confirmation",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "rto",
];

export default function DashboardPage() {
  const { orders, agents, conversations } = useAppState();
  const router = useRouter();
  const today = orders;
  const confirmed = orders.filter((o) =>
    ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"].includes(o.status),
  );
  const delivered = orders.filter((o) => o.status === "delivered");
  const rto = orders.filter((o) => o.status === "rto" || o.status === "returned");
  const pending = orders.filter((o) => o.status === "pending_confirmation" || o.status === "new");
  const revenue = delivered.reduce((s, o) => s + o.total, 0);
  const confirmRate = Math.round((confirmed.length / Math.max(orders.length, 1)) * 100);
  const unread = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today at Atlas Atelier</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live COD board · {pending.length} waiting on confirmation · {unread} unread chats
          </p>
        </div>
        <button
          onClick={() => {
            const id = injectLiveOrder();
            router.push(`/app/orders/${id}`);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Simulate live order
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders in workspace" value={String(today.length)} hint="Across Shopify, Woo, YouCan" delta="+12%" good />
        <Kpi label="Confirmation rate" value={`${confirmRate}%`} hint="WhatsApp + call + AI" delta="+6 pts" good />
        <Kpi label="COD collected" value={money(revenue)} hint="Delivered parcels only" delta="+9%" good />
        <Kpi label="RTO / returned" value={String(rto.length)} hint="Needs inspection" delta="+1" good={false} />
      </div>

      <div className="rounded-2xl border border-sand bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Pipeline</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {PIPELINE.map((s) => {
            const n = orders.filter((o) => o.status === s).length;
            return (
              <Link
                key={s}
                href={`/app/orders?status=${s}`}
                className="rounded-xl bg-paper px-3 py-3 hover:bg-sand/60"
              >
                <div className="text-xl font-semibold">{n}</div>
                <div className="mt-1 text-[11px] font-medium text-zinc-500">{STATUS_LABEL[s]}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <div className="overflow-hidden rounded-2xl border border-sand bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-semibold">Latest orders</div>
            <Link href="/app/orders" className="text-xs font-semibold text-zinc-500 hover:text-ink">
              View all
            </Link>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
              <tr className="border-t border-sand">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id} className="border-t border-sand hover:bg-paper/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/app/orders/${o.id}`} className="font-semibold">
                      {o.number}
                    </Link>
                    <div className="text-[11px] text-zinc-400">{relativeTime(o.createdAt)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{o.customer.name}</div>
                    <div className="text-[11px] text-zinc-400">{o.customer.city}</div>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{money(o.total)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="text-sm font-semibold">Confirmation desk</div>
          <ul className="mt-3 space-y-3">
            {agents
              .filter((a) => a.role === "confirmation" || a.role === "owner")
              .map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <Avatar initials={a.initials} hue={a.hue} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {a.name}
                      {a.online ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      ) : null}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {a.confirmedToday} confirmed · {a.avgConfirmMin}m avg
                    </div>
                  </div>
                </li>
              ))}
          </ul>
          <Link
            href="/app/confirmation"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold"
          >
            Open queue <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
