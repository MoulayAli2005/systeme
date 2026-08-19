"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PrimaryButton, GhostButton } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

type Row = {
  id: string;
  number: string;
  status: string;
  total: string;
  callAttempts: number;
  customer: { name: string; phone: string; city: string };
  items: Array<{ name: string; variant?: string | null }>;
};

export default function CallCenterPage() {
  const qc = useQueryClient();
  const [state, setState] = useState("available");
  const queue = useQuery({
    queryKey: ["cc-queue"],
    queryFn: () => api<{ rows: Row[] }>("/api/v1/call-center/queue"),
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const order = (queue.data?.rows ?? []).find((o) => o.id === activeId) ?? queue.data?.rows[0];
  const confirm = useMutation({
    mutationFn: (status: string) =>
      api(`/api/v1/orders/${order!.id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-queue"] }),
  });
  const call = useMutation({
    mutationFn: () =>
      api("/api/v1/call-center/call", {
        method: "POST",
        body: JSON.stringify({ orderId: order!.id, to: order!.customer.phone }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-queue"] }),
  });

  if (queue.isLoading) return <p className="text-sm text-zinc-500">Loading queue…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Call center</h1>
          <p className="text-sm text-zinc-500">
            {queue.data?.rows.length ?? 0} in queue · WhatsApp automation handles the first ping — this desk is the fallback.
            Twilio voice if TWILIO_* env vars are set, otherwise demo dialer.
          </p>
        </div>
        <div className="flex gap-2">
          {["available", "busy", "break", "offline"].map((s) => (
            <button
              key={s}
              onClick={async () => {
                setState(s);
                await api("/api/v1/call-center/presence", { method: "POST", body: JSON.stringify({ state: s }) });
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${state === s ? "bg-ink text-white" : "bg-white ring-1 ring-sand"}`}
            >
              {s}
            </button>
          ))}
          <GhostButton
            onClick={async () => {
              const r = await api<{ order: Row | null }>("/api/v1/call-center/next");
              if (r.order) setActiveId(r.order.id);
              qc.invalidateQueries({ queryKey: ["cc-queue"] });
            }}
          >
            Next (least loaded)
          </GhostButton>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-sand bg-white">
          {(queue.data?.rows ?? []).map((o) => (
            <button
              key={o.id}
              onClick={() => setActiveId(o.id)}
              className={`w-full border-b border-sand px-3 py-3 text-left text-sm ${order?.id === o.id ? "bg-paper" : ""}`}
            >
              <div className="font-semibold">{o.number}</div>
              <div className="text-xs text-zinc-500">
                {o.customer.name} · {o.status} · {o.callAttempts} attempts
              </div>
            </button>
          ))}
          {!queue.data?.rows.length ? <p className="p-6 text-sm text-zinc-500">Queue is clear.</p> : null}
        </div>
        {order ? (
          <div className="rounded-2xl border border-sand bg-white p-5">
            <div className="text-lg font-semibold">{order.customer.name}</div>
            <div className="text-sm text-zinc-500">
              {order.customer.phone} · {order.customer.city}
            </div>
            <p className="mt-4 rounded-xl bg-paper p-3 text-sm">
              Salam {order.customer.name.split(" ")[0]}, confirming {order.items[0]?.name} for {money(Number(order.total))}{" "}
              COD to {order.customer.city}. Good for delivery tomorrow?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => confirm.mutate("CONFIRMED")}>Confirm</PrimaryButton>
              <GhostButton onClick={() => void call.mutate()}>Dial (provider)</GhostButton>
              <GhostButton onClick={() => confirm.mutate("NO_ANSWER")}>No answer</GhostButton>
              <GhostButton onClick={() => confirm.mutate("CALLBACK")}>Callback</GhostButton>
              <GhostButton onClick={() => confirm.mutate("CANCELLED")}>Cancel</GhostButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
