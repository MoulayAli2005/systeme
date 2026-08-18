"use client";

import { useSyncExternalStore } from "react";
import type { AppState, Channel, Order, OrderStatus, Session } from "./types";
import { createSeedState } from "./seed";
import { minutesAgo, uid } from "./format";

const STATE_KEY = "nexora-state-v1";
const SESSION_KEY = "nexora-session";

let state: AppState = createSeedState();
const listeners = new Set<() => void>();
let hydrated = false;
let session: Session | null = null;

function emit() {
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) state = JSON.parse(raw) as AppState;
  } catch {
    state = createSeedState();
  }
  session = readSession();
  emit();
}

export function useAppState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function getState() {
  return state;
}

export function resetWorkspace() {
  state = createSeedState();
  emit();
}

function patchOrder(id: string, fn: (o: Order) => Order) {
  state = {
    ...state,
    orders: state.orders.map((o) => (o.id === id ? fn(o) : o)),
  };
  emit();
}

export function updateOrderStatus(id: string, status: OrderStatus, detail?: string) {
  patchOrder(id, (o) => ({
    ...o,
    status,
    timeline: [
      {
        id: uid("ev"),
        at: new Date().toISOString(),
        title: detail || `Status → ${status.replaceAll("_", " ")}`,
        tone:
          status === "delivered" || status === "confirmed"
            ? "success"
            : status === "cancelled" || status === "rto"
              ? "danger"
              : "default",
      },
      ...o.timeline,
    ],
  }));
}

export function assignOrder(id: string, agentId: string) {
  patchOrder(id, (o) => ({ ...o, assignedTo: agentId }));
}

export function confirmOrder(id: string, channel: Channel = "whatsapp") {
  patchOrder(id, (o) => ({
    ...o,
    status: "confirmed",
    confirmationChannel: channel,
    timeline: [
      {
        id: uid("ev"),
        at: new Date().toISOString(),
        title: `Confirmed via ${channel}`,
        tone: "success",
      },
      ...o.timeline,
    ],
  }));
}

export function cancelOrder(id: string, reason = "Customer cancelled") {
  patchOrder(id, (o) => ({
    ...o,
    status: "cancelled",
    notes: reason,
    timeline: [
      { id: uid("ev"), at: new Date().toISOString(), title: reason, tone: "danger" },
      ...o.timeline,
    ],
  }));
}

export function dispatchOrders(orderIds: string[], carrierId: string) {
  const carrier = state.carriers.find((c) => c.id === carrierId);
  const awbPrefix = (carrier?.name || "NX").slice(0, 2).toUpperCase();
  const newIds: string[] = [];
  state = {
    ...state,
    orders: state.orders.map((o) => {
      if (!orderIds.includes(o.id)) return o;
      const awb = `${awbPrefix}${Math.floor(100000000 + Math.random() * 900000000)}`;
      newIds.push(o.id);
      return {
        ...o,
        status: "shipped" as const,
        carrierId,
        awb,
        timeline: [
          {
            id: uid("ev"),
            at: new Date().toISOString(),
            title: `Dispatched via ${carrier?.name ?? "carrier"}`,
            detail: `AWB ${awb}`,
            tone: "success" as const,
          },
          ...o.timeline,
        ],
      };
    }),
    manifests: [
      {
        id: uid("mf"),
        carrierId,
        createdAt: new Date().toISOString(),
        orderIds,
        pickupAt: carrier?.pickupWindow || "Today 17:00",
        status: "ready" as const,
      },
      ...state.manifests,
    ],
  };
  emit();
}

export function sendMessage(conversationId: string, text: string, from: "agent" | "ai" | "customer" = "agent") {
  state = {
    ...state,
    conversations: state.conversations.map((c) => {
      if (c.id !== conversationId) return c;
      const msg = { id: uid("msg"), at: new Date().toISOString(), from, text };
      return {
        ...c,
        lastMessage: text,
        lastAt: msg.at,
        unread: from === "customer" ? c.unread + 1 : 0,
        messages: [...c.messages, msg],
      };
    }),
  };
  emit();
}

export function markRead(conversationId: string) {
  state = {
    ...state,
    conversations: state.conversations.map((c) =>
      c.id === conversationId ? { ...c, unread: 0 } : c,
    ),
  };
  emit();
}

export function toggleAutomation(id: string) {
  state = {
    ...state,
    automations: state.automations.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a,
    ),
  };
  emit();
}

export function toggleIntegration(id: string) {
  state = {
    ...state,
    integrations: state.integrations.map((i) =>
      i.id === id ? { ...i, connected: !i.connected } : i,
    ),
  };
  emit();
}

export function toggleCarrier(id: string) {
  state = {
    ...state,
    carriers: state.carriers.map((c) =>
      c.id === id ? { ...c, connected: !c.connected } : c,
    ),
  };
  emit();
}

export function updateAi(patch: Partial<AppState["ai"]>) {
  state = { ...state, ai: { ...state.ai, ...patch } };
  emit();
}

