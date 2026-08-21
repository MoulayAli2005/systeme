"use client";

import {
  ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  CONDITION_FIELDS,
  DISPATCH_STRATEGIES,
  MESSAGE_VARS,
  ORDER_PIPELINE_STATUSES,
  defaultActionText,
  emptyAction,
  emptyCondition,
  type ActionDraft,
  type ActionType,
  type AutomationDraft,
  type ConditionDraft,
  type ConditionFieldKey,
} from "@/lib/automations";
import { statusLabel } from "@/lib/format";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

export type AgentOption = { userId: string; name: string };

export function AutomationBuilder({
  draft,
  onChange,
  agents,
  error,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: AutomationDraft;
  onChange: (next: AutomationDraft) => void;
  agents: AgentOption[];
  error?: string | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const usedFields = new Set(draft.conditions.map((c) => c.field));
  const availableFields = CONDITION_FIELDS.filter((f) => !usedFields.has(f.key));

  function set<K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function patchCondition(id: string, patch: Partial<ConditionDraft>) {
    set(
      "conditions",
      draft.conditions.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function patchAction(id: string, patch: Partial<ActionDraft>) {
    set(
      "actions",
      draft.actions.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-sand bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rule name">
          <input
            className={inputClass}
            value={draft.name}
            placeholder="WhatsApp confirm on create"
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="When">
          <select
            className={inputClass}
            value={draft.trigger}
            onChange={(e) => set("trigger", e.target.value as AutomationDraft["trigger"])}
          >
            {AUTOMATION_TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-zinc-500">
        {AUTOMATION_TRIGGERS.find((t) => t.value === draft.trigger)?.hint}
      </p>

      <section className="rounded-2xl bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">If</div>
            <p className="mt-1 text-sm text-zinc-600">Leave empty to run on every matching event.</p>
          </div>
          <GhostButton
            type="button"
            disabled={!availableFields.length}
            onClick={() => {
              const field = availableFields[0]?.key;
              if (!field) return;
              set("conditions", [...draft.conditions, emptyCondition(field)]);
            }}
          >
            <Plus size={14} /> Condition
          </GhostButton>
        </div>
        <div className="mt-3 space-y-2">
          {draft.conditions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-sand bg-white px-3 py-3 text-sm text-zinc-500">
              No filters — this rule always fires.
            </p>
          ) : (
            draft.conditions.map((row) => (
              <ConditionRow
                key={row.id}
                row={row}
                used={usedFields}
                onChange={(patch) => patchCondition(row.id, patch)}
                onRemove={() => set("conditions", draft.conditions.filter((c) => c.id !== row.id))}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Then</div>
            <p className="mt-1 text-sm text-zinc-600">Actions run in order, on the same order.</p>
          </div>
          <GhostButton
            type="button"
            onClick={() => set("actions", [...draft.actions, emptyAction("add_tag")])}
          >
            <Plus size={14} /> Action
          </GhostButton>
        </div>
        <div className="mt-3 space-y-3">
          {draft.actions.map((row, index) => (
            <ActionRow
              key={row.id}
              index={index}
              row={row}
              agents={agents}
              onChange={(patch) => patchAction(row.id, patch)}
              onRemove={() =>
                set(
                  "actions",
                  draft.actions.length === 1 ? draft.actions : draft.actions.filter((a) => a.id !== row.id),
                )
              }
            />
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" disabled={submitting || !draft.name.trim() || !draft.actions.length} onClick={onSubmit}>
          {submitting ? "Saving…" : submitLabel}
        </PrimaryButton>
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </div>
  );
}

function ConditionRow({
  row,
  used,
  onChange,
  onRemove,
}: {
  row: ConditionDraft;
  used: Set<string>;
  onChange: (patch: Partial<ConditionDraft>) => void;
  onRemove: () => void;
}) {
  const field = CONDITION_FIELDS.find((f) => f.key === row.field) ?? CONDITION_FIELDS[0];
  return (
    <div className="grid gap-2 rounded-xl border border-sand bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
      <select
        className={inputClass}
        value={row.field}
        onChange={(e) => {
          const next = e.target.value as ConditionFieldKey;
          const def = CONDITION_FIELDS.find((f) => f.key === next);
          const first = def && "options" in def ? def.options[0]?.value : "";
          onChange({ field: next, value: first ?? "" });
        }}
      >
        {CONDITION_FIELDS.filter((f) => f.key === row.field || !used.has(f.key)).map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <ConditionValue field={field} value={row.value} onChange={(value) => onChange({ value })} />
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-paper hover:text-rose-600"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function ConditionValue({
  field,
  value,
  onChange,
}: {
  field: (typeof CONDITION_FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.kind === "select") {
    return (
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "status") {
    return (
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {ORDER_PIPELINE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={inputClass}
      type={field.kind === "number" ? "number" : "text"}
      placeholder={"placeholder" in field ? field.placeholder : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ActionRow({
  index,
  row,
  agents,
  onChange,
  onRemove,
}: {
  index: number;
  row: ActionDraft;
  agents: AgentOption[];
  onChange: (patch: Partial<ActionDraft>) => void;
  onRemove: () => void;
}) {
  const meta = ACTION_TYPES.find((a) => a.value === row.type);
  const needsMessage = row.type === "send_whatsapp" || row.type === "send_sms" || row.type === "notify";
  return (
    <div className="rounded-xl border border-sand bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <select
            className={inputClass}
            value={row.type}
            onChange={(e) => {
              const type = e.target.value as ActionType;
              onChange({ type, text: row.text || defaultActionText(type) });
            }}
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          {meta ? <p className="text-xs text-zinc-500">{meta.hint}</p> : null}
          {needsMessage ? (
            <div>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={row.text}
                onChange={(e) => onChange({ text: e.target.value })}
              />
              {row.type !== "notify" ? (
                <p className="mt-1 text-[11px] text-zinc-500">Variables: {MESSAGE_VARS.join(" ")}</p>
              ) : null}
            </div>
          ) : null}
          {row.type === "notify" || row.type === "create_task" ? (
            <input
              className={inputClass}
              placeholder={row.type === "create_task" ? "Task title" : "Notification title"}
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          ) : null}
          {row.type === "add_tag" ? (
            <input
              className={inputClass}
              placeholder="tag"
              value={row.tag}
              onChange={(e) => onChange({ tag: e.target.value })}
            />
          ) : null}
          {row.type === "change_status" ? (
            <select className={inputClass} value={row.status} onChange={(e) => onChange({ status: e.target.value })}>
              {ORDER_PIPELINE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          ) : null}
          {row.type === "assign_agent" ? (
            <select className={inputClass} value={row.agentId} onChange={(e) => onChange({ agentId: e.target.value })}>
              <option value="">Select an agent</option>
              {agents.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : null}
          {row.type === "assign_queue" ? (
            <select className={inputClass} value={row.strategy} onChange={(e) => onChange({ strategy: e.target.value })}>
              {DISPATCH_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-paper hover:text-rose-600"
          onClick={onRemove}
          aria-label="Remove action"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
