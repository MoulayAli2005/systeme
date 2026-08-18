"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { aiReply, confirmOrder, markRead, sendMessage, useAppState } from "@/lib/store";
import { clock, money } from "@/lib/format";
import { StatusBadge, PrimaryButton } from "@/components/ui";

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Opening inbox…</div>}>
      <InboxInner />
    </Suspense>
  );
}

function InboxInner() {
  const { conversations, orders, ai } = useAppState();
  const params = useSearchParams();
  const preset = params.get("c");
  const sorted = [...conversations].sort(
    (a, b) => +new Date(b.lastAt) - +new Date(a.lastAt),
  );
  const [active, setActive] = useState(preset || sorted[0]?.id);
  const conv = conversations.find((c) => c.id === active) ?? sorted[0];
  const order = orders.find((o) => o.id === conv?.orderId);
  const [draft, setDraft] = useState("");

  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!conv || !draft.trim()) return;
    sendMessage(conv.id, draft.trim(), "agent");
    setDraft("");
  }

  function suggest() {
    if (!conv) return;
    const reply = aiReply(conv.lastMessage, {
      orderNumber: order?.number,
      product: order?.items[0]?.name,
    });
    setDraft(reply);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] overflow-hidden rounded-2xl border border-sand bg-white">
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-sand scrollbar-thin">
        <div className="sticky top-0 border-b border-sand bg-white px-3 py-3 text-sm font-semibold">
          Inbox
        </div>
        {sorted.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActive(c.id);
              markRead(c.id);
            }}
            className={`flex w-full flex-col border-b border-sand px-3 py-3 text-left ${conv?.id === c.id ? "bg-paper" : "hover:bg-paper/50"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{c.customerName}</span>
              {c.unread ? (
                <span className="rounded-full bg-mint px-1.5 text-[10px] font-bold text-ink">
                  {c.unread}
                </span>
              ) : (
                <span className="text-[10px] uppercase text-zinc-400">{c.channel}</span>
              )}
            </div>
            <span className="truncate text-xs text-zinc-500">{c.lastMessage}</span>
          </button>
        ))}
      </aside>
      {conv ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-sand px-4 py-3">
            <div>
              <div className="font-semibold">{conv.customerName}</div>
              <div className="text-xs text-zinc-500">
                {conv.phone} · {conv.city} · {conv.channel}
              </div>
            </div>
            {order && ["new", "pending_confirmation"].includes(order.status) ? (
              <PrimaryButton onClick={() => confirmOrder(order.id, "whatsapp")} className="text-xs">
                Confirm order
              </PrimaryButton>
            ) : null}
          </header>
          <div className="wa-bg flex-1 overflow-y-auto p-4 scrollbar-thin">
            {conv.messages.map((m) => (
              <div
                key={m.id}
                className={`mb-2 flex ${m.from === "customer" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === "customer"
                      ? "rounded-tl-sm bg-white"
                      : m.from === "system"
                        ? "bg-white"
                        : m.from === "ai"
                          ? "bg-[#d9fdd3]"
                          : "rounded-tr-sm bg-[#d9fdd3]"
                  }`}
                >
                  {m.from === "ai" || m.from === "system" ? (
                    <div className="mb-1 text-[10px] font-semibold uppercase text-zinc-400">
                      {m.from === "ai" ? ai.name : "Template"}
                    </div>
                  ) : null}
                  {m.text}
                  <div className="mt-1 text-right text-[10px] text-zinc-400">{clock(m.at)}</div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="border-t border-sand p-3">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={suggest}
                className="rounded-full bg-paper px-3 py-1 text-xs font-semibold"
              >
                Draft with {ai.name}
              </button>
              {["We’ll ship today.", "Driver will call before arrival.", "Size M is in stock."].map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft(t)}
                    className="hidden rounded-full bg-paper px-3 py-1 text-xs font-medium md:inline"
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                className="flex-1 rounded-full border border-sand px-4 py-2.5 text-sm"
              />
              <PrimaryButton type="submit">Send</PrimaryButton>
            </div>
          </form>
        </section>
      ) : null}
      {order ? (
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-l border-sand p-4 lg:block">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Linked order
          </div>
          <div className="mt-2 font-semibold">{order.number}</div>
          <div className="mt-1">
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-3 text-sm">
            {order.items.map((it) => (
              <div key={it.productId}>
                {it.name}
                <div className="text-xs text-zinc-500">{it.variant}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm font-semibold">{money(order.total)} COD</div>
          <div className="mt-1 text-xs text-zinc-500">{order.customer.address}</div>
        </aside>
      ) : null}
    </div>
  );
}
