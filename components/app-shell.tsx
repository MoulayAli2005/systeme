"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
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
  Workflow,
  Zap,
} from "lucide-react";
import { LogoMark } from "./brand";
import { Avatar } from "./ui";
import { cn } from "@/lib/format";
import {
  clearSession,
  getSession,
  hydrateStore,
  useAppState,
  useSession,
} from "@/lib/store";
import { WORKSPACE } from "@/lib/seed";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/orders", label: "Orders", icon: Package },
  { href: "/app/confirmation", label: "Confirmation", icon: PhoneCall },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/shipping", label: "Shipping", icon: Truck },
  { href: "/app/returns", label: "Returns", icon: RotateCcw },
  { href: "/app/products", label: "Products", icon: Boxes },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/automations", label: "Automations", icon: Workflow },
  { href: "/app/ai-agent", label: "AI agent", icon: Bot },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/integrations", label: "Integrations", icon: Zap },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const state = useAppState();

  useEffect(() => {
    hydrateStore();
    if (!getSession()) router.replace("/login");
  }, [router]);

  const unread = state.conversations.reduce((n, c) => n + c.unread, 0);
  const pending = state.orders.filter(
    (o) => o.status === "pending_confirmation" || o.status === "new",
  ).length;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-zinc-500">
        Opening {WORKSPACE.name}…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f3f0e8]">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-sand bg-ink text-white md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <LogoMark className="h-8 w-8" />
          <div>
            <div className="text-sm font-semibold leading-none">Nexora</div>
            <div className="mt-1 text-[11px] text-white/45">{WORKSPACE.name}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge =
              item.label === "Inbox" && unread
                ? unread
                : item.label === "Confirmation" && pending
                  ? pending
                  : 0;
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
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span className="rounded-full bg-mint px-1.5 text-[10px] font-bold text-ink">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <Avatar initials="AK" hue={150} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{session.name}</div>
              <div className="truncate text-[11px] text-white/40">{session.email}</div>
            </div>
            <button
              onClick={() => {
                clearSession();
                router.push("/");
              }}
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-sand bg-paper/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-sand bg-white px-3 py-2 text-sm text-zinc-400">
            <Search size={15} />
            <span className="hidden sm:inline">Search orders, customers, AWB…</span>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-mint/20 px-3 py-1.5 text-xs font-semibold text-emerald-900 sm:flex">
            <Sparkles size={13} />
            AI agent on
          </div>
          <div className="text-xs font-medium text-zinc-500">{WORKSPACE.plan} plan</div>
        </header>
        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
