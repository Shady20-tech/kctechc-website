"use client";

import { Tolgee, TolgeeProvider as TolgeeReactProvider } from "@tolgee/react";
import type { ReactNode } from "react";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { getStaticMessages, getTolgeeRuntimeConfig } from "@/lib/tolgee/config";

/**
 * Tolgee provider.
 *
 * The bundled static dictionary is the source of truth for rendering, and the
 * Tolgee API is layered on top purely for authoring. `staticData` is therefore
 * always supplied, so a Tolgee outage degrades editing convenience rather than
 * breaking the site — and the server-rendered markup is always correct.
 *
 * Every locale is registered as a fallback chain for the active language, not
 * just the active one. Tolgee resolves a missing key by walking the chain, so a
 * key that exists only in English must be present for a French render too;
 * shipping only `fr` would leave those fallbacks missing and produce a partial
 * SSR render.
 */
export function TolgeeProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const { apiUrl, projectId } = getTolgeeRuntimeConfig();

  const staticData = Object.fromEntries(
    LOCALES.map((entry) => [entry, getStaticMessages(entry)]),
  );

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
