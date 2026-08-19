"use client";

import { useT } from "./i18n";
import { CARRIER_PARTNERS, PartnerMarquee, PartnerTile, STORE_PARTNERS } from "./partners";

export function PartnerStrip() {
  const t = useT();
  return (
    <div className="border-t border-white/10 py-6">
      <div className="mx-auto max-w-6xl overflow-hidden px-5">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {t("partners.kicker")} · Shopify · YouCan · Dropify
        </p>
        <PartnerMarquee dark />
      </div>
    </div>
  );
}

export function PartnerShowcase() {
  const t = useT();
  return (
    <section id="integrations" className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{t("partners.kicker")}</p>
      <h2 className="font-display mt-3 max-w-3xl text-3xl tracking-tight sm:text-4xl">{t("partners.title")}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">{t("partners.subtitle")}</p>

      <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{t("partners.stores")}</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STORE_PARTNERS.map((partner) => (
          <PartnerTile key={partner.id} partner={partner} />
        ))}
      </div>

      <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {t("partners.carriers")}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {CARRIER_PARTNERS.map((partner) => (
          <PartnerTile key={partner.id} partner={partner} />
        ))}
      </div>
      <p className="mt-4 text-xs text-zinc-500">{t("partners.more")}</p>
    </section>
  );
}
