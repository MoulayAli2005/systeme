"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostButton, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function ReturnsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["returns"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          status: string;
          reason: string | null;
          order: { number: string; total: string; customer: { name: string; city: string } };
        }>;
      }>("/api/v1/returns?limit=100"),
  });
  const patch = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api(`/api/v1/returns/${input.id}`, { method: "PATCH", body: JSON.stringify({ status: input.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["returns"] }),
  });

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading returns…</p>;
  if (!q.data?.rows.length) return <p className="text-sm text-zinc-500">No returns in this workspace.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Returns</h1>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase text-zinc-400">
            <tr>
              {["Order", "Customer", "Reason", "COD", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.data.rows.map((r) => (
              <tr key={r.id} className="border-t border-sand">
                <td className="px-4 py-3 font-semibold">{r.order.number}</td>
                <td className="px-4 py-3">
                  {r.order.customer.name}
                  <div className="text-[11px] text-zinc-400">{r.order.customer.city}</div>
                </td>
                <td className="px-4 py-3 text-xs">{r.reason}</td>
                <td className="px-4 py-3">{money(Number(r.order.total))}</td>
                <td className="px-4 py-3 text-xs">{r.status}</td>
                <td className="px-4 py-3">
                  <GhostButton className="text-xs" onClick={() => patch.mutate({ id: r.id, status: "INSPECTED" })}>
                    Inspect
                  </GhostButton>
                  <PrimaryButton className="ml-1 text-xs" onClick={() => patch.mutate({ id: r.id, status: "REPLACED" })}>
                    Exchange
                  </PrimaryButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
