import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DEFAULT_LOCALE, directionOf, isLocale } from "@/lib/i18n";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nexora — Operations platform for COD e-commerce",
  description:
    "Confirm orders on WhatsApp, auto-dispatch carriers, and run your whole cash-on-delivery team from one workspace.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const raw = jar.get("nexora_locale")?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${plusJakarta.variable} ${fraunces.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
