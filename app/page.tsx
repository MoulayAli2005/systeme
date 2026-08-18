import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  MessageCircle,
  Package,
  Phone,
  Sparkles,
  Truck,
  Workflow,
} from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { LogoMark } from "@/components/brand";
import { PartnerShowcase, PartnerStrip } from "@/components/partner-section";

export default function HomePage() {
  return (
    <div className="bg-paper">
      <div className="bg-ink text-white">
        <MarketingNav dark />
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-fade" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-2 lg:pt-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-mint">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" />
                Built for COD teams doing 20+ orders/day
              </div>
              <h1 className="font-display mt-6 text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
                Run your entire COD operation in one place.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/70 sm:text-lg">
                From WhatsApp confirmation to carrier labels and returns
                reconciliation — Nexora runs the workflow for your whole team.
                No more Excel at 11pm.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-mint px-5 py-3 text-sm font-semibold text-ink hover:bg-white"
                >
                  Open the live demo <ArrowRight size={16} />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/5"
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-4 text-xs text-white/45">
                7-day sandbox · sample Moroccan fashion store · no card required
              </p>
              <div className="mt-10 flex flex-wrap gap-6 text-sm">
                {[
                  ["78%", "Confirmation"],
                  ["91%", "On-time delivery"],
                  ["−4h", "Ops time / day"],
                ].map(([n, l]) => (
                  <div key={l}>
                    <div className="text-2xl font-semibold tracking-tight text-mint">{n}</div>
                    <div className="text-xs uppercase tracking-[0.14em] text-white/45">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <HeroBoard />
          </div>
        </section>
        <PartnerStrip />
      </div>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          The spreadsheet tax
        </p>
        <h2 className="font-display mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl">
          Your sheet is costing you orders, parcels, and four hours every day.
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-sand bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-sand bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
              Orders_Final_v7.xlsx · 5 of 6 rows already need a human
            </div>
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  {["Order", "Customer", "Phone", "Status", "Carrier"].map((h) => (
                    <th key={h} className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-zinc-700">
                {[
                  ["#4829", "Amine T.", "06 12 34 56 78", "confirmed", "DHL"],
                  ["#4830", "(missing)", "#REF!", "??", "#N/A"],
                  ["#4831", "Dounia S.", "06 98 —", "pending", "—"],
                  ["#4832", "Yassine B.", "—", "cancelled?", "DHL"],
                  ["#4833", "=VLOOKUP(..)", "#ERROR", "#REF!", "#N/A"],
                ].map((row, i) => (
                  <tr key={i} className="border-t border-sand">
                    {row.map((c, j) => (
                      <td
                        key={j}
                        className={`px-4 py-2.5 ${c.includes("ERROR") || c.includes("REF") || c.includes("??") ? "text-rose-600" : ""}`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col justify-center">
            <ul className="space-y-4 text-sm leading-6 text-zinc-700">
              {[
                "Every order syncs live — no copy, no paste, no CSVs at midnight.",
                "Confirmation, shipping and support live on the same row — not five tabs.",
                "WhatsApp replies sit next to the order, with the COD amount and city already filled.",
                "Carriers print labels from the status you already confirmed.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
            >
              Move off the sheet <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section id="product" className="border-y border-sand bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            The operating system
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl">
            Confirm. Dispatch. Deliver. Reconcile.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Feature
              icon={<MessageCircle size={18} />}
              kicker="01 · Confirmation"
              title="Confirm orders without making a single call."
              body="Send a WhatsApp the moment an order is placed. Customers tap Confirm in seconds — no missed calls, no idle agents, no lost COD."
              points={[
                "WhatsApp automation on create, shipped, out for delivery, delivered",
                "Costs a fraction of a phone call",
                "Falls back to your agents when a human is needed",
              ]}
            />
            <Feature
              icon={<Truck size={18} />}
              kicker="02 · Shipping"
              title="Confirmed orders ship themselves."
              body="The moment an order is confirmed, Nexora assigns the right carrier, prints the label, and adds it to today’s manifest."
              points={[
                "Keep your direct carrier contracts",
                "Rules by city, weight, SKU, payment",
                "Webhooks mirror every status back to your store",
              ]}
            />
            <Feature
              icon={<Package size={18} />}
              kicker="03 · Delivery"
              title="Lower RTO with WhatsApp follow-ups."
              body="Customers who know the parcel is coming refuse it less. Shipped, out for delivery, failed attempt — each one pings the buyer."
              points={[
                "Driver name and COD amount in the message",
                "One-tap reschedule after a failed attempt",
                "Thank-you + review when cash is collected",
              ]}
            />
            <Feature
              icon={<Workflow size={18} />}
              kicker="04 · Returns"
              title="Get every returned parcel back on the books."
              body="Match RTO parcels to orders, flag the missing ones, and reconcile COD payouts line by line — then turn returns into exchanges."
              points={[
                "Stop reconciling remittances in Excel",
                "Inspect and restock in one click",
                "Keep the revenue with instant exchanges",
              ]}
            />
          </div>
        </div>
      </section>

      <section id="inbox" className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              05 · One inbox
            </p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
              WhatsApp, Instagram and order history in the same thread.
            </h2>
            <p className="mt-4 text-zinc-600 leading-7">
              Your team stops switching apps. Every message lands with the customer’s
              last order, COD amount and city already open — so the first reply has
              the answer.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              {[
                "Multi-agent assignment with presence",
                "Templates, broadcasts, and Meta-ready campaigns",
                "AI drafts that know catalog, stock and policies",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check size={16} className="mt-0.5 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <InboxMock />
        </div>
      </section>

      <section id="ai" className="border-y border-sand bg-ink py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-mint">
              <Sparkles size={14} /> 24/7 agent · FR · AR · EN · Darija
            </div>
            <h2 className="font-display mt-4 text-3xl tracking-tight sm:text-4xl">
              An agent that confirms, tracks, and sells while you sleep.
            </h2>
            <p className="mt-4 text-white/70 leading-7">
              Noor answers in under a minute, confirms COD, holds sizes, and hands
              off to a human the moment a conversation needs judgment. You set the
              tone. Nexora keeps the receipts.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
              Live · WhatsApp
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Bubble who="Customer">wakha, confirm the beige shirt. COD to Marrakech?</Bubble>
              <Bubble who="Noor">
                Confirmed — NX-11546, Aurora Linen Shirt, 289 MAD COD, Marrakech.
                We’ll ship today. I’ll send the driver name when it’s out.
              </Bubble>
              <Bubble who="Customer">can I change to M?</Bubble>
              <Bubble who="Noor">Done. Size M is held. Anything else?</Bubble>
            </div>
          </div>
        </div>
      </section>

      <PartnerShowcase />

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              q: "Nexora wasn’t only easier for my team — it was a time and cost tool. Support actually listens.",
              a: "Hassan Benguejid",
              r: "COD fashion · MA",
            },
            {
              q: "We stopped losing orders after 8pm. WhatsApp confirmation paid for the whole stack in a week.",
              a: "Abdellah",
              r: "TheWolfz.com",
            },
            {
              q: "Dispatch used to be a 90-minute spreadsheet. Now confirmed orders print themselves.",
              a: "Sara El Alami",
              r: "Home & living · Casa",
            },
          ].map((t) => (
            <blockquote key={t.a} className="rounded-3xl border border-sand bg-white p-6">
              <p className="text-sm leading-6 text-zinc-700">“{t.q}”</p>
              <footer className="mt-4 text-sm font-semibold">
                {t.a}
                <span className="block text-xs font-medium text-zinc-500">{t.r}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="overflow-hidden rounded-[32px] bg-ink px-8 py-12 text-white md:px-14">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
                Free setup. Love it in 7 days — or walk away.
              </h2>
              <p className="mt-3 max-w-lg text-white/65">
                Keep your store, carriers and WhatsApp number. Open the Atlas Atelier
                demo workspace and click around a real COD day.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-mint px-6 py-3 text-sm font-semibold text-ink"
            >
              Launch demo workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

function Feature({
  icon,
  kicker,
  title,
  body,
  points,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <article className="rounded-3xl border border-sand bg-paper/60 p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-mint">
        {icon}
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {kicker}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
      <ul className="mt-4 space-y-2 text-sm text-zinc-700">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <Check size={16} className="mt-0.5 text-emerald-600" /> {p}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Bubble({ who, children }: { who: string; children: ReactNode }) {
  const mine = who === "Noor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? "bg-mint text-ink" : "bg-white/10 text-white"}`}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">{who}</div>
        {children}
      </div>
    </div>
  );
}

function HeroBoard() {
  return (
    <div className="float-y relative">
      <div className="rounded-[24px] border border-white/10 bg-[#0a1f1b] p-3 shadow-[0_40px_120px_rgba(0,0,0,.45)]">
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="text-xs font-semibold">Atlas Atelier</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-mint">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" /> Live · 5s
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["18%", "Conversion"],
            ["78%", "Confirmed"],
            ["12", "To dispatch"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-white/5 px-3 py-2">
              <div className="text-lg font-semibold text-mint">{n}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white text-ink">
          <div className="flex items-center justify-between border-b border-sand px-3 py-2 text-[11px] font-semibold">
            <span>New order · NX-11546</span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Pending</span>
          </div>
          <div className="px-3 py-3">
            <div className="text-sm font-semibold">Aurora Linen Shirt · Beige</div>
            <div className="mt-0.5 text-xs text-zinc-500">Nabil Amrani · Marrakech · 289 MAD COD</div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white">
                Confirm
              </span>
              <span className="rounded-full border border-sand px-3 py-1 text-[11px] font-semibold">
                Call
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-sand px-3 py-1 text-[11px] font-semibold">
                <Phone size={11} /> WhatsApp
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxMock() {
  return (
    <div className="overflow-hidden rounded-3xl border border-sand bg-white shadow-sm">
      <div className="grid md:grid-cols-[180px_1fr]">
        <div className="border-b border-sand p-3 md:border-b-0 md:border-r">
          {["Nabil Amrani", "Noura Senhaji", "Dounia Slaoui"].map((n, i) => (
            <div
              key={n}
              className={`rounded-xl px-3 py-2 text-sm ${i === 0 ? "bg-paper font-semibold" : "text-zinc-600"}`}
            >
              {n}
              <div className="text-[11px] font-normal text-zinc-400">
                {i === 0 ? "Confirm" : i === 1 ? "Driver called…" : "Do you have black?"}
              </div>
            </div>
          ))}
        </div>
        <div className="wa-bg p-4">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm">
            Hi Nabil, we received NX-11546 — Aurora Linen Shirt, 289 MAD COD, Marrakech.
          </div>
          <div className="mt-2 max-w-[70%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">
            Confirm
          </div>
          <div className="mt-3 rounded-xl border border-sand bg-white p-3 text-xs">
            <div className="font-semibold">NX-11546 · Pending → Confirmed</div>
            <div className="mt-1 text-zinc-500">1 × 289 MAD · Cash on delivery</div>
          </div>
        </div>
      </div>
    </div>
  );
}
