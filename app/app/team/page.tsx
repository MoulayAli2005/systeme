"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/api";

export default function TeamPage() {
  const q = useQuery({
    queryKey: ["team"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          state: string;
          confirmedToday: number;
          avgConfirmMin: number;
          hue: number;
          user: { name: string; email: string };
          team: { name: string } | null;
        }>;
      }>("/api/v1/team"),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading team…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.rows ?? []).map((a) => (
          <article key={a.id} className="flex gap-3 rounded-2xl border border-sand bg-white p-5">
            <Avatar initials={a.user.name.slice(0, 2).toUpperCase()} hue={a.hue} size={44} />
            <div>
              <div className="font-semibold">{a.user.name}</div>
              <div className="text-xs text-zinc-500">{a.user.email}</div>
              <div className="mt-1 text-sm">
                {a.state} · {a.confirmedToday} confirmed · {a.avgConfirmMin}m
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
