export type WhatsAppPreset = {
  id: string;
  name: string;
  description: string;
  trigger: "order.created" | "order.status";
  status?: string;
  paymentMethod?: "cod";
  message: string;
};

/** Ready-made COD WhatsApp journeys. Enabling one writes an Automation row. */
export const WHATSAPP_PRESETS: WhatsAppPreset[] = [
  {
    id: "wa_confirm",
    name: "Confirm on create",
    description: "Send a WhatsApp the moment a COD order lands — no missed calls after 8pm.",
    trigger: "order.created",
    paymentMethod: "cod",
    message:
      "Salam {{customer_name}}, votre commande {{order_id}} ({{product}} — {{total}} MAD COD, {{city}}) est bien reçue. Répondez OUI pour confirmer.",
  },
  {
    id: "wa_no_answer",
    name: "Follow up after no answer",
    description: "If the call desk misses them, WhatsApp asks for confirmation automatically.",
    trigger: "order.status",
    status: "NO_ANSWER",
    message:
      "On n'a pas pu vous joindre pour {{order_id}}. Confirmez ici : {{product}}, {{total}} MAD à {{city}}. Répondez OUI ou NON.",
  },
  {
    id: "wa_confirmed",
    name: "Preparing after confirm",
    description: "Tell the customer the order is confirmed and being packed.",
    trigger: "order.status",
    status: "CONFIRMED",
    message: "{{order_id}} est confirmée. On prépare l'envoi vers {{city}}.",
  },
  {
    id: "wa_shipped",
    name: "Tracking when shipped",
    description: "Push the AWB and tracking link as soon as the parcel leaves.",
    trigger: "order.status",
    status: "SHIPPED",
    message: "{{order_id}} est expédiée. AWB {{awb}}. Suivi : {{tracking_url}}",
  },
  {
    id: "wa_ofd",
    name: "Out for delivery",
    description: "Lower RTO — the buyer knows the driver is coming and the COD amount.",
    trigger: "order.status",
    status: "OUT_FOR_DELIVERY",
    message:
      "Le livreur arrive aujourd'hui pour {{order_id}}. COD {{total}} MAD, {{city}}. Gardez votre téléphone allumé.",
  },
  {
    id: "wa_delivered",
    name: "Thank you after delivery",
    description: "Close the loop when cash is collected.",
    trigger: "order.status",
    status: "DELIVERED",
    message: "Merci {{customer_name}} ! {{order_id}} est livrée. À bientôt.",
  },
  {
    id: "wa_returned",
    name: "Returned parcel",
    description: "Ping the customer when a parcel comes back so you can offer an exchange.",
    trigger: "order.status",
    status: "RETURNED",
    message: "{{order_id}} a été retournée. Répondez ÉCHANGE ou REMBOURSEMENT.",
  },
];

export function presetById(id: string): WhatsAppPreset | undefined {
  return WHATSAPP_PRESETS.find((p) => p.id === id);
}

export type WhatsAppVars = {
  number: string;
  total: unknown;
  customer: { name: string; city: string; phone?: string };
  product?: string;
  awb?: string;
  trackingUrl?: string;
};

export function interpolateWhatsApp(text: string, vars: WhatsAppVars): string {
  const total = String(vars.total ?? "");
  const tracking = vars.trackingUrl || `https://nexora.local/t/${vars.awb || vars.number}`;
  return text
    .replaceAll("{{customer_name}}", vars.customer.name)
    .replaceAll("{{order_id}}", vars.number)
    .replaceAll("{{total}}", total)
    .replaceAll("{{city}}", vars.customer.city)
    .replaceAll("{{phone}}", vars.customer.phone ?? "")
    .replaceAll("{{product}}", vars.product || "votre commande")
    .replaceAll("{{product_name}}", vars.product || "votre commande")
    .replaceAll("{{awb}}", vars.awb || "—")
    .replaceAll("{{tracking_url}}", tracking);
}

export function presetActions(preset: WhatsAppPreset) {
  return [{ type: "send_whatsapp", text: preset.message }];
}

export function presetConditions(preset: WhatsAppPreset) {
  return {
    preset: preset.id,
    ...(preset.paymentMethod ? { paymentMethod: preset.paymentMethod } : {}),
    ...(preset.status ? { status: preset.status } : {}),
  };
}
