"use client";

import { FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field, inputClass, PrimaryButton, Toggle } from "@/components/ui";
import { IntegrationLogo } from "@/components/integration-logos";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

type AutomationRow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: Record<string, unknown> | null;
  actions: unknown;
  runsToday: number;
};

type WhatsAppPresetRow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status?: string;
  message: string;
  enabled: boolean;
  automationId: string | null;
  runsToday: number;
};

export default function AutomationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["automations"],
    queryFn: () => api<{ rows: AutomationRow[] }>("/api/v1/automations"),
  });
  const wa = useQuery({
    queryKey: ["automations-whatsapp"],
    queryFn: () =>
      api<{ configured: boolean; provider: string; presets: WhatsAppPresetRow[] }>("/api/v1/automations/whatsapp"),
  });
  const tog = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      api(`/api/v1/automations/${input.id}`, { method: "PATCH", body: JSON.stringify({ enabled: input.enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
  const togWa = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      api("/api/v1/automations/whatsapp", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      qc.invalidateQueries({ queryKey: ["automations-whatsapp"] });
    },
  });
  const create = useMutation({
    mutationFn: (body: unknown) => api("/api/v1/automations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const minTotal = Number(data.get("minTotal") || 0);
    const action = String(data.get("action"));
    const status = String(data.get("status") || "");
    create.mutate({
      name: String(data.get("name")),
      trigger: String(data.get("trigger")),
      conditions: {
        ...(String(data.get("payment")) ? { paymentMethod: String(data.get("payment")) } : {}),
        ...(minTotal ? { minTotal } : {}),
        ...(status ? { status } : {}),
      },
      actions:
        action === "whatsapp"
          ? [{ type: "send_whatsapp", text: String(data.get("text") || "Hi {{customer_name}}, confirm {{order_id}}?") }]
          : action === "ship"
            ? [{ type: "create_shipment" }]
            : [{ type: "add_tag", tag: String(data.get("text") || "auto") }],
    });
    e.currentTarget.reset();
  }

  const custom = (q.data?.rows ?? []).filter((row) => {
    const preset = (row.conditions ?? {})?.preset;
    return !preset;
  });

  if (q.isLoading || wa.isLoading) return <p className="text-sm text-zinc-500">Loading automations…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="text-sm text-zinc-500">
          WhatsApp sequences fire on order events. Live send uses Twilio when{" "}
          <code>TWILIO_WHATSAPP_FROM</code> is set — otherwise the demo adapter logs the message in the inbox.
        </p>
      </div>

      <section className="rounded-[28px] border border-sand bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#25D366]/15">
              <IntegrationLogo id="whatsapp" className="h-6 w-6" />
            </span>
            <div>
              <div className="text-sm font-semibold">WhatsApp automation</div>
              <div className="text-xs text-zinc-500">
                {wa.data?.provider ?? "whatsapp"} · {wa.data?.configured ? "adapter ready" : "not configured"}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/20 px-3 py-1 text-[11px] font-semibold text-emerald-900">
            <MessageCircle size={12} /> COD journey
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600">
          Turn on the steps you want. Each one sends a WhatsApp with the order number, COD amount, city, product, AWB
          and tracking link already filled.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(wa.data?.presets ?? []).map((preset) => (
            <article
              key={preset.id}
              className={cn(
                "rounded-2xl border p-4",
                preset.enabled ? "border-emerald-200 bg-emerald-50/40" : "border-sand bg-paper/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{preset.name}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-400">
                    {preset.trigger}
                    {preset.status ? ` · ${preset.status}` : ""} · {preset.runsToday} runs
                  </div>
                </div>
                <Toggle
                  checked={preset.enabled}
                  onChange={(enabled) => togWa.mutate({ id: preset.id, enabled })}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{preset.description}</p>
              <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-zinc-700 ring-1 ring-sand">
                {preset.message}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div>
        <h2 className="text-lg font-semibold">Custom rules</h2>
        <p className="text-sm text-zinc-500">Add a one-off WhatsApp, shipment or tag when an order is created or changes status.</p>
      </div>
      <form className="grid gap-3 rounded-2xl border border-sand bg-white p-5 sm:grid-cols-2" onSubmit={onCreate}>
        <Field label="Name">
          <input name="name" required className={inputClass} placeholder="WhatsApp on create" />
        </Field>
        <Field label="When">
          <select name="trigger" className={inputClass}>
            <option value="order.created">Order created</option>
            <option value="order.status">Order status changed</option>
          </select>
        </Field>
        <Field label="Payment">
          <select name="payment" className={inputClass}>
            <option value="cod">COD</option>
            <option value="">Any</option>
            <option value="prepaid">Prepaid</option>
          </select>
        </Field>
        <Field label="Status (if status changed)">
          <select name="status" className={inputClass}>
            <option value="">Any</option>
            <option value="NO_ANSWER">No answer</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="SHIPPED">Shipped</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="RETURNED">Returned</option>
          </select>
        </Field>
        <Field label="Min total">
          <input name="minTotal" type="number" className={inputClass} placeholder="0" />
        </Field>
        <Field label="Then">
          <select name="action" className={inputClass}>
            <option value="whatsapp">Send WhatsApp</option>
            <option value="ship">Create shipment</option>
            <option value="tag">Add tag</option>
          </select>
        </Field>
        <Field label="Message / tag">
          <input
            name="text"
            className={inputClass}
            placeholder="{{customer_name}} {{order_id}} {{product}} {{total}} {{city}} {{awb}}"
          />
        </Field>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={create.isPending}>
            Create rule
          </PrimaryButton>
        </div>
      </form>
      {custom.map((a) => (
        <article key={a.id} className="rounded-2xl border border-sand bg-white p-5">
          <div className="flex justify-between">
            <div>
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-zinc-500">
                {a.trigger} · {a.runsToday} runs
              </div>
            </div>
            <Toggle checked={a.enabled} onChange={(v) => tog.mutate({ id: a.id, enabled: v })} />
          </div>
          <pre className="mt-3 overflow-auto rounded-xl bg-paper p-3 text-xs">
            {JSON.stringify({ conditions: a.conditions, actions: a.actions }, null, 2)}
          </pre>
        </article>
      ))}
    </div>
  );
}
