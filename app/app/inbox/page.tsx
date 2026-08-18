"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { clock } from "@/lib/format";

type Conv = {
  id: string;
  channel: string;
  unread: number;
  lastMessage: string | null;
  customer: { name: string; phone: string; city: string };
  messages: Array<{ id: string; from: string; text: string; createdAt: string }>;
};

export default function InboxPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["inbox"], queryFn: () => api<{ rows: Conv[] }>("/api/v1/inbox?limit=50") });
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const conv = (q.data?.rows ?? []).find((c) => c.id === active) ?? q.data?.rows[0];
  const send = useMutation({
    mutationFn: (text: string) =>
      api(`/api/v1/inbox/${conv!.id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  if (q.isLoading) return <p className="text-sm text-zinc-500">Opening inbox…</p>;

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] overflow-hidden rounded-2xl border border-sand bg-white">
      <aside className="w-[260px] overflow-y-auto border-r border-sand">
        {(q.data?.rows ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`w-full border-b border-sand px-3 py-3 text-left ${conv?.id === c.id ? "bg-paper" : ""}`}
          >
            <div className="text-sm font-semibold">{c.customer.name}</div>
            <div className="truncate text-xs text-zinc-500">{c.lastMessage}</div>
          </button>
        ))}
      </aside>
      {conv ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-sand px-4 py-3">
            <div className="font-semibold">{conv.customer.name}</div>
            <div className="text-xs text-zinc-500">
              {conv.channel} · {conv.customer.phone} · {conv.customer.city}
            </div>
          </header>
          <div className="wa-bg flex-1 overflow-y-auto p-4">
            {conv.messages.map((m) => (
              <div key={m.id} className={`mb-2 flex ${m.from === "customer" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === "customer" ? "bg-white" : "bg-[#d9fdd3]"}`}>
                  {m.text}
                  <div className="text-right text-[10px] text-zinc-400">{clock(m.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-sand p-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (draft.trim()) send.mutate(draft.trim());
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 rounded-full border border-sand px-4 py-2 text-sm"
              placeholder="Message…"
            />
            <PrimaryButton type="submit">Send</PrimaryButton>
          </form>
        </section>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">No conversations yet.</div>
      )}
    </div>
  );
}
