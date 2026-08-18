"use client";

import { Avatar } from "@/components/ui";
import { useAppState } from "@/lib/store";

const roleCopy: Record<string, string> = {
  owner: "Full workspace",
  confirmation: "Queue, calls, WhatsApp confirm",
  inbox: "Shared inbox & campaigns",
  shipping: "Labels, manifests, carriers",
  returns: "RTO, inspection, exchanges",
  marketing: "Broadcasts & analytics",
};

export default function TeamPage() {
  const { agents } = useAppState();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-zinc-500">Role-based access · live presence · confirmation scoreboard</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {agents.map((a) => (
          <article key={a.id} className="flex items-start gap-4 rounded-2xl border border-sand bg-white p-5">
            <Avatar initials={a.initials} hue={a.hue} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{a.name}</div>
                <span
                  className={`h-2 w-2 rounded-full ${a.online ? "bg-emerald-500" : "bg-zinc-300"}`}
                />
              </div>
              <div className="text-xs text-zinc-500">{a.email}</div>
              <div className="mt-2 text-sm">{roleCopy[a.role]}</div>
              <div className="mt-2 text-xs text-zinc-500">
                {a.confirmedToday} confirmed today
                {a.avgConfirmMin ? ` · ${a.avgConfirmMin}m average` : ""}
              </div>
            </div>
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold uppercase">
              {a.role}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
