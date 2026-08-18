"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["customer", id],
    queryFn: () =>
      api<{
        name: string;
        phone: string;
        city: string;
        riskLabel: string;
        orders: Array<{ id: string; number: string; status: string; total: string }>;
      }>(`/api/v1/customers/${id}`),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading customer…</p>;
  if (!q.data) return <p className="text-sm text-rose-600">Not found.</p>;
  return (
    <div className="space-y-4">
      <Link href="/app/customers" className="text-xs font-semibold text-zinc-500">
        ← Customers
      </Link>
      <h1 className="text-2xl font-semibold">{q.data.name}</h1>
      <p className="text-sm text-zinc-500">
        {q.data.phone} · {q.data.city} · {q.data.riskLabel}
      </p>
      <ul className="rounded-2xl border border-sand bg-white p-4 text-sm">
        {q.data.orders.map((o) => (
          <li key={o.id} className="flex justify-between border-b border-sand py-2 last:border-0">
            <Link href={`/app/orders/${o.id}`}>{o.number}</Link>
            <span>
              {o.status} · {money(Number(o.total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
