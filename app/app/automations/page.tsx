"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field, inputClass, PrimaryButton, Toggle } from "@/components/ui";
import { api } from "@/lib/api";

export default function AutomationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["automations"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          name: string;
          enabled: boolean;
          trigger: string;
          conditions: unknown;
          actions: unknown;
          runsToday: number;
        }>;
      }>("/api/v1/automations"),
  });
  const tog = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      api(`/api/v1/automations/${input.id}`, { method: "PATCH", body: JSON.stringify({ enabled: input.enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
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
    create.mutate({
      name: String(data.get("name")),
      trigger: String(data.get("trigger")),
      conditions: {
        ...(String(data.get("payment")) ? { paymentMethod: String(data.get("payment")) } : {}),
        ...(minTotal ? { minTotal } : {}),
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

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading automations…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Automations</h1>
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
          <input name="text" className={inputClass} placeholder="{{customer_name}} / vip" />
        </Field>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={create.isPending}>
            Create rule
          </PrimaryButton>
        </div>
      </form>
      {(q.data?.rows ?? []).map((a) => (
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
