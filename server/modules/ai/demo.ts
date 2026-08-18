/** Rule-based copilot used when OPENAI_API_KEY is not set. Cites real numbers. */

export type CopilotStats = {
  count: number;
  delivered: number;
  cancelled: number;
  returned: number;
  confirmationRate: number;
  deliveryRate: number;
  profit: number;
  shippingCost: number;
  collectedRevenue?: number;
  cities: Array<{ city: string; orders: number; deliveryRate: number }>;
  products: Array<{ name: string; profit: number }>;
};

export type Lookup = {
  kind: "order" | "customer" | "shipment";
  title: string;
  detail: string;
};

function languageOf(text: string): "ar" | "fr" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (
    /\b(combien|commande|livr|ville|marge|profit|retour|encaiss|bonjour|salut|quoi)\b/i.test(text)
  ) {
    return "fr";
  }
  return "en";
}

export function copilotReply(question: string, stats: CopilotStats, lookups: Lookup[] = []) {
  const lang = languageOf(question);
  const q = question.toLowerCase();

  if (lookups.length) {
    const block = lookups.map((l) => `• ${l.title}: ${l.detail}`).join("\n");
    if (lang === "ar") return `لقيت هاد السجلات:\n${block}`;
    if (lang === "fr") return `Voici ce que j'ai trouvé :\n${block}`;
    return `Here's what I found:\n${block}`;
  }

  const weakCity = [...stats.cities].sort((a, b) => a.deliveryRate - b.deliveryRate)[0];
  const topProduct = stats.products[0];

  if (/livr|deliver|taux|rate/.test(q)) {
    return lang === "fr"
      ? `Sur les 7 derniers jours : ${stats.delivered} livrées sur ${stats.count} commandes (taux ${stats.deliveryRate}%). ${weakCity ? `Ville la plus faible : ${weakCity.city} à ${weakCity.deliveryRate}%.` : ""}`
      : lang === "ar"
        ? `آخر 7 أيام: ${stats.delivered} تسليم من أصل ${stats.count} طلب (نسبة ${stats.deliveryRate}%).`
        : `Last 7 days: ${stats.delivered} delivered out of ${stats.count} orders (${stats.deliveryRate}% delivery rate). ${weakCity ? `Weakest city: ${weakCity.city} at ${weakCity.deliveryRate}%.` : ""}`;
  }

  if (/\b(profit|marge|margin|ربح)\b/.test(q)) {
    return lang === "fr"
      ? `Profit 7j : ${Math.round(stats.profit)} MAD après ${Math.round(stats.shippingCost)} MAD de frais transporteur. ${topProduct ? `Meilleure marge : ${topProduct.name}.` : ""}`
      : lang === "ar"
        ? `الربح 7 أيام: ${Math.round(stats.profit)} درهم بعد مصاريف الشحن.`
        : `7-day profit: ${Math.round(stats.profit)} MAD after ${Math.round(stats.shippingCost)} MAD of carrier cost. ${topProduct ? `Best margin: ${topProduct.name}.` : ""}`;
  }

  if (/\b(retour|return|rto|مرتجع)\b/.test(q)) {
    return lang === "fr"
      ? `${stats.returned} retours et ${stats.cancelled} annulations sur ${stats.count} commandes. Ouvrez Returns pour le motif.`
      : lang === "ar"
        ? `${stats.returned} مرتجع و ${stats.cancelled} إلغاء من ${stats.count} طلب.`
        : `${stats.returned} returns and ${stats.cancelled} cancellations out of ${stats.count} orders. Open Returns for the reason.`;
  }

  if (/\b(ville|city|مدينة)\b/.test(q)) {
    const top = stats.cities.slice(0, 3).map((c) => `${c.city} (${c.orders})`).join(", ");
    return lang === "fr"
      ? `Top villes : ${top || "—"}. ${weakCity ? `${weakCity.city} livre le moins bien (${weakCity.deliveryRate}%).` : ""}`
      : `Top cities: ${top || "—"}.`;
  }

  return lang === "fr"
    ? `Ces 7 jours : ${stats.count} commandes, ${stats.confirmationRate}% confirmées, ${stats.deliveryRate}% livrées, profit ${Math.round(stats.profit)} MAD. Posez-moi une ville, un n° NX-… ou « retours ».`
    : lang === "ar"
      ? `آخر 7 أيام: ${stats.count} طلب، تأكيد ${stats.confirmationRate}%، تسليم ${stats.deliveryRate}%.`
      : `Last 7 days: ${stats.count} orders, ${stats.confirmationRate}% confirmed, ${stats.deliveryRate}% delivered, profit ${Math.round(stats.profit)} MAD. Ask about a city, an NX- number, or returns.`;
}
