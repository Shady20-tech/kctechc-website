import { ArrowRight, Building2, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SkipLink } from "@/components/layout/Navigation";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { LastDepartmentShortcut } from "@/components/layout/LastDepartment";
import { RotatingStatement } from "@/components/ui/RotatingStatement";
import { DEPARTMENTS, SITE } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteUrl } from "@/lib/config/env";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_SEO_TAGS,
  type Locale,
} from "@/lib/i18n/locales";
import { STATIC_MESSAGES } from "@/lib/i18n/messages";
import { buildLocaleAlternates } from "@/lib/i18n/routing";
import { organizationJsonLd } from "@/lib/seo/structured-data";

/**
 * Corporate gateway at `/`.
 *
 * Language-neutral by design: it presents both languages plus the three
 * departments rather than auto-redirecting. That is what makes it a correct
 * `x-default` target — a crawler or first-time visitor is never forced into a
 * language they did not choose.
 *
 * Every statement line is rendered into the HTML, so the gateway's message is
 * complete without JavaScript; the rotation is an enhancement layered on top.
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

const EN = STATIC_MESSAGES.en;
const FR = STATIC_MESSAGES.fr;

/**
 * Bilingual statement lines. Both languages are shown at the gateway because the
 * visitor has not chosen one yet — the point of this page is the choice itself.
 */
const STATEMENT_LINES = [
  EN.home.gatewayIntro,
  FR.home.gatewayIntro,
  EN.departments.intro,
  FR.departments.intro,
];

