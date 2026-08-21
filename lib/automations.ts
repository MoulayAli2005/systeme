import { uid } from "./format";

export const AUTOMATION_TRIGGERS = [
  { value: "order.created", label: "An order is created", hint: "New COD or prepaid order lands in the workspace." },
  { value: "order.status", label: "Order status changes", hint: "Runs after confirm, ship, no-answer, return, and every other status move." },
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]["value"];

export const ORDER_PIPELINE_STATUSES = [
  "NEW",
  "TO_CONFIRM",
  "CALLING",
  "NO_ANSWER",
  "CALLBACK",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export const ORDER_SOURCES = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "youcan", label: "YouCan" },
  { value: "facebook", label: "Facebook Leads" },
  { value: "tiktok", label: "TikTok Forms" },
  { value: "manual", label: "Manual" },
  { value: "sheets", label: "Google Sheets" },
] as const;

export const CONDITION_FIELDS = [
  {
    key: "paymentMethod",
    label: "Payment method",
    kind: "select" as const,
    options: [
      { value: "cod", label: "Cash on delivery" },
      { value: "prepaid", label: "Prepaid" },
    ],
  },
  {
    key: "status",
    label: "New status is",
    kind: "status" as const,
  },
  {
    key: "minTotal",
    label: "Minimum total (MAD)",
    kind: "number" as const,
    placeholder: "200",
  },
  {
    key: "maxTotal",
    label: "Maximum total (MAD)",
    kind: "number" as const,
    placeholder: "2000",
  },
  {
    key: "city",
    label: "City",
    kind: "text" as const,
    placeholder: "Casablanca",
  },
  {
    key: "source",
    label: "Order source",
    kind: "select" as const,
    options: [...ORDER_SOURCES],
  },
  {
    key: "minCallAttempts",
    label: "Min call attempts",
    kind: "number" as const,
    placeholder: "3",
  },
  {
    key: "minRiskScore",
    label: "Min risk score",
    kind: "number" as const,
    placeholder: "55",
  },
  {
    key: "hasTag",
    label: "Has tag",
    kind: "text" as const,
    placeholder: "vip",
  },
] as const;

export type ConditionFieldKey = (typeof CONDITION_FIELDS)[number]["key"];

export const ACTION_TYPES = [
  {
    value: "send_whatsapp",
    label: "Send WhatsApp",
    hint: "Uses Twilio if connected, otherwise the demo adapter.",
  },
  {
    value: "send_sms",
    label: "Send SMS",
    hint: "Same number as the order customer.",
  },
  {
    value: "create_shipment",
    label: "Create shipment",
    hint: "Asks the shipping provider for an AWB and tracking URL.",
  },
  {
    value: "change_status",
    label: "Change status",
    hint: "Moves the order in the pipeline.",
  },
  {
    value: "add_tag",
    label: "Add tag",
    hint: "Tags stay on the order for filters and later rules.",
  },
  {
    value: "assign_agent",
    label: "Assign agent",
    hint: "Pins a specific teammate on the order.",
  },
  {
    value: "assign_queue",
    label: "Assign next agent",
    hint: "Uses the call-center dispatch strategy.",
  },
  {
    value: "create_task",
    label: "Create task",
    hint: "Drops a follow-up on the Tasks board.",
  },
  {
    value: "notify",
    label: "Notify workspace",
    hint: "In-app notification for the team.",
  },
] as const;

export type ActionType = (typeof ACTION_TYPES)[number]["value"];

export const DISPATCH_STRATEGIES = [
  { value: "least_loaded", label: "Least loaded agent" },
  { value: "round_robin", label: "Round robin" },
  { value: "performance", label: "Top confirmer today" },
  { value: "random", label: "Random available" },
] as const;

export const MESSAGE_VARS = ["{{customer_name}}", "{{order_id}}", "{{total}}", "{{city}}"] as const;

