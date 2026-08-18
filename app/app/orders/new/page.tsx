"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Field, inputClass, PrimaryButton, GhostButton } from "@/components/ui";
import { api } from "@/lib/api";

export default function NewOrderPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const products = useQuery({
    queryKey: ["products-mini"],
    queryFn: () =>
      api<{ rows: Array<{ name: string; price: string; variants: Array<{ id: string; name: string; price: string }> }> }>(
        "/api/v1/products?limit=20",
      ),
  });
  const [variantId, setVariantId] = useState<string>("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const product = products.data?.rows.find((p) => p.variants.some((v) => v.id === variantId)) ?? products.data?.rows[0];
    const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0];
    if (!variant || !product) {
      setError("No product in catalog yet.");
      return;
    }
    try {
      const res = await api<{
        order: { id: string };
        duplicates: unknown[];
        risk?: { score: number; requireManualVerification: boolean };
      }>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: {
            name: String(data.get("name")),
            phone: String(data.get("phone")),
            city: String(data.get("city")),
            address: String(data.get("address") || ""),
          },
          items: [
            {
              name: product.name,
              variant: variant.name,
              quantity: 1,
              price: Number(variant.price),
              variantId: variant.id,
            },
          ],
        }),
      });
      if (res.duplicates.length) {
        window.alert(
          `Order created with a potential-duplicate warning (${res.duplicates.length} recent match${res.duplicates.length > 1 ? "es" : ""} on this phone).`,
        );
      }
      router.push(`/app/orders/${res.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">New order</h1>
        <p className="text-sm text-zinc-500">Creates a COD order and runs automations (WhatsApp confirm in demo mode).</p>
      </div>
      <form className="space-y-4 rounded-2xl border border-sand bg-white p-5" onSubmit={onSubmit}>
        <Field label="Customer name">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" required className={inputClass} placeholder="+212 6…" />
        </Field>
        <Field label="City">
          <input name="city" required className={inputClass} defaultValue="Casablanca" />
        </Field>
        <Field label="Address">
          <input name="address" className={inputClass} />
        </Field>
        <Field label="Product">
          <select className={inputClass} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Select…</option>
            {(products.data?.rows ?? []).flatMap((p) =>
              p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {p.name} · {v.name} · {v.price}
                </option>
              )),
            )}
          </select>
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <PrimaryButton type="submit">Create</PrimaryButton>
          <GhostButton type="button" onClick={() => router.back()}>
            Cancel
          </GhostButton>
        </div>
      </form>
    </div>
  );
}