export default async function CorporateGatewayPage() {
  const site = await getSiteContent();
  const { contact } = site;

  const departmentLabels = Object.fromEntries(
    DEPARTMENTS.map((department) => [
      department.slug,
      EN.departments[DEPARTMENT_LABEL_KEYS[department.slug]].label,
    ]),
  ) as Record<(typeof DEPARTMENTS)[number]["slug"], string>;

  return (
    <>
      <SkipLink>{EN.common.skipToContent}</SkipLink>

      <header className="border-b border-border bg-navy-950">
        <div className="container-page flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white/10 font-display text-sm font-bold text-gold-500"
            >
              KC
            </span>
            <span className="font-display text-base font-bold text-white">
              {site.legalName}
            </span>
          </div>

          <nav aria-label={EN.actions.chooseLanguage}>
            <ul className="flex items-center gap-2">
              {LOCALES.map((locale) => (
                <li key={locale}>
                  <Link
                    href={`/${locale}`}
                    hrefLang={LOCALE_SEO_TAGS[locale]}
                    className="inline-flex items-center gap-2 rounded-card border border-white/25 px-3 py-2 text-sm font-medium text-white transition-soft hover:bg-white/10"
                  >
                    {LOCALE_LABELS[locale]}
                    <span className="text-xs text-white/60">
                      {locale.toUpperCase()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main">
        <JsonLdScript data={organizationJsonLd("en")} />

        <section className="accent-wash border-b border-border">
          <div className="container-page section">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
              {site.legalName}
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold text-navy-900 sm:text-4xl lg:text-5xl">
              {EN.home.gatewayHeading}
            </h1>

            <RotatingStatement
              lines={STATEMENT_LINES}
              className="mt-5 max-w-3xl text-base text-body"
            />

            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {EN.home.heroLocation}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#gateway-departments"
                className="inline-flex items-center gap-2 rounded-card bg-navy-900 px-6 py-3 text-base font-semibold text-white transition-soft hover:bg-navy-700"
              >
                {EN.home.heroPrimaryCta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/en/contact"
                className="inline-flex items-center gap-2 rounded-card border border-navy-900 px-6 py-3 text-base font-semibold text-navy-900 transition-soft hover:bg-navy-900 hover:text-white"
              >
                {EN.home.heroSecondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <section
          id="gateway-departments"
          aria-labelledby="gateway-departments-heading"
          className="container-page section"
        >
          <h2
            id="gateway-departments-heading"
            className="text-2xl font-semibold text-navy-900"
          >
            {EN.departments.heading}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-body">
            {EN.home.gatewayNote}
          </p>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map((department) => (
              <DepartmentCard
                key={department.slug}
                department={department}
                locale="en"
                label={departmentLabels[department.slug]}
                summary={EN.departments[DEPARTMENT_LABEL_KEYS[department.slug]].summary}
                actionLabel={EN.actions.exploreDepartment}
              />
            ))}
          </ul>

          <LastDepartmentShortcut
            locale="en"
            heading={EN.home.lastDepartment}
            note={EN.home.lastDepartmentNote}
            labels={departmentLabels}
          />
        </section>

        <section
          aria-labelledby="gateway-about-heading"
          className="border-y border-border bg-surface-alt"
        >
          <div className="container-page section grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2
                id="gateway-about-heading"
                className="text-2xl font-semibold text-navy-900"
              >
                {EN.home.aboutHeading}
              </h2>
              <p className="mt-3 max-w-2xl text-base text-body">
                {EN.home.aboutBody}
              </p>
              <p className="mt-3 max-w-2xl text-base text-muted">
                {FR.home.aboutBody}
              </p>
              <Link
                href="/en/about"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-navy-900 underline underline-offset-4 transition-soft hover:text-gold-700"
              >
                {EN.home.aboutCta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            <aside
              aria-labelledby="gateway-trust-heading"
              className="rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <h2
                id="gateway-trust-heading"
                className="text-base font-semibold text-navy-900"
              >
                {EN.home.trustHeading}
              </h2>
              <p className="mt-1 text-xs text-muted">{EN.home.trustNote}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex gap-2">
                  <dt className="visually-hidden">{EN.footer.emailLabel}</dt>
                  <Mail
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-navy-700 underline underline-offset-4"
                    >
                      {contact.email}
                    </a>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="visually-hidden">{EN.footer.phoneLabel}</dt>
                  <Phone
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd className="flex flex-col">
                    {contact.phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                        className="text-navy-700 underline underline-offset-4"
                      >
                        {phone}
                      </a>
                    ))}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="visually-hidden">{EN.footer.addressLabel}</dt>
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd className="text-body">
                    {contact.address.street}, {contact.address.city},{" "}
                    {contact.address.region}, {contact.address.country}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section
          aria-labelledby="gateway-language-heading"
          className="container-page section"
        >
          <h2
            id="gateway-language-heading"
            className="text-xl font-semibold text-navy-900"
          >
            {EN.actions.chooseLanguage} / {FR.actions.chooseLanguage}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-body">
            {EN.home.gatewayNote}
          </p>
          <ul className="mt-5 flex flex-wrap gap-3">
            {LOCALES.map((locale) => (
              <li key={locale}>
                <Link
                  href={`/${locale}`}
                  hrefLang={LOCALE_SEO_TAGS[locale]}
                  className="inline-flex items-center gap-2 rounded-card border border-navy-900 px-5 py-3 text-sm font-semibold text-navy-900 transition-soft hover:bg-navy-900 hover:text-white"
                >
                  {LOCALE_LABELS[locale]}
                  <span className="text-xs text-muted">
                    {LOCALE_SEO_TAGS[locale]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mt-10 flex items-center gap-2 text-base font-semibold text-navy-900">
            <Building2 aria-hidden="true" className="h-4 w-4" />
            {EN.departments.heading}
          </h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {DEPARTMENTS.map((department) => (
              <li
                key={department.slug}
                className="rounded-card border border-border bg-surface p-5 shadow-card"
                style={{ borderTopColor: department.accent, borderTopWidth: "4px" }}
              >
                <h4 className="font-semibold text-navy-900">
                  {departmentLabels[department.slug]}
                </h4>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {LOCALES.map((locale: Locale) => (
                    <li key={locale}>
                      <Link
                        href={`/${locale}/${department.slug}`}
                        hrefLang={LOCALE_SEO_TAGS[locale]}
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
      </main>

      <footer
        aria-label={EN.a11y.footerLandmark}
        className="border-t border-border bg-navy-950 py-8 text-white"
      >
        <div className="container-page flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/60">
            {EN.footer.copyright.replace("{year}", String(new Date().getFullYear()))}
          </p>
          <p className="text-xs text-white/60">{site.motto}</p>
        </div>
      </footer>
    </>
  );
}
