"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  Filter,
  GitBranch,
  ListTodo,
  MessageCircle,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  Truck,
  UserPlus,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  CONDITION_FIELDS,
  DISPATCH_STRATEGIES,
  MESSAGE_VARS,
  ORDER_PIPELINE_STATUSES,
  actionCaption,
  actionLabel,
  conditionCaption,
  defaultActionText,
  emptyAction,
  emptyCondition,
  triggerLabel,
  type ActionDraft,
  type ActionType,
  type AutomationDraft,
  type ConditionDraft,
  type ConditionFieldKey,
} from "@/lib/automations";
import { cn, statusLabel } from "@/lib/format";

export type AgentOption = { userId: string; name: string };

const darkInput =
  "w-full rounded-lg border border-white/10 bg-[#14161b] px-3 py-2 text-sm text-white outline-none ring-mint/30 focus:ring-2";

type Selected =
  | { kind: "trigger" }
  | { kind: "condition"; id: string }
  | { kind: "action"; id: string };

type AddSlot =
  | { kind: "condition"; index: number }
  | { kind: "action"; index: number }
  | { kind: "after-trigger" };

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
  const [selected, setSelected] = useState<Selected>({ kind: "trigger" });
  const [addSlot, setAddSlot] = useState<AddSlot | null>(null);

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

  function addCondition(index: number, field: ConditionFieldKey) {
    const row = emptyCondition(field);
    const next = [...draft.conditions];
    next.splice(index, 0, row);
    onChange({ ...draft, conditions: next });
    setSelected({ kind: "condition", id: row.id });
    setAddSlot(null);
  }

  function addAction(index: number, type: ActionType) {
    const row = emptyAction(type);
    const next = [...draft.actions];
    next.splice(index, 0, row);
    onChange({ ...draft, actions: next });
    setSelected({ kind: "action", id: row.id });
    setAddSlot(null);
  }

  function removeSelected() {
    if (selected.kind === "condition") {
      onChange({ ...draft, conditions: draft.conditions.filter((c) => c.id !== selected.id) });
      setSelected({ kind: "trigger" });
    }
    if (selected.kind === "action" && draft.actions.length > 1) {
      onChange({ ...draft, actions: draft.actions.filter((a) => a.id !== selected.id) });
      setSelected({ kind: "trigger" });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a2e38] bg-[#111318] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex h-12 items-center gap-3 border-b border-white/10 bg-[#16181e] px-3">
        <Workflow size={16} className="text-mint" />
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Untitled workflow"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-white/35"
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/5 hover:text-white"
        >
          Back
        </button>
        <button
          type="button"
          disabled={submitting || !draft.name.trim() || !draft.actions.length}
          onClick={onSubmit}
          className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white disabled:opacity-40"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[1fr_320px]">
        <div className="n8n-canvas relative overflow-auto" onClick={() => setAddSlot(null)}>
          <div className="flex min-h-[620px] min-w-max items-center px-10 py-16">
            <FlowNode
              accent="#ff6d5a"
              badge="Trigger"
              icon={<Zap size={15} />}
              title="When"
              subtitle={triggerLabel(draft.trigger)}
              selected={selected.kind === "trigger"}
              onClick={() => setSelected({ kind: "trigger" })}
            />
            <EdgePlus
              open={addSlot?.kind === "after-trigger"}
              onToggle={() => setAddSlot(addSlot?.kind === "after-trigger" ? null : { kind: "after-trigger" })}
              allowIf
              usedFields={draft.conditions.map((c) => c.field)}
              onAddIf={(field) => addCondition(0, field)}
              onAddAction={(type) => addAction(0, type)}
            />

            {draft.conditions.map((row, index) => (
              <div key={row.id} className="flex items-center">
                <FlowNode
                  accent="#5b8def"
                  badge="IF"
                  icon={<Filter size={15} />}
                  title="Filter"
                  subtitle={conditionCaption(row)}
                  selected={selected.kind === "condition" && selected.id === row.id}
                  onClick={() => setSelected({ kind: "condition", id: row.id })}
                />
                <EdgePlus
                  open={addSlot?.kind === "condition" && addSlot.index === index}
                  onToggle={() =>
                    setAddSlot(addSlot?.kind === "condition" && addSlot.index === index ? null : { kind: "condition", index })
                  }
                  allowIf
                  usedFields={draft.conditions.map((c) => c.field)}
                  onAddIf={(field) => addCondition(index + 1, field)}
                  onAddAction={(type) => addAction(0, type)}
                />
              </div>
            ))}

            {draft.actions.map((row, index) => (
              <div key={row.id} className="flex items-center">
                <FlowNode
                  accent="#3dfa9b"
                  badge="Action"
                  icon={actionIcon(row.type)}
                  title={actionLabel(row.type)}
                  subtitle={actionCaption(row)}
                  selected={selected.kind === "action" && selected.id === row.id}
                  onClick={() => setSelected({ kind: "action", id: row.id })}
                />
                <EdgePlus
                  open={addSlot?.kind === "action" && addSlot.index === index}
                  onToggle={() =>
                    setAddSlot(addSlot?.kind === "action" && addSlot.index === index ? null : { kind: "action", index })
                  }
                  allowIf={false}
                  usedFields={draft.conditions.map((c) => c.field)}
                  onAddIf={() => undefined}
                  onAddAction={(type) => addAction(index + 1, type)}
                />
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-white/10 bg-[#16181e] lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {selected.kind === "trigger" ? "Trigger" : selected.kind === "condition" ? "IF node" : "Action node"}
              </div>
              <div className="mt-0.5 text-sm font-semibold">Parameters</div>
            </div>
            {selected.kind !== "trigger" ? (
              <button
                type="button"
                onClick={removeSelected}
                disabled={selected.kind === "action" && draft.actions.length === 1}
                className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-rose-400 disabled:opacity-30"
                aria-label="Delete node"
              >
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>
          <div className="space-y-3 p-4">
            {selected.kind === "trigger" ? (
              <>
                <label className="block text-xs font-semibold text-white/55">Event</label>
                <select
                  className={darkInput}
                  value={draft.trigger}
                  onChange={(e) => set("trigger", e.target.value as AutomationDraft["trigger"])}
                >
                  {AUTOMATION_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-white/45">
                  {AUTOMATION_TRIGGERS.find((t) => t.value === draft.trigger)?.hint}
                </p>
              </>
            ) : null}
            {selected.kind === "condition"
              ? (() => {
                  const row = draft.conditions.find((c) => c.id === selected.id);
                  if (!row) return <p className="text-sm text-white/45">Select a filter node.</p>;
                  const used = new Set(draft.conditions.map((c) => c.field));
                  const field = CONDITION_FIELDS.find((f) => f.key === row.field) ?? CONDITION_FIELDS[0];
                  return (
                    <>
                      <label className="block text-xs font-semibold text-white/55">Field</label>
                      <select
                        className={darkInput}
                        value={row.field}
                        onChange={(e) => {
                          const next = e.target.value as ConditionFieldKey;
                          const def = CONDITION_FIELDS.find((f) => f.key === next);
                          const first = def && "options" in def ? def.options[0]?.value : "";
                          patchCondition(row.id, { field: next, value: first ?? "" });
                        }}
                      >
                        {CONDITION_FIELDS.filter((f) => f.key === row.field || !used.has(f.key)).map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <label className="block text-xs font-semibold text-white/55">Value</label>
                      <ConditionValue field={field} value={row.value} onChange={(value) => patchCondition(row.id, { value })} />
                    </>
                  );
                })()
              : null}
            {selected.kind === "action"
              ? (() => {
                  const row = draft.actions.find((a) => a.id === selected.id);
                  if (!row) return <p className="text-sm text-white/45">Select an action node.</p>;
                  return <ActionInspector row={row} agents={agents} onChange={(patch) => patchAction(row.id, patch)} />;
                })()
              : null}
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function WorkflowThumb({
  trigger,
  conditions,
  actions,
}: {
  trigger: string;
  conditions: unknown;
  actions: unknown;
}) {
  const ifs = Object.keys((conditions ?? {}) as object).length;
  const acts = Array.isArray(actions) ? actions.length : 0;
  const pills = [
    { color: "#ff6d5a", label: trigger === "order.status" ? "Status" : "Created" },
    ...(ifs ? [{ color: "#5b8def", label: `${ifs} IF` }] : []),
    { color: "#3dfa9b", label: `${Math.max(acts, 1)} act` },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {pills.map((p, i) => (
        <span key={p.label} className="flex items-center gap-1.5">
          {i ? <span className="h-px w-3 bg-zinc-300" /> : null}
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: p.color }}
          >
            {p.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function FlowNode({
  accent,
  badge,
  icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  accent: string;
  badge: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative w-[220px] shrink-0 rounded-xl border bg-[#1c1f27] p-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition",
        selected ? "border-mint ring-2 ring-mint/35" : "border-white/10 hover:border-white/25",
      )}
    >
      <span
        className="absolute top-1/2 left-[-5px] h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 bg-[#111318]"
        style={{ borderColor: accent }}
      />
      <span
        className="absolute top-1/2 right-[-5px] h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 bg-[#111318]"
        style={{ borderColor: accent }}
      />
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{badge}</div>
          <div className="truncate text-sm font-semibold">{title}</div>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-white/50">{subtitle}</p>
    </button>
  );
}

function EdgePlus({
  open,
  onToggle,
  allowIf,
  usedFields,
  onAddIf,
  onAddAction,
}: {
  open: boolean;
  onToggle: () => void;
  allowIf: boolean;
  usedFields: string[];
  onAddIf: (field: ConditionFieldKey) => void;
  onAddAction: (type: ActionType) => void;
}) {
  const availableIf = CONDITION_FIELDS.filter((f) => !usedFields.includes(f.key));
  return (
    <div className="relative mx-1 flex w-16 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-white/20" />
      <button
        type="button"
        onClick={onToggle}
        className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#111318] text-white/80 hover:border-mint hover:text-mint"
        aria-label="Add node"
      >
        {open ? <X size={13} /> : <Plus size={13} />}
      </button>
      {open ? (
        <div className="absolute top-10 left-1/2 z-20 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-[#1c1f27] p-2 shadow-2xl">
          {allowIf && availableIf.length ? (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                IF
              </div>
              {availableIf.slice(0, 6).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5"
                  onClick={() => onAddIf(f.key)}
                >
                  <GitBranch size={13} className="text-[#5b8def]" />
                  {f.label}
                </button>
              ))}
            </>
          ) : null}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Action
          </div>
          {ACTION_TYPES.map((a) => (
            <button
              key={a.value}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5"
              onClick={() => onAddAction(a.value)}
            >
              <span className="text-mint">{actionIcon(a.value)}</span>
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionInspector({
  row,
  agents,
  onChange,
}: {
  row: ActionDraft;
  agents: AgentOption[];
  onChange: (patch: Partial<ActionDraft>) => void;
}) {
  const meta = ACTION_TYPES.find((a) => a.value === row.type);
  const needsMessage = row.type === "send_whatsapp" || row.type === "send_sms" || row.type === "notify";
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-white/55">Node</label>
      <select
        className={darkInput}
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
      {meta ? <p className="text-xs leading-5 text-white/45">{meta.hint}</p> : null}
      {needsMessage ? (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-white/55">Message</label>
          <textarea
            className={`${darkInput} min-h-[96px] resize-y`}
            value={row.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          {row.type !== "notify" ? (
            <p className="mt-1 text-[11px] text-white/35">Vars: {MESSAGE_VARS.join(" ")}</p>
          ) : null}
        </div>
      ) : null}
      {row.type === "notify" || row.type === "create_task" ? (
        <input
          className={darkInput}
          placeholder={row.type === "create_task" ? "Task title" : "Notification title"}
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      ) : null}
      {row.type === "add_tag" ? (
        <input className={darkInput} placeholder="tag" value={row.tag} onChange={(e) => onChange({ tag: e.target.value })} />
      ) : null}
      {row.type === "change_status" ? (
        <select className={darkInput} value={row.status} onChange={(e) => onChange({ status: e.target.value })}>
          {ORDER_PIPELINE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      ) : null}
      {row.type === "assign_agent" ? (
        <select className={darkInput} value={row.agentId} onChange={(e) => onChange({ agentId: e.target.value })}>
          <option value="">Select an agent</option>
          {agents.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.name}
            </option>
          ))}
        </select>
      ) : null}
      {row.type === "assign_queue" ? (
        <select className={darkInput} value={row.strategy} onChange={(e) => onChange({ strategy: e.target.value })}>
          {DISPATCH_STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      ) : null}
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
      <select className={darkInput} value={value} onChange={(e) => onChange(e.target.value)}>
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
      <select className={darkInput} value={value} onChange={(e) => onChange(e.target.value)}>
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
      className={darkInput}
      type={field.kind === "number" ? "number" : "text"}
      placeholder={"placeholder" in field ? field.placeholder : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function actionIcon(type: string) {
  if (type === "send_whatsapp") return <MessageCircle size={14} />;
  if (type === "send_sms") return <Smartphone size={14} />;
  if (type === "create_shipment") return <Truck size={14} />;
  if (type === "add_tag") return <Tag size={14} />;
  if (type === "assign_agent") return <UserPlus size={14} />;
  if (type === "assign_queue") return <Users size={14} />;
  if (type === "create_task") return <ListTodo size={14} />;
  if (type === "notify") return <Bell size={14} />;
  return <GitBranch size={14} />;
}
