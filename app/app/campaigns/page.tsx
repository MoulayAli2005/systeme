"use client";

import { PrimaryButton, GhostButton } from "@/components/ui";
import { sendCampaign, useAppState } from "@/lib/store";

export default function CampaignsPage() {
  const { campaigns } = useAppState();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp campaigns</h1>
        <p className="text-sm text-zinc-500">
          Broadcast to opted-in customers. Templates stay inside Meta’s rules.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {campaigns.map((c) => (
          <article key={c.id} className="flex flex-col rounded-2xl border border-sand bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{c.name}</div>
              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold uppercase">
                {c.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">{c.audience}</p>
            <p className="mt-3 flex-1 rounded-xl bg-paper p-3 text-sm leading-6">{c.template}</p>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {[
                ["Sent", c.sent],
                ["Delivered", c.delivered],
                ["Replied", c.replied],
                ["Orders", c.converted],
              ].map(([l, n]) => (
                <div key={String(l)}>
                  <div className="text-base font-semibold">{n}</div>
                  <div className="text-zinc-400">{l}</div>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              {c.status === "sent" ? (
                <GhostButton className="w-full text-xs">Duplicate</GhostButton>
              ) : (
                <PrimaryButton className="w-full text-xs" onClick={() => sendCampaign(c.id)}>
                  Send now
                </PrimaryButton>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
