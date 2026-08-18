"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./brand";
import { LanguageSwitcher, useT } from "./i18n";
import { ALL_PARTNERS, PartnerLogo } from "./partners";
import { cn } from "@/lib/format";

export function MarketingNav({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const links = [
    { href: "/#product", label: t("nav.product") },
    { href: "/#inbox", label: t("nav.inbox") },
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/#integrations", label: t("nav.integrations") },
  ];

  return (
    <header
      className={`sticky top-0 z-40 ${dark ? "bg-ink/80 text-white" : "bg-paper/80 text-ink"} backdrop-blur-xl`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="relative z-10">
          <Wordmark light={dark} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-80 hover:opacity-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher variant={dark ? "dark" : "light"} />
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${dark ? "text-white/80 hover:text-white" : "text-ink/70 hover:text-ink"}`}
          >
            {t("nav.signIn")}
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-mint px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
          >
            {t("nav.openDemo")}
          </Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher variant={dark ? "dark" : "light"} />
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-white/10 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm font-medium">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/login">{t("nav.signIn")}</Link>
            <Link href="/signup" className="font-semibold text-mint-2">
              {t("nav.openDemo")}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function MarketingFooter() {
  const t = useT();
  return (
    <footer className="border-t border-sand bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-600">
            The operations platform for cash-on-delivery e-commerce teams. Confirmation,
            shipping, inbox, and analytics — one workspace.
          </p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {ALL_PARTNERS.map((partner) => (
              <span
                key={partner.id}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg px-2",
                  partner.onDark ? "bg-ink" : "bg-white ring-1 ring-sand",
                )}
                title={partner.name}
              >
                <PartnerLogo partner={partner} className="h-5 w-auto max-w-[72px]" />
              </span>
            ))}
          </div>
        </div>
        {[
          {
            h: t("nav.product"),
            items: [
              [t("nav.product"), "/#product"],
              [t("nav.inbox"), "/#inbox"],
            ],
          },
          {
            h: t("nav.pricing"),
            items: [
              [t("nav.pricing"), "/pricing"],
              [t("nav.signIn"), "/login"],
              [t("nav.openDemo"), "/signup"],
            ],
          },
          {
            h: t("nav.integrations"),
            items: [[t("nav.integrations"), "/#integrations"]],
          },
        ].map((col) => (
          <div key={col.h}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {col.h}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {col.items.map(([l, h]) => (
                <li key={`${l}-${h}`}>
                  <Link href={h} className="text-zinc-700 hover:text-ink">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-sand px-5 py-5 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Nexora. Built for COD operators — not another spreadsheet.
      </div>
    </footer>
  );
}
