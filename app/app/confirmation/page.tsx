"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { PrimaryButton, GhostButton, StatusBadge, Avatar } from "@/components/ui";
import { cancelOrder, confirmOrder, useAppState } from "@/lib/store";
import { money, relativeTime } from "@/lib/format";

export default function ConfirmationPage() {
  const { orders, agents, conversations } = useAppState();
  const queue = orders.filter((o) => o.status === "new" || o.status === "pending_confirmation");
  const [activeId, setActiveId] = useState(queue[0]?.id);
  const order = orders.find((o) => o.id === activeId) ?? queue[0];
  const conv = conversations.find((c) => c.orderId === order?.id);
  const script = order
    ? `Salam ${order.customer.name.split(" ")[0]}, Atlas Atelier. Confirming ${order.items[0]?.name} for ${money(order.total)} COD to ${order.customer.city}. Good for delivery tomorrow?`
    : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Confirmation desk</h1>
        <p className="text-sm text-zinc-500">
          {queue.length} orders waiting · WhatsApp first, call as fallback
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
        <div className="rounded-2xl border border-sand bg-white">
          <div className="border-b border-sand px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Queue
          </div>
          <ul className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {queue.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setActiveId(o.id)}
                  className={`w-full border-b border-sand px-3 py-3 text-left text-sm hover:bg-paper ${order?.id === o.id ? "bg-paper" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{o.number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {o.customer.name} · {o.customer.city}
                  </div>
                  <div className="text-[11px] text-zinc-400">{relativeTime(o.createdAt)}</div>
                </button>
              </li>
            ))}
            {queue.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-zinc-500">Queue is clear.</li>
            ) : null}
          </ul>
        </div>

        {order ? (
          <div className="rounded-2xl border border-sand bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{order.customer.name}</div>
                <div className="text-sm text-zinc-500">
                  {order.customer.phone} · {order.customer.city}
                </div>
              </div>
              <Link href={`/app/orders/${order.id}`} className="text-xs font-semibold">
                Full order →
              </Link>
            </div>
            <div className="mt-4 rounded-xl bg-paper p-4 text-sm">
              {order.items.map((it) => (
                <div key={it.productId} className="flex justify-between">
                  <span>
                    {it.name} · {it.variant}
                  </span>
                  <span className="font-semibold">{money(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
                {order.payment === "cod" ? "Cash on delivery" : "Prepaid"}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Call script
              </div>
              <p className="mt-2 rounded-xl border border-sand bg-paper/50 p-3 text-sm leading-6">
                {script}
              </p>
            </div>
            {conv ? (
              <div className="mt-4 wa-bg rounded-xl p-3">
                {conv.messages.slice(-3).map((m) => (
                  <div
                    key={m.id}
                    className={`mb-2 max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "customer" ? "bg-white" : "ml-auto bg-[#d9fdd3]"}`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => confirmOrder(order.id, "whatsapp")}>
                <MessageCircle size={15} /> Confirm via WhatsApp
              </PrimaryButton>
              <GhostButton onClick={() => confirmOrder(order.id, "call")}>
                <Phone size={15} /> Confirmed on call
              </GhostButton>
              <GhostButton onClick={() => cancelOrder(order.id, "No answer ×2")}>
                No answer
              </GhostButton>
              <GhostButton onClick={() => cancelOrder(order.id)}>Cancel order</GhostButton>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-sand bg-white p-10 text-center text-sm text-zinc-500">
            Nothing left to confirm.
          </div>
        )}

        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="text-sm font-semibold">Agents on desk</div>
          <ul className="mt-3 space-y-3">
            {agents
              .filter((a) => a.role === "confirmation" || a.role === "owner")
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Avatar initials={a.initials} hue={a.hue} />
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {a.confirmedToday} today · {a.avgConfirmMin}m
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
