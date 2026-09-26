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
 */
export const metadata: Metadata = {
  // `absolute` because the root layout applies a `%s | <legal name>` template and
  // this title already contains the brand name.
  title: {
    absolute: `${SITE.legalName} — ${SITE.motto}`,
  },
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

/**
 * The three disciplines, shown as a capability strip under the hero. These are
 * the service categories the business actually operates in, not invented
 * credentials — no counts, awards or years are claimed anywhere on this page.
 */
const CAPABILITIES = [
  "Strategy & brand",
  "Web & e-commerce",
  "Electrical engineering",
  "Property services",
] as const;

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

      <header className="on-ink border-b border-white/10 bg-ink-950">
        <div className="container-page flex flex-col gap-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-card"
            aria-label={site.legalName}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/kc-monogram-inverse.png"
                alt=""
                width={44}
                height={26}
                className="h-6 w-auto"
                decoding="async"
              />
            </span>
            <span className="font-display text-[0.95rem] font-bold tracking-tight text-white">
              {site.legalName}
            </span>
          </Link>

          <nav aria-label={EN.actions.chooseLanguage}>
            <ul className="flex items-center gap-2">
              {LOCALES.map((locale) => (
                <li key={locale}>
                  <Link
                    href={`/${locale}`}
                    hrefLang={LOCALE_SEO_TAGS[locale]}
                    className="inline-flex items-center gap-2 rounded-card border border-white/20 px-3.5 py-2 text-sm font-medium text-white transition-soft hover:border-teal-300 hover:bg-white/5"
                  >
                    {LOCALE_LABELS[locale]}
                    <span className="mono-label text-white/50">
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

        {/* Hero. Dark ink with a technical grid and brand glow, so the corporate
            entry point reads as engineered rather than as a plain header block. */}
        <section className="on-ink relative overflow-hidden bg-ink-950">
          <div aria-hidden="true" className="absolute inset-0 bg-grid" />
          <div aria-hidden="true" className="absolute inset-0 bg-glow" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-glow-warm"
          />
          <div className="relative container-page py-20 sm:py-28 lg:py-32">
            <p className="reveal mono-label text-teal-300">
              {site.legalName} — Half-Mile, Limbe
            </p>

            <h1
              className="reveal display-tight mt-6 max-w-4xl font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl"
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
            >
              {EN.home.gatewayHeading}
            </h1>

            <RotatingStatement
              lines={STATEMENT_LINES}
              className="reveal mt-7 max-w-2xl text-base leading-relaxed text-ink-200 sm:text-lg"
            />

            <div
              className="reveal mt-9 flex flex-wrap items-center gap-3"
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
            >
              <Link
                href="#gateway-departments"
                className="inline-flex items-center gap-2 rounded-card bg-teal-500 px-6 py-3.5 text-base font-semibold text-ink-950 transition-soft hover:bg-teal-400"
              >
                {EN.home.heroPrimaryCta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/en/contact"
                className="inline-flex items-center gap-2 rounded-card border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition-soft hover:bg-white/10"
              >
                {EN.home.heroSecondaryCta}
              </Link>
            </div>

            <p
              className="reveal mt-8 flex items-center gap-2 text-sm text-ink-300"
              style={{ "--reveal-delay": "220ms" } as React.CSSProperties}
            >
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {EN.home.heroLocation}
            </p>

            {/* Capability strip: the disciplines in play, as a factual summary
                rather than a claim about scale or history. */}
            <ul className="mt-14 grid gap-px overflow-hidden rounded-card border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map((capability) => (
                <li
                  key={capability}
                  className="bg-ink-950 px-5 py-4 text-sm font-medium text-ink-200"
                >
                  {capability}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Departments: the page's primary decision. */}
        <section
          id="gateway-departments"
          aria-labelledby="gateway-departments-heading"
          className="container-page section"
        >
          <div className="max-w-2xl">
            <p className="mono-label text-dept-accent">
              01 — {EN.nav.departments}
            </p>
            <h2
              id="gateway-departments-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
            >
              {EN.departments.heading}
            </h2>
            <p className="mt-4 text-base text-body">{EN.home.gatewayNote}</p>
          </div>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map((department, index) => (
              <DepartmentCard
                key={department.slug}
                department={department}
                locale="en"
                label={departmentLabels[department.slug]}
                summary={
                  EN.departments[DEPARTMENT_LABEL_KEYS[department.slug]].summary
                }
                actionLabel={EN.actions.exploreDepartment}
                index={index + 1}
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

        {/* About and verified company details. */}
        <section
          aria-labelledby="gateway-about-heading"
          className="border-y border-border bg-surface-alt"
        >
          <div className="container-page section grid gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="mono-label text-dept-accent">
                02 — {EN.home.aboutHeading}
              </p>
              <h2
                id="gateway-about-heading"
                className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
              >
                {EN.home.gatewayHeading}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-body">
                {EN.home.aboutBody}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                {FR.home.aboutBody}
              </p>
              <Link
                href="/en/about"
                className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-soft hover:text-dept-accent"
              >
                {EN.home.aboutCta}
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-soft group-hover:translate-x-1"
                />
              </Link>
            </div>

            <aside
              aria-labelledby="gateway-trust-heading"
              className="h-fit rounded-card border border-border bg-surface p-7 shadow-card"
            >
              <h2
                id="gateway-trust-heading"
                className="font-display text-lg font-bold text-ink-900"
              >
                {EN.home.trustHeading}
              </h2>
              <p className="mt-2 text-xs text-muted">{EN.home.trustNote}</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex gap-3">
                  <dt className="visually-hidden">{EN.footer.emailLabel}</dt>
                  <Mail
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
                  />
                  <dd>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
                    >
                      {contact.email}
                    </a>
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="visually-hidden">{EN.footer.phoneLabel}</dt>
                  <Phone
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
                  />
                  <dd className="flex flex-col gap-1">
                    {contact.phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                        className="text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
                      >
                        {phone}
                      </a>
                    ))}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="visually-hidden">{EN.footer.addressLabel}</dt>
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
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

        {/* Language and department entry. */}
        <section
          aria-labelledby="gateway-language-heading"
          className="container-page section"
        >
          <p className="mono-label text-dept-accent">03 — Entry</p>
          <h2
            id="gateway-language-heading"
            className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
          >
            {EN.actions.chooseLanguage} / {FR.actions.chooseLanguage}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-body">
            {EN.home.gatewayNote}
          </p>

          <ul className="mt-8 flex flex-wrap gap-3">
            {LOCALES.map((locale) => (
              <li key={locale}>
                <Link
                  href={`/${locale}`}
                  hrefLang={LOCALE_SEO_TAGS[locale]}
                  className="inline-flex items-center gap-3 rounded-card border border-ink-900 px-6 py-3.5 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-900 hover:text-white"
                >
                  {LOCALE_LABELS[locale]}
                  <span className="mono-label text-muted">
                    {LOCALE_SEO_TAGS[locale]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mt-14 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
            <Building2 aria-hidden="true" className="h-5 w-5 text-dept-accent" />
            {EN.departments.heading}
          </h3>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {DEPARTMENTS.map((department) => (
              <li
                key={department.slug}
                className="card-edge rounded-card border border-border bg-surface p-5 shadow-card"
              >
                <h4 className="font-semibold text-ink-900">
                  {departmentLabels[department.slug]}
                </h4>
                <ul className="mt-3 flex flex-wrap gap-4">
                  {LOCALES.map((locale: Locale) => (
                    <li key={locale}>
                      <Link
                        href={`/${locale}/${department.slug}`}
                        hrefLang={LOCALE_SEO_TAGS[locale]}
                        className="text-sm text-ink-700 underline underline-offset-4 transition-soft hover:text-dept-accent"
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
        className="on-ink border-t border-white/10 bg-ink-950 py-10 text-white"
      >
        <div className="container-page flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            {EN.footer.copyright.replace(
              "{year}",
              String(new Date().getFullYear()),
            )}
          </p>
          <p className="mono-label text-teal-300">{site.motto}</p>
        </div>
      </footer>
    </>
  );
}
