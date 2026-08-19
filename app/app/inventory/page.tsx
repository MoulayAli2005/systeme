"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Field, inputClass, PrimaryButton } from "@/components/ui";

export default function InventoryPage() {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState("");
  const q = useQuery({
    queryKey: ["inventory"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          onHand: number;
          reserved: number;
          incoming: number;
          damaged: number;
          warehouse: { name: string };
          variant: { name: string; sku: string; product: { name: string } };
        }>;
      }>("/api/v1/inventory?limit=100"),
  });
  const adjust = useMutation({
    mutationFn: (body: { itemId: string; quantity: number; type: "adjust" | "receive" | "damage"; reason?: string }) =>
      api("/api/v1/inventory/adjust", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  function onAdjust(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!itemId) return;
    adjust.mutate({
      itemId,
      quantity: Number(data.get("quantity")),
      type: String(data.get("type")) as "adjust" | "receive" | "damage",
      reason: String(data.get("reason") || "manual"),
    });
  }

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading inventory…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border border-sand bg-white p-4" onSubmit={onAdjust}>
        <Field label="Item">
          <select className={inputClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select…</option>
            {(q.data?.rows ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.variant.product.name} · {r.warehouse.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Qty">
          <input name="quantity" type="number" defaultValue={1} className={inputClass} />
        </Field>
        <Field label="Type">
          <select name="type" className={inputClass}>
            <option value="adjust">Adjust on-hand</option>
            <option value="receive">Receive</option>
            <option value="damage">Damage</option>
          </select>
        </Field>
        <Field label="Reason">
          <input name="reason" className={inputClass} placeholder="Cycle count" />
        </Field>
        <PrimaryButton type="submit">Apply</PrimaryButton>
      </form>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-zinc-400">
            <tr>
              {["Product", "Variant", "Warehouse", "On hand", "Reserved", "Available"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(q.data?.rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-sand">
                <td className="px-4 py-2">{r.variant.product.name}</td>
                <td className="px-4 py-2 text-xs">{r.variant.name}</td>
                <td className="px-4 py-2">{r.warehouse.name}</td>
                <td className="px-4 py-2">{r.onHand}</td>
                <td className="px-4 py-2">{r.reserved}</td>
                <td className="px-4 py-2 font-semibold">{r.onHand - r.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
