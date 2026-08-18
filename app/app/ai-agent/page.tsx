"use client";

import { FormEvent, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";

export default function AiPage() {
  const [log, setLog] = useState<Array<{ q: string; a: string }>>([]);
  const [draft, setDraft] = useState("Combien de commandes avons-nous livrées ces 30 jours ?");
  const [pending, setPending] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api<{ answer: string; provider: string; configured: boolean }>("/api/v1/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: draft }),
      });
      setLog((l) => [...l, { q: draft, a: `${res.answer}\n\n— ${res.provider}${res.configured ? "" : " (demo)"}` }]);
      setDraft("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI copilot</h1>
        <p className="text-sm text-zinc-500">
          Uses last-7-day analytics as context. Set OPENAI_API_KEY for a live model; otherwise demo mode answers.
        </p>
      </div>
      <div className="min-h-64 space-y-3 rounded-2xl border border-sand bg-white p-4">
        {log.map((m, i) => (
          <div key={i}>
            <div className="text-xs font-semibold text-zinc-400">You</div>
            <p className="text-sm">{m.q}</p>
            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-3 text-sm">{m.a}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input className="flex-1 rounded-full border border-sand px-4 py-2 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "…" : "Ask"}
        </PrimaryButton>
      </form>
    </div>
  );
}
