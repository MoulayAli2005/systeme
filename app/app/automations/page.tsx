"use client";

import { Toggle } from "@/components/ui";
import { toggleAutomation, useAppState } from "@/lib/store";

export default function AutomationsPage() {
  const { automations } = useAppState();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="text-sm text-zinc-500">
          When something happens to an order, Nexora does the next job without a spreadsheet.
        </p>
      </div>
      <div className="space-y-3">
        {automations.map((a) => (
          <article key={a.id} className="rounded-2xl border border-sand bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{a.name}</div>
                <div className="mt-1 text-xs text-zinc-500">{a.runsToday} runs today</div>
              </div>
              <Toggle checked={a.enabled} onChange={() => toggleAutomation(a.id)} />
            </div>
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
              <Step k="When" v={a.trigger} />
              <Step k="If" v={a.condition} />
              <Step k="Then" v={a.action} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Step({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{k}</div>
      <div className="mt-1">{v}</div>
    </div>
  );
}
