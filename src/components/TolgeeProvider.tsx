"use client";

import { Tolgee, TolgeeProvider as TolgeeReactProvider } from "@tolgee/react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { getStaticMessages, getTolgeeRuntimeConfig } from "@/lib/tolgee/config";

/**
 * Tolgee provider.
 *
 * The bundled static dictionary is the source of truth for rendering, and the
 * Tolgee API is layered on top purely for authoring. `staticData` is therefore
 * always supplied, so a Tolgee outage degrades editing convenience rather than
 * breaking the site — and the server-rendered markup is always correct.
 */
export function TolgeeProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const { apiUrl, projectId } = getTolgeeRuntimeConfig();
  // TolgeeStaticData is keyed by language, then by namespace (the default
  // namespace is the empty string).
  const staticData = { [locale]: getStaticMessages(locale) };

  const tolgee = Tolgee().init({
    language: locale,
    defaultLanguage: locale,
    fallbackLanguage: "en",
    staticData,
    // Omitted entirely when unset, so Tolgee never attempts a network call.
    ...(projectId ? { apiUrl, apiKey: projectId } : {}),
  });

  return (
    <TolgeeReactProvider tolgee={tolgee} ssr={{ language: locale, staticData }}>
      {children}
    </TolgeeReactProvider>
  );
}
