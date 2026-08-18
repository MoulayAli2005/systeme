"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { FLAG_BY_LOCALE } from "./flags";
import { cn } from "@/lib/format";
import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_META,
  directionOf,
  isLocale,
  translate,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  dict: (typeof DICTIONARIES)[Locale];
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function persist(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = directionOf(locale);
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persist(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: directionOf(locale),
      t: (key) => translate(locale, key),
      dict: DICTIONARIES[locale],
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function LanguageSwitcher({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const Current = FLAG_BY_LOCALE[locale];

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold",
          variant === "dark"
            ? "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            : "border border-sand bg-white text-ink hover:bg-paper",
        )}
      >
        <Current title={LOCALE_META[locale].native} className="h-3.5 w-5 rounded-[2px]" />
        <span>{LOCALE_META[locale].native}</span>
        <ChevronDown size={12} className={cn("opacity-60", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="absolute end-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-2xl border border-sand bg-white py-1 text-sm text-ink shadow-lg"
        >
          {LOCALES.map((code) => {
            const Flag = FLAG_BY_LOCALE[code];
            const selected = code === locale;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLocale(code);
                    setOpen(false);
                    router.refresh();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-paper",
                    selected && "bg-paper font-semibold",
                  )}
                >
                  <Flag title={LOCALE_META[code].native} className="h-3.5 w-5 shrink-0 rounded-[2px]" />
                  <span className="flex-1">{LOCALE_META[code].native}</span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">{code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export { isLocale, DEFAULT_LOCALE };
