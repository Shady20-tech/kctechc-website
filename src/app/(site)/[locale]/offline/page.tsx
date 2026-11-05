import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LOCALES, isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Offline fallback.
 *
 * Served by `public/sw.js` when a navigation fails and nothing for that URL is in
 * the cache. It is a real localized page rather than a hard-coded string in the
 * worker, so it carries the site's own chrome and fonts.
 *
 * `noindex` because it is a transient failure state, not a destination: a crawler
 * that indexed it would list "you are offline" as a page of the site.
 *
 * The worker precaches `/offline`, the un-prefixed form, which `src/proxy.ts`
 * rewrites to the visitor's detected locale. The rewrite is why the worker keys
 * its fallback on the offline route rather than assuming the precached URL is the
 * one that gets served.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return {
    title: t("offline.title"),
    robots: { index: false, follow: false },
  };
}

export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  return (
    <section className="container-page section">
      <p className="mono-label text-teal-700">Offline</p>
      <h1 className="mt-3 text-3xl font-bold text-ink-900 sm:text-4xl">
        {t("offline.title")}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-body">
        {t("offline.description")}
      </p>
      <ul className="mt-8 flex flex-wrap gap-3">
        <li>
          <Link
            href={`/${resolved}`}
            className="inline-block rounded-control bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition-soft hover:bg-ink-700"
          >
            {t("common.backToHome")}
          </Link>
        </li>
      </ul>
    </section>
  );
}
