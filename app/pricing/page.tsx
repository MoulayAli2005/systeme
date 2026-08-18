import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

const plans = [
  {
    name: "Starter",
    price: "49",
    blurb: "Solo operators getting off the sheet.",
    features: [
      "1 WhatsApp number",
      "Up to 500 orders / month",
      "Confirmation + inbox",
      "1 store connection",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "149",
    blurb: "The default for COD teams hitting 20+ orders/day.",
    featured: true,
    features: [
      "3 WhatsApp numbers",
      "Unlimited orders",
      "Call center + AI agent",
      "Unlimited stores & carriers",
      "Automations & campaigns",
      "COD reconciliation",
      "Priority setup",
    ],
  },
  {
    name: "Business",
    price: "349",
    blurb: "Multi-brand groups and 3PL-style ops.",
    features: [
      "Everything in Growth",
      "Multi-workspace",
      "Custom roles & SSO",
      "Dedicated success manager",
      "SLA & audit logs",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="bg-paper">
      <MarketingNav />
      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Pricing
        </p>
        <h1 className="font-display mt-3 max-w-2xl text-4xl tracking-tight">
          Platform fee only. WhatsApp is pass-through.
        </h1>
        <p className="mt-4 max-w-xl text-zinc-600">
          7-day sandbox on every plan. Cancel anytime. Conversation fees billed at
          Meta’s published rate — never marked up.
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.name}
              className={`flex flex-col rounded-3xl border p-6 ${p.featured ? "border-ink bg-ink text-white" : "border-sand bg-white"}`}
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight">${p.price}</span>
                <span className={`mb-1 text-sm ${p.featured ? "text-white/50" : "text-zinc-500"}`}>
                  /mo
                </span>
              </div>
              <p className={`mt-2 text-sm ${p.featured ? "text-white/65" : "text-zinc-600"}`}>
                {p.blurb}
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={16} className={p.featured ? "text-mint" : "text-emerald-600"} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-8 rounded-full px-4 py-2.5 text-center text-sm font-semibold ${p.featured ? "bg-mint text-ink" : "bg-ink text-white"}`}
              >
                Start with the demo
              </Link>
            </article>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
