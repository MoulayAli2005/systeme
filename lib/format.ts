import type { PaymentMethod, StoreSource } from "./types";

export const MAD = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});

export function money(n: number) {
  return MAD.format(n);
}

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  NEW: "New",
  pending_confirmation: "Pending confirm",
  TO_CONFIRM: "To confirm",
  CALLING: "Calling",
  NO_ANSWER: "No answer",
  CALLBACK: "Callback",
  confirmed: "Confirmed",
  CONFIRMED: "Confirmed",
  cancelled: "Cancelled",
  CANCELLED: "Cancelled",
  packed: "Packed",
  PREPARING: "Preparing",
  shipped: "Shipped",
  SHIPPED: "Shipped",
  out_for_delivery: "Out for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  delivered: "Delivered",
  DELIVERED: "Delivered",
  failed_delivery: "Failed attempt",
  rto: "RTO",
  returned: "Returned",
  RETURNED: "Returned",
  exchanged: "Exchanged",
};

export const STATUS_TONE: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  NEW: "bg-sky-50 text-sky-700 ring-sky-200",
  pending_confirmation: "bg-amber-50 text-amber-800 ring-amber-200",
  TO_CONFIRM: "bg-amber-50 text-amber-800 ring-amber-200",
  CALLING: "bg-amber-50 text-amber-800 ring-amber-200",
  NO_ANSWER: "bg-orange-50 text-orange-800 ring-orange-200",
  CALLBACK: "bg-orange-50 text-orange-800 ring-orange-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  packed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PREPARING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  shipped: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  SHIPPED: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  out_for_delivery: "bg-blue-50 text-blue-800 ring-blue-200",
  OUT_FOR_DELIVERY: "bg-blue-50 text-blue-800 ring-blue-200",
  delivered: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  DELIVERED: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  failed_delivery: "bg-orange-50 text-orange-800 ring-orange-200",
  rto: "bg-rose-50 text-rose-800 ring-rose-200",
  returned: "bg-rose-50 text-rose-700 ring-rose-200",
  RETURNED: "bg-rose-50 text-rose-700 ring-rose-200",
  exchanged: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status.replaceAll("_", " ");
}

export function statusTone(status: string) {
  return STATUS_TONE[status] ?? "bg-zinc-50 text-zinc-700 ring-zinc-200";
}

export const SOURCE_LABEL: Record<StoreSource, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  youcan: "YouCan",
  facebook: "Facebook Leads",
  tiktok: "TikTok Forms",
  manual: "Manual",
  sheets: "Google Sheets",
};

export function paymentLabel(p: PaymentMethod) {
  return p === "cod" ? "COD" : "Prepaid";
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export function minutesAgo(min: number) {
  return new Date(Date.now() - min * 60_000).toISOString();
}
