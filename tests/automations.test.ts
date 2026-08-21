import { describe, expect, it } from "vitest";
import {
  AUTOMATION_PRESETS,
  emptyDraft,
  fromApiRow,
  summarizeRule,
  toApiPayload,
} from "../lib/automations";

describe("automation builder payload", () => {
  it("serializes numeric filters and drops empty assign-agent actions", () => {
    const draft = emptyDraft();
    draft.name = "VIP Casa";
    draft.trigger = "order.created";
    draft.conditions = [
      { id: "1", field: "city", value: "Casablanca" },
      { id: "2", field: "minTotal", value: "500" },
      { id: "3", field: "paymentMethod", value: "cod" },
    ];
    draft.actions = [
      {
        id: "a",
        type: "assign_agent",
        text: "",
        tag: "",
        status: "CONFIRMED",
        agentId: "",
        title: "",
        strategy: "least_loaded",
      },
      {
        id: "b",
        type: "send_whatsapp",
        text: "Hi {{customer_name}}",
        tag: "",
        status: "CONFIRMED",
        agentId: "",
        title: "",
        strategy: "least_loaded",
      },
    ];
    const payload = toApiPayload(draft);
    expect(payload.conditions).toEqual({
      city: "Casablanca",
      minTotal: 500,
      paymentMethod: "cod",
    });
    expect(payload.actions).toEqual([{ type: "send_whatsapp", text: "Hi {{customer_name}}" }]);
  });

  it("round-trips a saved rule back into the editor", () => {
    const row = {
      name: "Ship when confirmed",
      trigger: "order.status",
      conditions: { status: "CONFIRMED" },
      actions: [{ type: "create_shipment" }],
    };
    const draft = fromApiRow(row);
    expect(draft.trigger).toBe("order.status");
    expect(draft.conditions[0]).toMatchObject({ field: "status", value: "CONFIRMED" });
    expect(toApiPayload(draft).actions).toEqual([{ type: "create_shipment" }]);
  });

  it("summarizes presets in operator language", () => {
    const preset = AUTOMATION_PRESETS[0];
    const payload = toApiPayload(preset.draft);
    expect(summarizeRule(payload)).toContain("When an order is created");
    expect(summarizeRule(payload)).toContain("payment is COD");
    expect(summarizeRule(payload)).toContain("send WhatsApp");
  });
});
