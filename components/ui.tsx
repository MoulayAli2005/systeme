import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/format";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap",
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-sand bg-white p-4 shadow-[0_1px_0_rgba(7,20,16,0.04)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-ink">{value}</div>
        {delta ? (
          <div
            className={cn(
              "mb-0.5 text-xs font-semibold",
              good === false ? "text-rose-600" : "text-emerald-700",
            )}
          >
            {delta}
          </div>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

export function Avatar({
  initials,
  hue,
  size = 32,
}: {
  initials: string;
  hue: number;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 45% 38%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function ProductSwatch({ hue, className }: { hue: number; className?: string }) {
  return (
    <span
      className={cn("inline-block rounded-xl", className)}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 55% 72%), hsl(${hue} 40% 42%))`,
      }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-emerald-600" : "bg-zinc-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-sand bg-white px-3 py-2.5 text-sm outline-none ring-mint/40 focus:ring-2";
