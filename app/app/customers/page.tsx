"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function CustomersPage() {
  const q = useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          name: string;
          phone: string;
          city: string;
          riskLabel: string;
          riskScore: number;
          _count: { orders: number };
        }>;
      }>("/api/v1/customers?limit=50"),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading customers…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <table className="w-full text-sm">
          <tbody>
            {(q.data?.rows ?? []).map((c) => (
              <tr key={c.id} className="border-t border-sand">
                <td className="px-4 py-3">
                  <Link href={`/app/customers/${c.id}`} className="font-semibold">
                    {c.name}
                  </Link>
                  <div className="text-[11px] text-zinc-400">{c.phone}</div>
                </td>
                <td className="px-4 py-3">{c.city}</td>
                <td className="px-4 py-3">{c._count.orders} orders</td>
                <td className="px-4 py-3 text-xs">
                  {c.riskLabel} ({c.riskScore})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
