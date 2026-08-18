"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function ShippingPage() {
  const qc = useQueryClient();
  const ready = useQuery({
    queryKey: ["ready-ship"],
    queryFn: () => api<{ rows: Array<{ id: string; number: string; total: string; customer: { name: string; city: string } }> }>("/api/v1/orders?status=CONFIRMED&limit=50"),
  });
  const ships = useQuery({
    queryKey: ["shipments"],
    queryFn: () =>
      api<{
        rows: Array<{ id: string; awb: string | null; status: string; order: { number: string; customer: { name: string } } }>;
      }>("/api/v1/shipments"),
  });
  const carriers = useQuery({
    queryKey: ["carriers"],
    queryFn: () => api<{ rows: Array<{ id: string; name: string; connected: boolean }> }>("/api/v1/carriers"),
  });
  const [selected, setSelected] = useState<string[]>([]);
  const dispatch = useMutation({
    mutationFn: () =>
      api("/api/v1/shipments", {
        method: "POST",
        body: JSON.stringify({ orderIds: selected, carrierId: carriers.data?.rows.find((c) => c.connected)?.id }),
      }),
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries();
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shipping</h1>
          <p className="text-sm text-zinc-500">Demo carrier adapter unless a real integration is connected.</p>
        </div>
        <PrimaryButton disabled={!selected.length} onClick={() => dispatch.mutate()}>
          Dispatch {selected.length || ""}
        </PrimaryButton>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(carriers.data?.rows ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border border-sand bg-white p-4">
            <div className="font-semibold">{c.name}</div>
            <div className="text-xs text-zinc-500">{c.connected ? "Connected (demo or live)" : "Not connected"}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-sand bg-white">
        <div className="px-4 py-3 text-sm font-semibold">Confirmed · ready to ship</div>
        <table className="w-full text-sm">
          <tbody>
            {(ready.data?.rows ?? []).map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))
                    }
                  />
                </td>
                <td className="px-4 py-2 font-semibold">{o.number}</td>
                <td className="px-4 py-2">{o.customer.name}</td>
                <td className="px-4 py-2">{o.customer.city}</td>
                <td className="px-4 py-2">{money(Number(o.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-sand bg-white p-4">
        <div className="text-sm font-semibold">Recent AWBs</div>
        <ul className="mt-2 space-y-1 text-sm">
          {(ships.data?.rows ?? []).slice(0, 12).map((s) => (
            <li key={s.id}>
              {s.order.number} · {s.awb} · {s.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