export type ConditionDraft = { id: string; field: ConditionFieldKey; value: string };
export type ActionDraft = {
  id: string;
  type: ActionType;
  text: string;
  tag: string;
  status: string;
  agentId: string;
  title: string;
  strategy: string;
};

export type AutomationDraft = {
  name: string;
  trigger: AutomationTrigger;
  conditions: ConditionDraft[];
  actions: ActionDraft[];
};

export function emptyCondition(field: ConditionFieldKey = "paymentMethod"): ConditionDraft {
  const def = CONDITION_FIELDS.find((f) => f.key === field);
  const first = def && "options" in def ? def.options[0]?.value : "";
  return { id: uid("if"), field, value: first ?? "" };
}

export function emptyAction(type: ActionType = "send_whatsapp"): ActionDraft {
  return {
    id: uid("then"),
    type,
    text: defaultActionText(type),
    tag: "auto",
    status: type === "change_status" ? "CALLBACK" : "CONFIRMED",
    agentId: "",
    title: type === "create_task" ? "Follow up {{order_id}}" : "Automation",
    strategy: "least_loaded",
  };
}

export function emptyDraft(): AutomationDraft {
  return {
    name: "",
    trigger: "order.created",
    conditions: [emptyCondition("paymentMethod")],
    actions: [emptyAction("send_whatsapp")],
  };
}

export function defaultActionText(type: ActionType) {
  if (type === "send_whatsapp") {
    return "Hi {{customer_name}}, confirm {{order_id}} ({{total}} MAD COD to {{city}})?";
  }
  if (type === "send_sms") {
    return "{{order_id}} update: {{total}} MAD COD to {{city}}.";
  }
  if (type === "notify") {
    return "{{order_id}} matched an automation.";
  }
  return "";
}

export const AUTOMATION_PRESETS: Array<{
  name: string;
  blurb: string;
  draft: AutomationDraft;
}> = [
  {
    name: "WhatsApp confirm on create",
    blurb: "Ask COD buyers to confirm as soon as the order lands.",
    draft: {
      name: "WhatsApp confirm on create",
      trigger: "order.created",
      conditions: [{ id: "p1", field: "paymentMethod", value: "cod" }],
      actions: [{ ...emptyAction("send_whatsapp"), id: "a1" }],
    },
  },
  {
    name: "Ship when confirmed",
    blurb: "Create an AWB the moment an agent or the customer confirms.",
    draft: {
      name: "Ship when confirmed",
      trigger: "order.status",
      conditions: [{ id: "p2", field: "status", value: "CONFIRMED" }],
      actions: [{ ...emptyAction("create_shipment"), id: "a2", type: "create_shipment" }],
    },
  },
  {
    name: "Callback after 3 misses",
    blurb: "Park no-answers on CALLBACK so the next shift sees them.",
    draft: {
      name: "Callback after 3 misses",
      trigger: "order.status",
      conditions: [{ id: "p3", field: "minCallAttempts", value: "3" }],
      actions: [{ ...emptyAction("change_status"), id: "a3", type: "change_status", status: "CALLBACK" }],
    },
  },
  {
    name: "Out-for-delivery SMS",
    blurb: "Ping the buyer with the COD amount when the parcel is on the road.",
    draft: {
      name: "Out-for-delivery SMS",
      trigger: "order.status",
      conditions: [{ id: "p4", field: "status", value: "OUT_FOR_DELIVERY" }],
      actions: [
        {
          ...emptyAction("send_sms"),
          id: "a4",
          type: "send_sms",
          text: "{{order_id}} is out for delivery. COD {{total}} MAD. Keep your phone on.",
        },
      ],
    },
  },
  {
    name: "High-risk review",
    blurb: "Tag and task anything the risk engine scores 55+.",
    draft: {
      name: "High-risk review",
      trigger: "order.created",
      conditions: [{ id: "p5", field: "minRiskScore", value: "55" }],
      actions: [
        { ...emptyAction("add_tag"), id: "a5", type: "add_tag", tag: "manual_verification" },
        {
          ...emptyAction("create_task"),
          id: "a6",
          type: "create_task",
          title: "Verify {{order_id}} before calling",
        },
      ],
    },
  },
  {
    name: "VIP city dispatch",
    blurb: "Assign Casablanca orders over 500 MAD to the next free agent.",
    draft: {
      name: "VIP city dispatch",
      trigger: "order.created",
      conditions: [
        { id: "p6", field: "city", value: "Casablanca" },
        { id: "p7", field: "minTotal", value: "500" },
      ],
      actions: [
        { ...emptyAction("assign_queue"), id: "a7", type: "assign_queue", strategy: "least_loaded" },
        { ...emptyAction("add_tag"), id: "a8", type: "add_tag", tag: "vip" },
      ],
    },
  },
];

