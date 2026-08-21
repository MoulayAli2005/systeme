"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { AutomationBuilder, WorkflowThumb } from "@/components/automation-builder";
import { GhostButton, PrimaryButton, Toggle } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api";
import {
  AUTOMATION_PRESETS,
  emptyDraft,
  fromApiRow,
  summarizeActions,
  summarizeConditions,
  toApiPayload,
  triggerLabel,
  type AutomationDraft,
} from "@/lib/automations";
import { relativeTime } from "@/lib/format";

type AutomationRow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: unknown;
  actions: unknown;
  runsToday: number;
  createdAt: string;
  runs?: Array<{ id: string; status: string; createdAt: string }>;
};

export default function AutomationsPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<"closed" | "create" | string>("closed");
  const [draft, setDraft] = useState<AutomationDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["automations"],
    queryFn: () => api<{ rows: AutomationRow[] }>("/api/v1/automations"),
  });
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () =>
      api<{
        rows: Array<{ user: { id: string; name: string } }>;
      }>("/api/v1/team"),
  });
  const agents = (team.data?.rows ?? []).map((row) => ({ userId: row.user.id, name: row.user.name }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = toApiPayload(draft);
      if (!payload.name) throw new ApiClientError(400, "BAD_REQUEST", "Name this workflow so the team can find it.");
      if (!payload.actions.length) throw new ApiClientError(400, "BAD_REQUEST", "Add at least one action node.");
      if (editor === "create") {
        return api("/api/v1/automations", { method: "POST", body: JSON.stringify(payload) });
      }
      return api(`/api/v1/automations/${editor}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setEditor("closed");
      setDraft(emptyDraft());
      setError(null);
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Could not save this workflow.");
    },
  });

  const tog = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      api(`/api/v1/automations/${input.id}`, { method: "PATCH", body: JSON.stringify({ enabled: input.enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/v1/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  function openCreate(preset?: AutomationDraft) {
    setError(null);
    setDraft(preset ? structuredClone(preset) : emptyDraft());
    setEditor("create");
  }

  function openEdit(row: AutomationRow) {
    setError(null);
    setDraft(fromApiRow(row));
    setEditor(row.id);
  }

  const rows = list.data?.rows ?? [];
  const editing = editor !== "closed";

  if (editing) {
    return (
      <div className="-mx-4 -my-5 space-y-3 md:-mx-6">
        <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-6">
          {AUTOMATION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => openCreate(preset.draft)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                draft.name === preset.draft.name ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-sand"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="px-4 pb-4 md:px-6">
          <AutomationBuilder
            draft={draft}
            onChange={setDraft}
            agents={agents}
            error={error}
            submitting={save.isPending}
            submitLabel={editor === "create" ? "Save workflow" : "Save workflow"}
            onSubmit={() => save.mutate()}
            onCancel={() => {
              setEditor("closed");
              setError(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="text-sm text-zinc-500">
            n8n-style workflows: connect a trigger, IF filters, and actions on a canvas.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => openCreate()}>
          <Plus size={16} /> New workflow
        </PrimaryButton>
      </div>

      {list.isLoading ? <p className="text-sm text-zinc-500">Loading workflows…</p> : null}
      {list.error ? <p className="text-sm text-rose-600">Could not load automations.</p> : null}

      {!list.isLoading && rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-mint">
            <Workflow size={22} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No workflows yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Open the canvas and chain nodes: When an order is created → IF COD → Send WhatsApp.
          </p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton type="button" onClick={() => openCreate(AUTOMATION_PRESETS[0].draft)}>
              Start with WhatsApp confirm
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const last = row.runs?.[0];
          return (
            <article key={row.id} className="rounded-2xl border border-sand bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{row.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.enabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {row.enabled ? "On" : "Paused"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <WorkflowThumb trigger={row.trigger} conditions={row.conditions} actions={row.actions} />
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    When {triggerLabel(row.trigger).toLowerCase()}
                    {summarizeConditions(row.conditions) === "always"
                      ? ""
                      : `, if ${summarizeConditions(row.conditions)}`}
                    , then {summarizeActions(row.actions)}.
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {row.runsToday} run{row.runsToday === 1 ? "" : "s"} today
                    {last ? ` · last ${last.status} ${relativeTime(last.createdAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle checked={row.enabled} onChange={(enabled) => tog.mutate({ id: row.id, enabled })} />
                  <GhostButton type="button" onClick={() => openEdit(row)}>
                    <Pencil size={14} /> Open canvas
                  </GhostButton>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-paper hover:text-rose-600"
                    aria-label={`Delete ${row.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${row.name}”? Existing orders are not changed.`)) {
                        remove.mutate(row.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