export function addManualOrder(input: {
  name: string;
  phone: string;
  city: string;
  productId: string;
}) {
  const product = state.products.find((p) => p.id === input.productId) ?? state.products[0];
  const number = `NX-${11547 + state.orders.length}`;
  const order: Order = {
    id: uid("ord"),
    number,
    createdAt: new Date().toISOString(),
    customer: {
      id: uid("cu"),
      name: input.name,
      phone: input.phone,
      city: input.city,
      address: input.city,
    },
    items: [
      {
        productId: product.id,
        name: product.name,
        variant: product.variant,
        qty: 1,
        price: product.price,
      },
    ],
    total: product.price,
    payment: "cod",
    status: "new",
    source: "manual",
    timeline: [
      {
        id: uid("ev"),
        at: new Date().toISOString(),
        title: "Created manually",
        tone: "default",
      },
    ],
  };
  const convId = uid("cv");
  state = {
    ...state,
    orders: [order, ...state.orders],
    conversations: [
      {
        id: convId,
        customerId: order.customer.id,
        customerName: input.name,
        phone: input.phone,
        city: input.city,
        channel: "whatsapp",
        unread: 0,
        lastMessage: `Order ${number} created`,
        lastAt: minutesAgo(0),
        orderId: order.id,
        messages: [
          {
            id: uid("msg"),
            at: new Date().toISOString(),
            from: "system",
            text: `Hi ${input.name.split(" ")[0]}, we received your order ${number}\n${product.name} — ${product.price} MAD\nCash on delivery · ${input.city}`,
            buttons: ["Confirm", "Edit", "Cancel"],
          },
        ],
      },
      ...state.conversations,
    ],
  };
  emit();
  return order.id;
}

export function injectLiveOrder() {
  const cities = ["Casablanca", "Rabat", "Marrakech", "Agadir", "Fes"];
  const names = ["Aya Bennani", "Mehdi Lahlou", "Ines Kadiri", "Walid Tazi", "Rania Squalli"];
  const i = Math.floor(Math.random() * names.length);
  const product = state.products[Math.floor(Math.random() * state.products.length)];
  return addManualOrder({
    name: names[i],
    phone: `+212 6 ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)}`,
    city: cities[i],
    productId: product.id,
  });
}

export function sendCampaign(id: string) {
  state = {
    ...state,
    campaigns: state.campaigns.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "sent",
            sent: c.sent || 420,
            delivered: c.delivered || 398,
            replied: c.replied || 47,
            converted: c.converted || 11,
          }
        : c,
    ),
  };
  emit();
}

export function createExchange(orderId: string) {
  updateOrderStatus(orderId, "exchanged", "Turned return into exchange — revenue kept");
}

export function markReturnedInspected(orderId: string, restock: boolean) {
  patchOrder(orderId, (o) => ({
    ...o,
    status: "returned",
    timeline: [
      {
        id: uid("ev"),
        at: new Date().toISOString(),
        title: restock ? "Inspected · restocked" : "Inspected · damaged write-off",
        tone: restock ? "success" : "warn",
      },
      ...o.timeline,
    ],
  }));
}

export function useSession() {
  return useSyncExternalStore(
    subscribe,
    () => session,
    () => null,
  );
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return session ?? readSession();
}

export function setSession(next: Session) {
  session = next;
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  emit();
}

export function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  emit();
}

export function aiReply(text: string, context?: { orderNumber?: string; product?: string }) {
  const t = text.toLowerCase();
  const name = state.ai.name;
  if (/\b(confirm|ok|oui|yes|confirmer|wakha)\b/.test(t)) {
    return `Confirmed — thank you. ${name} will pass this to shipping now. You’ll get a tracking message as soon as the parcel is picked up.`;
  }
  if (/\b(cancel|annul|stop|no)\b/.test(t)) {
    return state.ai.canCancel
      ? "Done, I cancelled the order. If this was a mistake, reply UNDO."
      : "I can’t cancel from here — a teammate will take over in a moment. Want to change size or address instead?";
  }
  if (/\b(track|where|livr|driver|colis)\b/.test(t)) {
    return `Your parcel ${context?.orderNumber ?? ""} is moving. I’ll ping you the moment the driver is nearby, with their name and phone.`;
  }
  if (/\b(size|taille|exchange|echange)\b/.test(t)) {
    return "We exchange within 7 days. Tell me the size you need and I’ll hold it. No extra shipping on exchanges.";
  }
  if (/\b(price|prix|cod|paiement)\b/.test(t)) {
    return "You pay cash to the driver — no card needed. COD is available in every city we ship to.";
  }
  if (/\b(black|noir)\b/.test(t)) {
    return "The Atlas Linen Blazer is currently in navy. Black restocks Friday — want me to reserve one?";
  }
  if (/\b(wash|laver)\b/.test(t)) {
    return "The Sahara Slip Dress is machine washable at 30°C, inside out. Linen pieces prefer a hang dry.";
  }
  return `I’m ${name}. I can confirm orders, share tracking, and help with sizes. ${context?.product ? `This is about ${context.product}. ` : ""}How can I help?`;
}
