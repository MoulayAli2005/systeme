"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Chatbot } from "./chatbot";
import { I18nProvider } from "./i18n";
import type { Locale } from "@/lib/i18n";

export function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={initialLocale}>
        {children}
        <Chatbot />
      </I18nProvider>
    </QueryClientProvider>
  );
}
