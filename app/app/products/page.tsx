"use client";

import { ProductSwatch } from "@/components/ui";
import { useAppState } from "@/lib/store";
import { money } from "@/lib/format";

export default function ProductsPage() {
  const { products, orders } = useAppState();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-zinc-500">Stock from Shopify + warehouse Casablanca</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => {
          const sold = orders
            .flatMap((o) => o.items)
            .filter((i) => i.productId === p.id)
            .reduce((s, i) => s + i.qty, 0);
          return (
            <article key={p.id} className="rounded-2xl border border-sand bg-white p-4">
              <ProductSwatch hue={p.imageHue} className="h-28 w-full" />
              <div className="mt-3 text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-500">{p.variant}</div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-semibold">{money(p.price)}</span>
                <span className={p.stock < 12 ? "text-amber-700" : "text-zinc-500"}>
                  {p.stock} in stock
                </span>
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-400">
                {p.sku} · {sold} in pipeline
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
