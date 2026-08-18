"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge, ProductSwatch, GhostButton, PrimaryButton } from "@/components/ui";
import { useAppState } from "@/lib/store";
import {
  money,
  relativeTime,
  SOURCE_LABEL,
  paymentLabel,
} from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const filters: Array<{ id: "all" | OrderStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "pending_confirmation", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "rto", label: "RTO" },
  { id: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading orders…</div>}>
      <OrdersInner />
    </Suspense>
  );
}

function OrdersInner() {
  const { orders, products, agents } = useAppState();
  const params = useSearchParams();
  const initial = (params.get("status") as OrderStatus | null) ?? "all";
  const [status, setStatus] = useState<"all" | OrderStatus>(initial);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const cities = Array.from(new Set(orders.map((o) => o.customer.city))).sort();

  const rows = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (city !== "all" && o.customer.city !== city) return false;
    if (q) {
      const hay = `${o.number} ${o.customer.name} ${o.customer.phone} ${o.awb ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-zinc-500">{rows.length} matching · live from connected stores</p>
        </div>
        <Link href="/app/orders/new">
          <PrimaryButton>New order</PrimaryButton>
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === f.id ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-sand"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, AWB…"
          className="w-full max-w-xs rounded-xl border border-sand bg-white px-3 py-2 text-sm"
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-xl border border-sand bg-white px-3 py-2 text-sm"
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              {["Order", "Customer", "Items", "Total", "Source", "Agent", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const agent = agents.find((a) => a.id === o.assignedTo);
              const p = products.find((x) => x.id === o.items[0]?.productId);
              return (
                <tr key={o.id} className="border-t border-sand hover:bg-paper/50">
                  <td className="px-4 py-3">
                    <Link href={`/app/orders/${o.id}`} className="font-semibold">
                      {o.number}
                    </Link>
                    <div className="text-[11px] text-zinc-400">{relativeTime(o.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.customer.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {o.customer.city} · {paymentLabel(o.payment)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p ? <ProductSwatch hue={p.imageHue} className="h-8 w-8" /> : null}
                      <span className="text-xs">
                        {o.items[0]?.name}
                        {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{money(o.total)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{SOURCE_LABEL[o.source]}</td>
                  <td className="px-4 py-3 text-xs">{agent?.name.split(" ")[0] ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/app/orders/${o.id}`}>
                      <GhostButton className="px-3 py-1 text-xs">Open</GhostButton>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
