"use client";

import { useState } from "react";
import { PrimaryButton, GhostButton, Field, inputClass, ProductSwatch } from "@/components/ui";
import { addManualOrder } from "@/lib/store";
import { useAppState } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function NewOrderPage() {
  const { products } = useAppState();
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New order</h1>
        <p className="text-sm text-zinc-500">Creates a COD order and a WhatsApp confirmation thread.</p>
      </div>
      <form
        className="space-y-4 rounded-2xl border border-sand bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const id = addManualOrder({
            name: String(data.get("name")),
            phone: String(data.get("phone")),
            city: String(data.get("city")),
            productId,
          });
          router.push(`/app/orders/${id}`);
        }}
      >
        <Field label="Customer name">
          <input name="name" required className={inputClass} placeholder="Sara Benjelloun" />
        </Field>
        <Field label="Phone">
          <input name="phone" required className={inputClass} placeholder="+212 6 …" />
        </Field>
        <Field label="City">
          <input name="city" required className={inputClass} placeholder="Casablanca" />
        </Field>
        <Field label="Product">
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setProductId(p.id)}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs ${productId === p.id ? "border-ink bg-paper" : "border-sand"}`}
              >
                <ProductSwatch hue={p.imageHue} className="h-8 w-8" />
                <span>
                  {p.name}
                  <span className="block text-zinc-500">{p.price} MAD</span>
                </span>
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-2">
          <PrimaryButton type="submit">Create & send WhatsApp</PrimaryButton>
          <GhostButton type="button" onClick={() => router.back()}>
            Cancel
          </GhostButton>
        </div>
      </form>
    </div>
  );
}
