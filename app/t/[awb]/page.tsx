"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Wordmark } from "@/components/brand";
import { api } from "@/lib/api";

export default function TrackPage() {
  const { awb } = useParams<{ awb: string }>();
  const code = decodeURIComponent(awb);
  const q = useQuery({
    queryKey: ["track", code],
    queryFn: () =>
      api<{ awb: string; status: string; orderNumber: string; city: string }>(`/api/v1/track/${encodeURIComponent(code)}`),
  });
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-lg px-5 py-10">
        <Link href="/">
          <Wordmark />
        </Link>
        <h1 className="mt-10 font-display text-3xl">Track {code}</h1>
        {q.isLoading ? <p className="mt-6 text-sm text-zinc-500">Looking up…</p> : null}
        {q.data ? (
          <div className="mt-6 rounded-3xl border border-sand bg-white p-6">
            <div className="font-semibold">{q.data.orderNumber}</div>
            <div className="text-sm text-zinc-600">{q.data.city}</div>
            <div className="mt-2 text-sm">{q.data.status}</div>
          </div>
        ) : null}
        {q.isError ? <p className="mt-6 text-sm text-zinc-600">No parcel with that tracking number.</p> : null}
      </div>
    </div>
  );
}
