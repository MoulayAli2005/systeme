"use client";

import { FormEvent, useState } from "react";
import { Toggle, Field, inputClass, PrimaryButton } from "@/components/ui";
import { aiReply, updateAi, useAppState } from "@/lib/store";

export default function AiAgentPage() {
  const { ai, products } = useAppState();
  const [log, setLog] = useState<Array<{ from: "you" | "ai"; text: string }>>([
    {
      from: "ai",
      text: `Hi, I’m ${ai.name}. I can confirm COD orders, check stock, and share tracking in French, Arabic, English or Darija.`,
    },
  ]);
  const [draft, setDraft] = useState("wakha confirm the beige shirt to marrakech");

  function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const reply = aiReply(draft, { product: products[0]?.name, orderNumber: "NX-11546" });
    setLog((l) => [...l, { from: "you", text: draft }, { from: "ai", text: reply }]);
    setDraft("");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI agent</h1>
          <p className="text-sm text-zinc-500">
            Answers WhatsApp and Instagram in under a minute. Hands off when a human should decide.
          </p>
        </div>
        <div className="rounded-2xl border border-sand bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Agent is {ai.enabled ? "live" : "paused"}</div>
              <div className="text-xs text-zinc-500">Inbox · Confirmation · after hours</div>
            </div>
            <Toggle checked={ai.enabled} onChange={(v) => updateAi({ enabled: v })} />
          </div>
          <Field label="Name">
            <input
              className={inputClass}
              value={ai.name}
              onChange={(e) => updateAi({ name: e.target.value })}
            />
          </Field>
          <Field label="Tone">
            <input
              className={inputClass}
              value={ai.tone}
              onChange={(e) => updateAi({ tone: e.target.value })}
            />
          </Field>
          <Field label="Knowledge">
            <textarea
              className={`${inputClass} min-h-28`}
              value={ai.knowledge}
              onChange={(e) => updateAi({ knowledge: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ai.canConfirm}
                onChange={(e) => updateAi({ canConfirm: e.target.checked })}
              />
              Can confirm orders
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ai.canCancel}
                onChange={(e) => updateAi({ canCancel: e.target.checked })}
              />
              Can cancel
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ai.canUpsell}
                onChange={(e) => updateAi({ canUpsell: e.target.checked })}
              />
              Can upsell
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {ai.languages.map((l) => (
              <span key={l} className="rounded-full bg-paper px-3 py-1 text-xs font-semibold">
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex h-[640px] flex-col rounded-2xl border border-sand bg-white">
        <div className="border-b border-sand px-4 py-3 text-sm font-semibold">Preview · {ai.name}</div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4 scrollbar-thin">
          {log.map((m, i) => (
            <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "you" ? "bg-ink text-white" : "bg-paper"}`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-sand p-3">
          <input
            className="flex-1 rounded-full border border-sand px-3 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <PrimaryButton type="submit">Send</PrimaryButton>
        </form>
      </div>
    </div>
  );
}
