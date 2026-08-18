"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function PlatformPage() {
  const orgs = useQuery({
    queryKey: ["plat-orgs"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          name: string;
          slug: string;
          plan: string;
          _count: { orders: number; memberships: number; stores: number };
        }>;
      }>("/api/v1/platform/organizations"),
  });
  const health = useQuery({
    queryKey: ["plat-health"],
    queryFn: () => api<{ ok: boolean; checks: Record<string, { ok: boolean; detail?: string }> }>("/api/v1/platform/health"),
  });

  if (orgs.error) {
    return <p className="text-sm text-rose-600">Platform admin only. Sign in as nina.v@example.com / ChangeMeAdmin!</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Platform admin</h1>
      <div className="rounded-2xl border border-sand bg-white p-4 text-sm">
        <div className="font-semibold">Health {health.data?.ok ? "OK" : "…"}</div>
        <pre className="mt-2 text-xs">{JSON.stringify(health.data?.checks, null, 2)}</pre>
      </div>
      <div className="overflow-hidden rounded-2xl border border-sand bg-white">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase text-zinc-400">
            <tr>
              {["Org", "Plan", "Users", "Stores", "Orders"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(orgs.data?.rows ?? []).map((o) => (
              <tr key={o.id} className="border-t border-sand">
                <td className="px-4 py-3">
                  {o.name}
                  <div className="text-[11px] text-zinc-400">{o.slug}</div>
                </td>
                <td className="px-4 py-3">{o.plan}</td>
                <td className="px-4 py-3">{o._count.memberships}</td>
                <td className="px-4 py-3">{o._count.stores}</td>
                <td className="px-4 py-3">{o._count.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
