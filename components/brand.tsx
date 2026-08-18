export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#0c2a24" />
      <path
        d="M11 26.5c4.2-1.2 6.6-6.4 8.2-12.4 1.4 5.6 4.2 10.8 9.8 12.4"
        fill="none"
        stroke="#3dfa9b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12.2" r="2.1" fill="#3dfa9b" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className="h-8 w-8" />
      <span
        className={`text-[17px] font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}
      >
        Nexora
      </span>
    </span>
  );
}
