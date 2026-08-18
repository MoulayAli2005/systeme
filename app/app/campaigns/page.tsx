"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function CampaignsPage() {
  const q = useQuery({
    queryKey: ["campaigns"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          name: string;
          platform: string;
          ads: Array<{ name: string; spend: Array<{ spend: string; clicks: number; impressions: number }> }>;
        }>;
      }>("/api/v1/campaigns"),
  });
  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading campaigns…</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Marketing attribution</h1>
        <p className="text-sm text-zinc-500">
          Meta/TikTok/Google adapters exist. Live spend import requires OAuth credentials — demo spend is seeded.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(q.data?.rows ?? []).map((c) => {
          const spend = c.ads.flatMap((a) => a.spend).reduce((s, x) => s + Number(x.spend), 0);
          return (
            <article key={c.id} className="rounded-2xl border border-sand bg-white p-5">
              <div className="text-xs uppercase text-zinc-400">{c.platform}</div>
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="mt-2 text-lg font-semibold">{money(spend)} spend</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
