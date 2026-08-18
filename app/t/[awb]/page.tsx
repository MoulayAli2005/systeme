"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { StatusBadge } from "@/components/ui";
import { hydrateStore, useAppState } from "@/lib/store";
import { money } from "@/lib/format";
import { useEffect } from "react";

export default function TrackPage() {
  const { awb } = useParams<{ awb: string }>();
  const { orders, carriers } = useAppState();
  useEffect(() => {
    hydrateStore();
  }, []);
  const order = useMemo(
    () => orders.find((o) => o.awb?.toLowerCase() === decodeURIComponent(awb).toLowerCase()),
    [orders, awb],
  );
  const carrier = carriers.find((c) => c.id === order?.carrierId);

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-lg px-5 py-10">
        <Link href="/">
          <Wordmark />
        </Link>
        <h1 className="mt-10 font-display text-3xl tracking-tight">Track your parcel</h1>
        <p className="mt-2 text-sm text-zinc-500">AWB {decodeURIComponent(awb)}</p>
        {order ? (
          <div className="mt-8 rounded-3xl border border-sand bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{order.number}</div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              {order.items[0]?.name} · {money(order.total)} · {order.customer.city}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {carrier?.name} · pay {order.payment === "cod" ? "cash to the driver" : "already paid"}
            </div>
            <ol className="mt-6 space-y-3">
              {order.timeline.map((ev) => (
                <li key={ev.id} className="text-sm">
                  <div className="font-medium">{ev.title}</div>
                  {ev.detail ? <div className="text-xs text-zinc-500">{ev.detail}</div> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-8 text-sm text-zinc-600">
            No parcel with that tracking number in this demo workspace. Try{" "}
            <span className="font-mono">OZ771042659CR12</span>.
          </p>
        )}
      </div>
    </div>
  );
}