const NUMERIC_FIELDS = new Set(["minTotal", "maxTotal", "minCallAttempts", "minRiskScore"]);

export function toApiPayload(draft: AutomationDraft) {
  const conditions: Record<string, unknown> = {};
  for (const row of draft.conditions) {
    if (!row.field || row.value === "") continue;
    conditions[row.field] = NUMERIC_FIELDS.has(row.field) ? Number(row.value) : row.value;
  }
  const actions = draft.actions
    .map((row) => actionToRecord(row))
    .filter((row): row is Record<string, string> => Boolean(row));
  return {
    name: draft.name.trim(),
    trigger: draft.trigger,
    conditions,
    actions,
  };
}

function actionToRecord(row: ActionDraft): Record<string, string> | null {
  const type = row.type;
  if (type === "send_whatsapp" || type === "send_sms") {
    return { type, text: row.text.trim() || defaultActionText(type) };
  }
  if (type === "create_shipment") return { type };
  if (type === "change_status") return { type, status: row.status || "CONFIRMED" };
  if (type === "add_tag") return { type, tag: row.tag.trim() || "auto" };
  if (type === "assign_agent") {
    if (!row.agentId) return null;
    return { type, agentId: row.agentId };
  }
  if (type === "assign_queue") return { type, strategy: row.strategy || "least_loaded" };
  if (type === "create_task") {
    return { type, title: row.title.trim() || "Follow up {{order_id}}" };
  }
  if (type === "notify") {
    return {
      type,
      title: row.title.trim() || "Automation",
      text: row.text.trim() || defaultActionText("notify"),
    };
  }
  return { type };
}

export function fromApiRow(row: {
  name: string;
  trigger: string;
  conditions: unknown;
  actions: unknown;
}): AutomationDraft {
  const raw = (row.conditions ?? {}) as Record<string, unknown>;
  const conditions: ConditionDraft[] = Object.entries(raw)
    .filter(([key]) => CONDITION_FIELDS.some((f) => f.key === key))
    .map(([key, value]) => ({
      id: uid("if"),
      field: key as ConditionFieldKey,
      value: value == null ? "" : String(value),
    }));
  const actionsRaw = Array.isArray(row.actions) ? row.actions : [];
  const actions: ActionDraft[] = actionsRaw.map((item) => {
    const rec = (item ?? {}) as Record<string, string>;
    const type = (ACTION_TYPES.some((a) => a.value === rec.type) ? rec.type : "add_tag") as ActionType;
    return {
      ...emptyAction(type),
      type,
      text: rec.text ?? defaultActionText(type),
      tag: rec.tag ?? "auto",
      status: rec.status ?? "CONFIRMED",
      agentId: rec.agentId ?? "",
      title: rec.title ?? "",
      strategy: rec.strategy ?? "least_loaded",
    };
  });
  const trigger = AUTOMATION_TRIGGERS.some((t) => t.value === row.trigger)
    ? (row.trigger as AutomationTrigger)
    : "order.created";
  return {
    name: row.name,
    trigger,
    conditions: conditions.length ? conditions : [],
    actions: actions.length ? actions : [emptyAction()],
  };
}

