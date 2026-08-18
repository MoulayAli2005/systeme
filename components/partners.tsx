import { cn } from "@/lib/format";

export type Partner = {
  id: string;
  name: string;
  src: string;
  href: string;
  /** Official files that already sit on a dark plate. */
  onDark?: boolean;
  kind: "store" | "carrier";
  className?: string;
};

export const STORE_PARTNERS: Partner[] = [
  {
    id: "shopify",
    name: "Shopify",
    src: "/partners/shopify.svg",
    href: "https://www.shopify.com/",
    kind: "store",
    className: "h-8 w-[140px]",
  },
  {
    id: "youcan",
    name: "YouCan",
    src: "/partners/youcan.svg",
    href: "https://youcan.shop/",
    kind: "store",
    className: "h-8 w-[140px]",
  },
  {
    id: "dropify",
    name: "Dropify",
    src: "/partners/dropify.png",
    href: "https://dropify.shop/",
    kind: "store",
    className: "h-10 w-10",
  },
];

export const CARRIER_PARTNERS: Partner[] = [
  {
    id: "ozon",
    name: "Ozon Express",
    src: "/partners/ozon.png",
    href: "https://ozonexpress.ma/",
    kind: "carrier",
    onDark: true,
    className: "h-10 w-12",
  },
  {
    id: "ameex",
    name: "Ameex",
    src: "/partners/ameex.png",
    href: "https://www.ameex.ma/",
    kind: "carrier",
    onDark: true,
    className: "h-8 w-[140px]",
  },
  {
    id: "aramex",
    name: "Aramex",
    src: "/partners/aramex.svg",
    href: "https://www.aramex.com/",
    kind: "carrier",
    className: "h-6 w-[140px]",
  },
  {
    id: "sendit",
    name: "Sendit",
    src: "/partners/sendit.png",
    href: "https://www.sendit.ma/",
    kind: "carrier",
    onDark: true,
    className: "h-8 w-[140px]",
  },
  {
    id: "cathedis",
    name: "Cathedis",
    src: "/partners/cathedis.png",
    href: "https://cathedis.ma/",
    kind: "carrier",
    onDark: true,
    className: "h-8 w-[150px]",
  },
  {
    id: "chronopost",
    name: "Chronopost Maroc",
    src: "/partners/chronopost.png",
    href: "https://www.chronopost.ma/",
    kind: "carrier",
    className: "h-8 w-[180px]",
  },
  {
    id: "ctm",
    name: "CTM",
    src: "/partners/ctm.png",
    href: "https://ctm.ma/",
    kind: "carrier",
    onDark: true,
    className: "h-8 w-[140px]",
  },
  {
    id: "tawssil",
    name: "Tawssil",
    src: "/partners/tawssil.svg",
    href: "https://www.tawssil.ma/",
    kind: "carrier",
    className: "h-9 w-[130px]",
  },
  {
    id: "dhl",
    name: "DHL Express",
    src: "/partners/dhl.svg",
    href: "https://www.dhl.com/ma-fr/home.html",
    kind: "carrier",
    className: "h-7 w-[140px]",
  },
  {
    id: "olivraison",
    name: "Olivraison",
    src: "/partners/olivraison.png",
    href: "https://olivraison.com/",
    kind: "carrier",
    onDark: true,
    className: "h-10 w-10",
  },
];

export const ALL_PARTNERS: Partner[] = [...STORE_PARTNERS, ...CARRIER_PARTNERS];

export function PartnerLogo({
  partner,
  className,
}: {
  partner: Partner;
  className?: string;
}) {
  return (
    <img
      src={partner.src}
      alt={partner.name}
      title={partner.name}
      className={cn("object-contain", partner.className, className)}
    />
  );
}

export function PartnerTile({ partner }: { partner: Partner }) {
  const withName = partner.id === "dropify" || partner.id === "olivraison";
  return (
    <a
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex h-[92px] items-center justify-center rounded-2xl border px-4 transition hover:border-ink/30",
        partner.onDark ? "border-white/10 bg-ink" : "border-sand bg-white",
      )}
    >
      <span className="flex items-center justify-center gap-2.5">
        <PartnerLogo partner={partner} />
        {withName ? (
          <span className={cn("text-sm font-semibold", partner.onDark ? "text-white" : "text-ink")}>
            {partner.name}
          </span>
        ) : null}
      </span>
    </a>
  );
}

export function PartnerMarquee({ dark = false }: { dark?: boolean }) {
  const row = [...ALL_PARTNERS, ...ALL_PARTNERS];
  return (
    <div className="flex overflow-hidden">
      <div className="animate-marquee flex min-w-full items-center gap-8 pr-8">
        {row.map((partner, i) => (
          <span
            key={`${partner.id}-${i}`}
            className={cn(
              "flex h-12 shrink-0 items-center justify-center rounded-xl px-4",
              partner.onDark ? "bg-black/40" : dark ? "bg-white" : "bg-white",
            )}
          >
            <PartnerLogo partner={partner} />
          </span>
        ))}
      </div>
    </div>
  );
}
