"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Kpi, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

type Overview = {
  count: number;
  revenue: number;
  deliveredRevenue: number;
  confirmationRate: number;
  deliveryRate: number;
  returnRate: number;
  profit: number;
  margin: number;
  aov: number;
  cancelled: number;
  returned: number;
  delivered: number;
  cities: Array<{ city: string; orders: number; deliveryRate: number }>;
  byDay: Array<{ date: string; orders: number }>;
};

type OrderRow = {
  id: string;
  number: string;
  status: string;
  total: string;
  createdAt: string;
  customer: { name: string; city: string };
};

export default function DashboardPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api<Overview>("/api/v1/analytics/overview?days=30"),
  });
  const orders = useQuery({
    queryKey: ["orders-home"],
    queryFn: () => api<{ rows: OrderRow[] }>("/api/v1/orders?limit=8"),
  });
  const pipeline = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => api<{ grouped: Array<{ status: string; _count: number }> }>("/api/v1/orders/pipeline"),
  });

  if (overview.isLoading) return <p className="text-sm text-zinc-500">Loading dashboard…</p>;
  if (overview.error) return <p className="text-sm text-rose-600">Could not load analytics.</p>;
  const d = overview.data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations dashboard</h1>
        <p className="text-sm text-zinc-500">Last 30 days · tenant-scoped · live from Postgres</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders" value={String(d.count)} hint={`AOV ${money(d.aov)}`} />
        <Kpi label="Confirmation rate" value={`${d.confirmationRate}%`} delta={`${d.delivered} delivered`} good />
        <Kpi label="Delivered revenue" value={money(d.deliveredRevenue)} hint={`Net ${money(d.profit)}`} />
        <Kpi label="Return rate" value={`${d.returnRate}%`} good={d.returnRate < 12} />
      </div>
      <div className="rounded-2xl border border-sand bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Pipeline</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {(pipeline.data?.grouped ?? []).map((g) => (
            <Link key={g.status} href={`/app/orders?status=${g.status}`} className="rounded-xl bg-paper px-3 py-3">
              <div className="text-xl font-semibold">{g._count}</div>
              <div className="mt-1 text-[11px] font-medium text-zinc-500">{g.status}</div>
            </Link>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold">Latest orders</div>
          <Link href="/app/orders" className="text-xs font-semibold text-zinc-500">
            View all
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <tbody>
            {(orders.data?.rows ?? []).map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-2.5 font-semibold">
                  <Link href={`/app/orders/${o.id}`}>{o.number}</Link>
                </td>
                <td className="px-4 py-2.5">
                  {o.customer.name}
                  <div className="text-[11px] text-zinc-400">{o.customer.city}</div>
                </td>
                <td className="px-4 py-2.5">{money(Number(o.total))}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
