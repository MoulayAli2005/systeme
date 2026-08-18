"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Boxes,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PhoneCall,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Workflow,
  ListTodo,
  Zap,
} from "lucide-react";
import { LogoMark } from "./brand";
import { LanguageSwitcher, useI18n } from "./i18n";
import { Avatar } from "./ui";
import { cn } from "@/lib/format";
import { api, type SessionUser } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";

const nav: Array<{
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  badge?: "unread" | "pending";
}> = [
  { href: "/app/dashboard", labelKey: "app.dashboard", icon: LayoutDashboard },
  { href: "/app/orders", labelKey: "app.orders", icon: Package },
  { href: "/app/pipeline", labelKey: "app.pipeline", icon: Workflow },
  { href: "/app/customers", labelKey: "app.customers", icon: Users },
  { href: "/app/confirmation", labelKey: "app.callCenter", icon: PhoneCall, badge: "pending" },
  { href: "/app/inbox", labelKey: "app.inbox", icon: Inbox, badge: "unread" },
  { href: "/app/shipping", labelKey: "app.shipments", icon: Truck },
  { href: "/app/returns", labelKey: "app.returns", icon: RotateCcw },
  { href: "/app/products", labelKey: "app.products", icon: Boxes },
  { href: "/app/inventory", labelKey: "app.inventory", icon: Warehouse },
  { href: "/app/campaigns", labelKey: "app.marketing", icon: Megaphone },
  { href: "/app/automations", labelKey: "app.automations", icon: Workflow },
  { href: "/app/ai-agent", labelKey: "app.ai", icon: Bot },
  { href: "/app/analytics", labelKey: "app.analytics", icon: BarChart3 },
  { href: "/app/team", labelKey: "app.team", icon: Users },
  { href: "/app/tasks", labelKey: "app.tasks", icon: ListTodo },
  { href: "/app/integrations", labelKey: "app.integrations", icon: Zap },
  { href: "/app/settings", labelKey: "app.settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ orders: { id: string; number: string }[]; customers: { id: string; name: string }[] } | null>(null);

  useEffect(() => {
    api<{ user: SessionUser | null }>("/api/v1/auth/me")
      .then((r) => {
        if (!r.user) router.replace("/login");
        else setSession(r.user);
      })
      .catch(() => router.replace("/login"));
    api<{ grouped: Array<{ status: string; _count: number }> }>("/api/v1/orders/pipeline")
      .then((r) => {
        const n = r.grouped
          .filter((g) => ["NEW", "TO_CONFIRM", "CALLING"].includes(g.status))
          .reduce((s, g) => s + g._count, 0);
        setPending(n);
      })
      .catch(() => undefined);
    api<{ rows: Array<{ unread: number }> }>("/api/v1/inbox")
      .then((r) => setUnread(r.rows.reduce((s, c) => s + c.unread, 0)))
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (q.length < 2) return;
    const t = setTimeout(() => {
      api<{ orders: { id: string; number: string }[]; customers: { id: string; name: string }[] }>(
        `/api/v1/search?q=${encodeURIComponent(q)}`,
      ).then(setHits);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-zinc-500">
        {t("app.opening")}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f3f0e8]">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-e border-sand bg-ink text-white md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <LogoMark className="h-8 w-8" />
          <div>
            <div className="text-sm font-semibold leading-none">Nexora</div>
            <div className="mt-1 text-[11px] text-white/45">{session.organizationName}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge = item.badge === "unread" ? unread : item.badge === "pending" ? pending : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium",
                  active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon size={16} />
                <span className="flex-1">{t(item.labelKey)}</span>
                {badge ? (
                  <span className="rounded-full bg-mint px-1.5 text-[10px] font-bold text-ink">{badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <Avatar initials={session.name.slice(0, 2).toUpperCase()} hue={150} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{session.name}</div>
              <div className="truncate text-[11px] text-white/40">{session.roleKey}</div>
            </div>
            <button
              onClick={async () => {
                await api("/api/v1/auth/logout", { method: "POST" });
                router.push("/");
              }}
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label={t("app.signOut")}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-sand bg-paper/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 rounded-full border border-sand bg-white px-3 py-2 text-sm">
              <Search size={15} className="text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("app.search")}
                className="w-full bg-transparent outline-none"
              />
            </div>
            {q.length >= 2 && hits ? (
              <div className="absolute mt-1 w-full rounded-2xl border border-sand bg-white p-2 text-sm shadow-lg">
                {hits.orders.map((o) => (
                  <Link key={o.id} href={`/app/orders/${o.id}`} className="block rounded-lg px-2 py-1 hover:bg-paper">
                    {o.number}
                  </Link>
                ))}
                {hits.customers.map((c) => (
                  <Link key={c.id} href={`/app/customers/${c.id}`} className="block rounded-lg px-2 py-1 hover:bg-paper">
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <LanguageSwitcher />
          <div className="hidden items-center gap-2 rounded-full bg-mint/20 px-3 py-1.5 text-xs font-semibold text-emerald-900 sm:flex">
            <Sparkles size={13} />
            {session.organizationName}
          </div>
        </header>
        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
