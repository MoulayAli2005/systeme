"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GhostButton, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { money, relativeTime } from "@/lib/format";

const filters = ["ALL", "NEW", "TO_CONFIRM", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

type Row = {
  id: string;
  number: string;
  status: string;
  total: string;
  source: string;
  createdAt: string;
  customer: { name: string; city: string; phone: string };
  items: Array<{ name: string }>;
  agent?: { name: string } | null;
};

function OrdersInner() {
  const params = useSearchParams();
  const initial = params.get("status") ?? "ALL";
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["orders", status, q],
    queryFn: () =>
      api<{ rows: Row[]; nextCursor: string | null }>(
        `/api/v1/orders?limit=50${status !== "ALL" ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      ),
  });
  const bulk = useMutation({
    mutationFn: (body: { ids: string[]; action: "status" | "ship"; value?: string }) =>
      api("/api/v1/orders/bulk", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-zinc-500">Cursor-paginated · never dumps the full 5k into the browser</p>
        </div>
        <Link href="/app/orders/new">
          <PrimaryButton>New order</PrimaryButton>
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === f ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-sand"}`}
          >
            {f.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search number, name, phone, AWB…"
        className="w-full max-w-xs rounded-xl border border-sand bg-white px-3 py-2 text-sm"
      />
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => bulk.mutate({ ids: selected, action: "status", value: "CONFIRMED" })}>
            Confirm
          </GhostButton>
          <GhostButton onClick={() => bulk.mutate({ ids: selected, action: "ship" })}>Create shipment</GhostButton>
          <GhostButton
            onClick={async () => {
              const res = await fetch("/api/v1/export/orders", { credentials: "include" });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "orders.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </GhostButton>
        </div>
      ) : null}
      {list.isLoading ? <p className="text-sm text-zinc-500">Loading orders…</p> : null}
      {list.isError ? <p className="text-sm text-rose-600">Could not load orders.</p> : null}
      {!list.isLoading && !list.data?.rows.length ? (
        <p className="rounded-2xl border border-sand bg-white p-8 text-sm text-zinc-500">No orders match these filters.</p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3 w-8" />
              {["Order", "Customer", "Items", "Total", "Source", "Agent", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(list.data?.rows ?? []).map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/app/orders/${o.id}`} className="font-semibold">
                    {o.number}
                  </Link>
                  <div className="text-[11px] text-zinc-400">{relativeTime(o.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  {o.customer.name}
                  <div className="text-[11px] text-zinc-400">
                    {o.customer.city} · {o.customer.phone}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">{o.items[0]?.name}</td>
                <td className="px-4 py-3">{money(Number(o.total))}</td>
                <td className="px-4 py-3 text-xs">{o.source}</td>
                <td className="px-4 py-3 text-xs">{o.agent?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading orders…</p>}>
      <OrdersInner />
    </Suspense>
  );
}
