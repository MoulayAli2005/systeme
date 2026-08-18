"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field, inputClass, PrimaryButton, ProductSwatch } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function ProductsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["products"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          name: string;
          sku: string;
          category: string | null;
          price: string;
          hue: number;
          variants: Array<{ inventory: Array<{ onHand: number; reserved: number }> }>;
        }>;
      }>("/api/v1/products?limit=100"),
  });
  const create = useMutation({
    mutationFn: (body: { name: string; sku: string; price: number; cost: number; category?: string }) =>
      api("/api/v1/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    create.mutate({
      name: String(data.get("name")),
      sku: String(data.get("sku")),
      price: Number(data.get("price")),
      cost: Number(data.get("cost") || 0),
      category: String(data.get("category") || "") || undefined,
    });
    e.currentTarget.reset();
  }

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading catalog…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Catalog</h1>
      <form className="grid gap-2 rounded-2xl border border-sand bg-white p-4 sm:grid-cols-5" onSubmit={onCreate}>
        <Field label="Name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="SKU">
          <input name="sku" required className={inputClass} />
        </Field>
        <Field label="Price">
          <input name="price" type="number" required className={inputClass} />
        </Field>
        <Field label="Cost">
          <input name="cost" type="number" className={inputClass} />
        </Field>
        <div className="flex items-end">
          <PrimaryButton type="submit">Add product</PrimaryButton>
        </div>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(q.data?.rows ?? []).map((p) => {
          const stock = p.variants.flatMap((v) => v.inventory).reduce((s, i) => s + i.onHand - i.reserved, 0);
          return (
            <article key={p.id} className="rounded-2xl border border-sand bg-white p-4">
              <ProductSwatch hue={p.hue} className="h-24 w-full" />
              <div className="mt-3 text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-500">{p.sku}</div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="font-semibold">{money(Number(p.price))}</span>
                <span className={stock < 12 ? "text-amber-700" : "text-zinc-500"}>{stock} available</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
