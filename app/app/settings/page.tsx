"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Field, inputClass, GhostButton, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api<{ organization: { name: string; timezone: string; plan: string }; role: string; permissions: string[] }>(
        "/api/v1/settings",
      ),
  });
  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => api<{ subscription: { plan: string; status: string } | null; stripe: string }>("/api/v1/billing"),
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () =>
      api<{ rows: Array<{ id: string; ip: string | null; userAgent: string | null; createdAt: string }> }>(
        "/api/v1/auth/sessions",
      ),
  });
  const history = useQuery({
    queryKey: ["login-history"],
    queryFn: () =>
      api<{ rows: Array<{ id: string; ip: string | null; success: boolean; createdAt: string }> }>(
        "/api/v1/auth/login-history",
      ),
  });
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () =>
      api<{ rows: Array<{ id: string; name: string; prefix: string; lastUsedAt: string | null; revokedAt: string | null }> }>(
        "/api/v1/api-keys",
      ),
  });
  const save = useMutation({
    mutationFn: (body: { name: string; timezone: string }) =>
      api("/api/v1/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading settings…</p>;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    save.mutate({ name: String(data.get("name")), timezone: String(data.get("timezone")) });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <form className="space-y-3 rounded-2xl border border-sand bg-white p-5" onSubmit={onSave}>
        <Field label="Workspace">
          <input name="name" className={inputClass} defaultValue={q.data?.organization.name} />
        </Field>
        <Field label="Timezone">
          <input name="timezone" className={inputClass} defaultValue={q.data?.organization.timezone} />
        </Field>
        <p className="text-xs text-zinc-500">
          Role {q.data?.role} · {q.data?.permissions.length} permissions
        </p>
        <PrimaryButton type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </PrimaryButton>
      </form>
      <section className="rounded-2xl border border-sand bg-white p-5 text-sm">
        <div className="font-semibold">Billing</div>
        <p className="mt-1 text-zinc-600">
          Plan {billing.data?.subscription?.plan ?? "—"} · {billing.data?.stripe}
        </p>
      </section>
      <section className="space-y-3 rounded-2xl border border-sand bg-white p-5 text-sm">
        <div className="font-semibold">Two-factor authentication</div>
        <PrimaryButton
          type="button"
          onClick={async () => {
            const r = await api<{ secret: string; otpauth: string }>("/api/v1/auth/2fa/setup", { method: "POST" });
            setSecret(r.secret);
            setOtpauth(r.otpauth);
          }}
        >
          Start 2FA setup
        </PrimaryButton>
        {secret ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const code = String(new FormData(e.currentTarget).get("code"));
              await api("/api/v1/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
              setSecret(null);
            }}
          >
            <p className="break-all text-xs text-zinc-500">{otpauth}</p>
            <Field label="Authenticator code">
              <input name="code" className={inputClass} />
            </Field>
            <PrimaryButton type="submit">Enable 2FA</PrimaryButton>
          </form>
        ) : null}
      </section>
      <section className="rounded-2xl border border-sand bg-white p-5 text-sm">
        <div className="flex items-center justify-between">
          <div className="font-semibold">API keys</div>
          <GhostButton
            onClick={async () => {
              const r = await api<{ secret: string }>("/api/v1/api-keys", {
                method: "POST",
                body: JSON.stringify({ name: "Workspace key" }),
              });
              setSecret(r.secret);
              qc.invalidateQueries({ queryKey: ["api-keys"] });
            }}
          >
            Create key
          </GhostButton>
        </div>
        <ul className="mt-3 space-y-1 text-xs">
          {(keys.data?.rows ?? []).map((k) => (
            <li key={k.id} className="flex justify-between">
              <span>
                {k.name} · {k.prefix}… {k.revokedAt ? "(revoked)" : ""}
              </span>
              {!k.revokedAt ? (
                <button
                  className="text-rose-600"
                  onClick={async () => {
                    await api(`/api/v1/api-keys/${k.id}`, { method: "DELETE" });
                    qc.invalidateQueries({ queryKey: ["api-keys"] });
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-sand bg-white p-5 text-sm">
        <div className="font-semibold">Sessions</div>
        <ul className="mt-3 space-y-1 text-xs">
          {(sessions.data?.rows ?? []).map((s) => (
            <li key={s.id} className="flex justify-between gap-2">
              <span className="truncate">
                {s.ip ?? "local"} · {s.userAgent?.slice(0, 48) ?? "unknown"}
              </span>
              <button
                className="text-rose-600"
                onClick={async () => {
                  await api(`/api/v1/auth/sessions/${s.id}`, { method: "DELETE" });
                  qc.invalidateQueries({ queryKey: ["sessions"] });
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-sand bg-white p-5 text-sm">
        <div className="font-semibold">Login history</div>
        <ul className="mt-3 space-y-1 text-xs text-zinc-600">
          {(history.data?.rows ?? []).slice(0, 8).map((e) => (
            <li key={e.id}>
              {e.success ? "OK" : "Failed"} · {e.ip} · {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
      <GhostButton
        onClick={async () => {
          await api("/api/v1/auth/logout", { method: "POST" });
          router.push("/");
        }}
      >
        Sign out
      </GhostButton>
    </div>
  );
}