export function triggerLabel(value: string) {
  return AUTOMATION_TRIGGERS.find((t) => t.value === value)?.label ?? value;
}

export function conditionCaption(row: ConditionDraft) {
  const field = CONDITION_FIELDS.find((f) => f.key === row.field);
  const label = field?.label ?? row.field;
  if (row.field === "paymentMethod") {
    if (row.value === "cod") return "Payment is COD";
    if (row.value === "prepaid") return "Payment is prepaid";
  }
  if (row.field === "status") return `Status is ${statusPretty(row.value)}`;
  if (!row.value) return label;
  return `${label}: ${row.value}`;
}

export function actionCaption(row: ActionDraft) {
  if (row.type === "add_tag") return `Tag “${row.tag || "auto"}”`;
  if (row.type === "change_status") return `Set ${statusPretty(row.status)}`;
  if (row.type === "send_whatsapp") return "WhatsApp the customer";
  if (row.type === "send_sms") return "SMS the customer";
  if (row.type === "create_shipment") return "Create AWB";
  if (row.type === "assign_queue") return row.strategy?.replaceAll("_", " ") || "Next agent";
  if (row.type === "assign_agent") return "Assign agent";
  if (row.type === "create_task") return row.title || "Create task";
  if (row.type === "notify") return row.title || "Notify workspace";
  return actionLabel(row.type);
}

export function actionLabel(value: string) {
  return ACTION_TYPES.find((a) => a.value === value)?.label ?? value.replaceAll("_", " ");
}

function statusPretty(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

export function summarizeConditions(conditions: unknown): string {
  const raw = (conditions ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (raw.paymentMethod === "cod") parts.push("payment is COD");
  if (raw.paymentMethod === "prepaid") parts.push("payment is prepaid");
  if (raw.status) parts.push(`status is ${statusPretty(String(raw.status))}`);
  if (raw.minTotal != null && raw.minTotal !== "") parts.push(`total ≥ ${raw.minTotal} MAD`);
  if (raw.maxTotal != null && raw.maxTotal !== "") parts.push(`total ≤ ${raw.maxTotal} MAD`);
  if (raw.city) parts.push(`city is ${raw.city}`);
  if (raw.source) parts.push(`source is ${raw.source}`);
  if (raw.minCallAttempts != null && raw.minCallAttempts !== "") {
    parts.push(`at least ${raw.minCallAttempts} call attempts`);
  }
  if (raw.minRiskScore != null && raw.minRiskScore !== "") {
    parts.push(`risk score ≥ ${raw.minRiskScore}`);
  }
  if (raw.hasTag) parts.push(`tagged ${raw.hasTag}`);
  return parts.length ? parts.join(" · ") : "always";
}

export function summarizeActions(actions: unknown): string {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) return "do nothing";
  return list
    .map((item) => {
      const rec = (item ?? {}) as Record<string, string>;
      if (rec.type === "send_whatsapp") return "send WhatsApp";
      if (rec.type === "send_sms") return "send SMS";
      if (rec.type === "create_shipment") return "create shipment";
      if (rec.type === "change_status") return `set status to ${statusPretty(rec.status || "")}`;
      if (rec.type === "add_tag") return `add tag “${rec.tag || "auto"}”`;
      if (rec.type === "assign_agent") return "assign an agent";
      if (rec.type === "assign_queue") return "assign next free agent";
      if (rec.type === "create_task") return "create a task";
      if (rec.type === "notify") return "notify the workspace";
      return actionLabel(rec.type || "action");
    })
    .join(", then ");
}

export function summarizeRule(row: { trigger: string; conditions: unknown; actions: unknown }) {
  return `When ${triggerLabel(row.trigger).toLowerCase()}, if ${summarizeConditions(row.conditions)}, then ${summarizeActions(row.actions)}.`;
}
