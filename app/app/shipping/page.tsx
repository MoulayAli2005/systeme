"use client";

import { useMemo, useState } from "react";
import { PrimaryButton, GhostButton, StatusBadge } from "@/components/ui";
import { dispatchOrders, toggleCarrier, useAppState } from "@/lib/store";
import { money } from "@/lib/format";

export default function ShippingPage() {
  const { orders, carriers, manifests } = useAppState();
  const ready = orders.filter((o) => o.status === "confirmed" || o.status === "packed");
  const [selected, setSelected] = useState<string[]>([]);
  const [carrierId, setCarrierId] = useState(carriers.find((c) => c.connected)?.id ?? "c1");
  const allSelected = ready.length > 0 && selected.length === ready.length;

  const byCarrier = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      if (o.carrierId && ["shipped", "out_for_delivery", "delivered"].includes(o.status)) {
        map[o.carrierId] = (map[o.carrierId] || 0) + 1;
      }
    }
    return map;
  }, [orders]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shipping</h1>
          <p className="text-sm text-zinc-500">
            {ready.length} confirmed orders ready for a label · pick a carrier, dispatch the lot
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={carrierId}
            onChange={(e) => setCarrierId(e.target.value)}
            className="rounded-full border border-sand bg-white px-3 py-2 text-sm"
          >
            {carriers.filter((c) => c.connected).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.pickupWindow}
              </option>
            ))}
          </select>
          <PrimaryButton
            disabled={!selected.length}
            onClick={() => {
              dispatchOrders(selected, carrierId);
              setSelected([]);
            }}
          >
            Dispatch {selected.length || ""} {selected.length === 1 ? "order" : "orders"}
          </PrimaryButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {carriers.filter((c) => c.connected).map((c) => (
          <div key={c.id} className="rounded-2xl border border-sand bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{c.name}</div>
              <span className="text-xs text-emerald-700">{c.deliveredRate}% delivered</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {c.avgDays}d avg · {byCarrier[c.id] || 0} in flight · pickup {c.pickupWindow}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold">Ready to ship</div>
          <GhostButton
            className="text-xs"
            onClick={() => setSelected(allSelected ? [] : ready.map((o) => o.id))}
          >
            {allSelected ? "Clear" : "Select all"}
          </GhostButton>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
            <tr className="border-t border-sand">
              <th className="px-4 py-2 w-10" />
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">City</th>
              <th className="px-4 py-2 font-medium">COD</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ready.map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id),
                      )
                    }
                  />
                </td>
                <td className="px-4 py-2 font-semibold">{o.number}</td>
                <td className="px-4 py-2">{o.customer.name}</td>
                <td className="px-4 py-2">{o.customer.city}</td>
                <td className="px-4 py-2">{money(o.total)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
            {ready.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Nothing waiting — confirm more orders or check today’s manifests.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-sand bg-white p-4">
        <div className="text-sm font-semibold">Today’s manifests</div>
        <ul className="mt-3 space-y-3">
          {manifests.map((m) => {
            const c = carriers.find((x) => x.id === m.carrierId);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-3 text-sm">
                <div>
                  <div className="font-semibold">{c?.name}</div>
                  <div className="text-xs text-zinc-500">
                    {m.orderIds.length} parcels · pickup {m.pickupAt} · {m.status}
                  </div>
                </div>
                <GhostButton className="text-xs">Print labels</GhostButton>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 text-sm font-semibold">Available carriers</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {carriers.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-sand px-3 py-2 text-sm">
              <span>
                {c.name}
                <span className="ml-2 text-xs text-zinc-400">{c.cities.slice(0, 2).join(", ")}</span>
              </span>
              <button
                onClick={() => toggleCarrier(c.id)}
                className="text-xs font-semibold"
              >
                {c.connected ? "Connected" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
