"use client";

import { useRouter } from "next/navigation";
import { Field, inputClass, PrimaryButton, GhostButton } from "@/components/ui";
import { clearSession, resetWorkspace } from "@/lib/store";
import { WORKSPACE } from "@/lib/seed";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="text-sm text-zinc-500">Atlas Atelier is a demo store. Reset anytime.</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-sand bg-white p-5">
        <Field label="Workspace name">
          <input className={inputClass} defaultValue={WORKSPACE.name} />
        </Field>
        <Field label="Country">
          <input className={inputClass} defaultValue={WORKSPACE.country} />
        </Field>
        <Field label="Currency">
          <input className={inputClass} defaultValue={WORKSPACE.currency} />
        </Field>
        <Field label="Confirmation hours">
          <input className={inputClass} defaultValue="09:00 – 22:00 GMT+1" />
        </Field>
        <PrimaryButton>Save changes</PrimaryButton>
      </section>
      <section className="rounded-2xl border border-sand bg-white p-5">
        <div className="text-sm font-semibold">Demo data</div>
        <p className="mt-1 text-sm text-zinc-500">
          Clears local confirmations, dispatches and inbox messages, then reloads Atlas Atelier.
        </p>
        <div className="mt-4 flex gap-2">
          <GhostButton
            onClick={() => {
              resetWorkspace();
              router.push("/app/dashboard");
            }}
          >
            Reset workspace
          </GhostButton>
          <GhostButton
            onClick={() => {
              clearSession();
              router.push("/");
            }}
          >
            Sign out
          </GhostButton>
        </div>
      </section>
    </div>
  );
}
