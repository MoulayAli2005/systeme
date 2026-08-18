"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const COLUMNS = ["NEW", "TO_CONFIRM", "CALLING", "CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];

export default function PipelinePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["kanban"],
    queryFn: () =>
      api<{ rows: Array<{ id: string; number: string; status: string; customer: { name: string; city: string } }> }>(
        "/api/v1/orders?limit=100",
      ),
  });
  const move = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api(`/api/v1/orders/${input.id}/status`, { method: "POST", body: JSON.stringify({ status: input.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban"] }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Order pipeline</h1>
        <p className="text-sm text-zinc-500">Move cards to change status (triggers automations + audit).</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col} className="w-56 shrink-0 rounded-2xl bg-white p-2 ring-1 ring-sand">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{col.replaceAll("_", " ")}</div>
            {(q.data?.rows ?? [])
              .filter((o) => o.status === col)
              .map((o) => (
                <button
                  key={o.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("id", o.id)}
                  className="mb-2 w-full rounded-xl bg-paper p-3 text-left text-xs"
                >
                  <div className="font-semibold">{o.number}</div>
                  <div className="text-zinc-500">{o.customer.name}</div>
                </button>
              ))}
            <div
              className="min-h-8 rounded-xl border border-dashed border-sand"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("id");
                if (id) move.mutate({ id, status: col });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
