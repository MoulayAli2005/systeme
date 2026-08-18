"use client";

import { StatusBadge, PrimaryButton, GhostButton } from "@/components/ui";
import { createExchange, markReturnedInspected, useAppState } from "@/lib/store";
import { money } from "@/lib/format";

export default function ReturnsPage() {
  const { orders, carriers } = useAppState();
  const rows = orders.filter((o) =>
    ["rto", "returned", "failed_delivery", "exchanged"].includes(o.status),
  );
  const rtoValue = rows
    .filter((o) => o.status === "rto" || o.status === "returned")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Returns & COD reconciliation</h1>
        <p className="text-sm text-zinc-500">
          {rows.length} parcels in the returns loop · {money(rtoValue)} still off the books
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">RTO</div>
          <div className="mt-1 text-2xl font-semibold">
            {orders.filter((o) => o.status === "rto").length}
          </div>
        </div>
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Failed attempts
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {orders.filter((o) => o.status === "failed_delivery").length}
          </div>
        </div>
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Uncollected COD
          </div>
          <div className="mt-1 text-2xl font-semibold">{money(rtoValue)}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              {["Order", "Customer", "Carrier", "Reason", "COD", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-3 font-semibold">{o.number}</td>
                <td className="px-4 py-3">
                  {o.customer.name}
                  <div className="text-[11px] text-zinc-400">{o.customer.city}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {carriers.find((c) => c.id === o.carrierId)?.name ?? "—"}
                  <div className="font-mono text-[11px] text-zinc-400">{o.awb}</div>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">{o.rtoReason ?? "—"}</td>
                <td className="px-4 py-3">{money(o.total)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {o.status !== "exchanged" ? (
                      <PrimaryButton className="px-3 py-1 text-xs" onClick={() => createExchange(o.id)}>
                        Exchange
                      </PrimaryButton>
                    ) : null}
                    {o.status !== "returned" ? (
                      <GhostButton
                        className="px-3 py-1 text-xs"
                        onClick={() => markReturnedInspected(o.id, true)}
                      >
                        Restock
                      </GhostButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
