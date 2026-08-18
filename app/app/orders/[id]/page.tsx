"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostButton } from "@/components/ui";
import { api } from "@/lib/api";
import { clock, money } from "@/lib/format";

type Order = {
  id: string;
  number: string;
  status: string;
  source: string;
  total: string;
  paymentMethod: string;
  notes?: string;
  duplicateOfId?: string | null;
  riskScore: number;
  customer: { name: string; phone: string; city: string; address?: string | null };
  items: Array<{ name: string; variant?: string | null; quantity: number; price: string }>;
  events: Array<{ id: string; title: string; detail?: string | null; tone: string; createdAt: string }>;
  agent?: { name: string } | null;
  shipments: Array<{ awb?: string | null; status: string }>;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<Order>(`/api/v1/orders/${id}`),
  });
  const status = useMutation({
    mutationFn: (next: string) =>
      api(`/api/v1/orders/${id}/status`, { method: "POST", body: JSON.stringify({ status: next }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
  });

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading order…</p>;
  if (q.error || !q.data) {
    return (
      <p className="text-sm text-rose-600">
        Order not found. <Link href="/app/orders">Back</Link>
      </p>
    );
  }
  const order = q.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/orders" className="text-xs font-semibold text-zinc-500">
            ← Orders
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {order.number}{" "}
            <span className="text-sm font-medium text-zinc-500">{order.status}</span>
          </h1>
          <p className="text-sm text-zinc-500">
            {order.source} · risk {order.riskScore}
            {order.duplicateOfId ? " · potential duplicate" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "CALLBACK"].map((s) => (
            <GhostButton key={s} onClick={() => status.mutate(s)} className="text-xs">
              {s}
            </GhostButton>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Customer</div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>{order.customer.name}</div>
            <div>{order.customer.phone}</div>
            <div>{order.customer.city}</div>
            <div>{order.customer.address}</div>
          </div>
        </section>
        <section className="rounded-2xl border border-sand bg-white p-5">
          <div className="text-sm font-semibold">Items · {order.paymentMethod.toUpperCase()}</div>
          <ul className="mt-3 space-y-2 text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {it.name} ×{it.quantity}
                </span>
                <span>{money(Number(it.price) * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 font-semibold">{money(Number(order.total))}</div>
        </section>
      </div>
      <section className="rounded-2xl border border-sand bg-white p-5">
        <div className="text-sm font-semibold">Timeline</div>
        <ol className="mt-3 space-y-2 text-sm">
          {order.events.map((ev) => (
            <li key={ev.id}>
              <span className="font-medium">{ev.title}</span>
              {ev.detail ? <span className="text-zinc-500"> — {ev.detail}</span> : null}
              <div className="text-[11px] text-zinc-400">{clock(ev.createdAt)}</div>
            </li>
          ))}
        </ol>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const note = String(new FormData(e.currentTarget).get("note") || "");
            if (!note) return;
            await api(`/api/v1/orders/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) });
            qc.invalidateQueries({ queryKey: ["order", id] });
            e.currentTarget.reset();
          }}
        >
          <input name="note" className="flex-1 rounded-xl border border-sand px-3 py-2 text-sm" placeholder="Add a note…" />
          <GhostButton type="submit">Save note</GhostButton>
        </form>
        {order.shipments[0]?.awb ? (
          <p className="mt-3 text-sm">
            AWB{" "}
            <Link className="font-mono underline" href={`/t/${order.shipments[0].awb}`}>
              {order.shipments[0].awb}
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
