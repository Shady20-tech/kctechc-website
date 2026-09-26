import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SkipLink } from "@/components/layout/Navigation";
import { DEPARTMENTS, SITE } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/config/env";
import { LOCALES, LOCALE_LABELS, LOCALE_SEO_TAGS } from "@/lib/i18n/locales";
import { STATIC_MESSAGES } from "@/lib/i18n/messages";
import { buildLocaleAlternates } from "@/lib/i18n/routing";
import { organizationJsonLd } from "@/lib/seo/structured-data";
import "../globals.css";

/**
 * Corporate gateway at `/`.
 *
 * Language-neutral by design: it presents English and French plus the three
 * departments rather than auto-redirecting. That is what makes it a correct
 * `x-default` target — a crawler or first-time visitor is never forced into a
 * language they did not choose.
 */
export const metadata: Metadata = {
  title: `${SITE.legalName} — ${SITE.motto}`,
  description:
    "KC Technology Corporation operates Digital Marketing, Electrical Services and Real Estate from Half-Mile, Limbe, Cameroon. Choose a department and language.",
  alternates: {
    canonical: "/",
    languages: buildLocaleAlternates("/", getSiteUrl()),
  },
};

const DEPARTMENT_LABEL_KEYS = {
  "digital-marketing": "digitalMarketing",
  "electrical-services": "electricalServices",
  "real-estate": "realEstate",
} as const;

export default function CorporateGatewayPage() {
  const en = STATIC_MESSAGES.en;
  const fr = STATIC_MESSAGES.fr;

  return (
    <html lang="en">
      <body>
        <SkipLink>{en.common.skipToContent}</SkipLink>

        <main id="main" className="container-page py-16">
          <JsonLdScript data={organizationJsonLd("en")} />

          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
            {SITE.legalName}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-navy-900 sm:text-4xl">
            {en.home.gatewayHeading}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-body">
            {en.home.gatewayIntro}
          </p>
          <p className="mt-2 max-w-3xl text-base text-body">
            {fr.home.gatewayIntro}
          </p>

          <section aria-labelledby="gateway-languages" className="mt-12">
            <h2
              id="gateway-languages"
              className="text-lg font-semibold text-navy-900"
            >
              {en.actions.chooseLanguage} / {fr.actions.chooseLanguage}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {LOCALES.map((locale) => (
                <li key={locale}>
                  <Link
                    href={`/${locale}`}
                    hrefLang={locale}
                    className="inline-block rounded-card border border-navy-900 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-navy-900 hover:text-white"
                  >
                    {LOCALE_LABELS[locale]} ({LOCALE_SEO_TAGS[locale]})
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="gateway-departments" className="mt-12">
            <h2
              id="gateway-departments"
              className="text-lg font-semibold text-navy-900"
            >
              {en.departments.heading}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {DEPARTMENTS.map((department) => (
                <li
                  key={department.slug}
                  className="rounded-card border border-border bg-surface p-5"
                  style={{
                    borderTopColor: department.accent,
                    borderTopWidth: "4px",
                  }}
                >
                  <h3 className="font-semibold text-navy-900">
                    {en.departments[DEPARTMENT_LABEL_KEYS[department.slug]].label}
                  </h3>
                  <ul className="mt-3 flex gap-3">
                    {LOCALES.map((locale) => (
                      <li key={locale}>
                        <Link
                          href={`/${locale}/${department.slug}`}
                          hrefLang={locale}
                          className="text-sm text-navy-700 underline underline-offset-4"
                        >
                          {LOCALE_LABELS[locale]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-12 text-sm text-muted">{en.home.gatewayNote}</p>
        </main>
      </body>
    </html>
  );
}
