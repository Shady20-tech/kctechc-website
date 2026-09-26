import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SectionBand } from "@/components/layout/PageShell";
import { CtaBand } from "@/components/ui/Cta";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { DEPARTMENTS, SITE } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";

/**
 * Localized home page, e.g. `/en` or `/fr`.
 *
 * This is the localized entry point: language is already settled, so the page
 * leads with the corporate proposition and the three departments at equal
 * weight. Department selection is the next decision, not language.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: "/",
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
  });
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const site = await getSiteContent();
  const { contact } = site;

  return (
    <>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript data={websiteJsonLd(resolved)} />

      {/* Hero. The dark ink band is what gives the localized home the same
          corporate weight as the gateway, instead of a pale page header. */}
      <section className="on-ink relative overflow-hidden bg-ink-950">
        <div aria-hidden="true" className="absolute inset-0 bg-grid" />
        <div aria-hidden="true" className="absolute inset-0 bg-glow" />
        <div className="relative container-page py-20 sm:py-24 lg:py-28">
          <p className="reveal mono-label text-teal-300">
            {t("home.heroEyebrow")}
          </p>
          <h1
            className="reveal display-tight mt-6 max-w-4xl font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl"
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            {t("home.gatewayHeading")}
          </h1>
          <p
            className="reveal mt-7 max-w-2xl text-base leading-relaxed text-ink-200 sm:text-lg"
            style={{ "--reveal-delay": "140ms" } as React.CSSProperties}
          >
            {t("home.gatewayIntro")}
          </p>
          <p
            className="reveal mt-8 flex items-center gap-2 text-sm text-ink-300"
            style={{ "--reveal-delay": "200ms" } as React.CSSProperties}
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
            {t("home.heroLocation")}
          </p>
          <div
            className="reveal mt-9 flex flex-wrap gap-3"
            style={{ "--reveal-delay": "240ms" } as React.CSSProperties}
          >
            <Link
              href={`/${resolved}/contact`}
              className="inline-flex items-center gap-2 rounded-card bg-teal-500 px-6 py-3.5 text-base font-semibold text-ink-950 transition-soft hover:bg-teal-400"
            >
              {t("actions.getQuote")}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              href={`/${resolved}/about`}
              className="inline-flex items-center gap-2 rounded-card border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition-soft hover:bg-white/10"
            >
              {t("nav.about")}
            </Link>
          </div>
        </div>
      </section>

      <SectionBand labelledBy="departments-heading">
        <div className="max-w-2xl">
          <p className="mono-label text-dept-accent">
            01 — {t("nav.departments")}
          </p>
          <h2
            id="departments-heading"
            className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
          >
            {t("departments.heading")}
          </h2>
          <p className="mt-4 text-base text-body">{t("departments.intro")}</p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department, index) => (
            <DepartmentCard
              key={department.slug}
              department={department}
              locale={resolved}
              label={t(department.labelKey)}
              summary={t(department.summaryKey)}
              actionLabel={t("actions.exploreDepartment")}
              index={index + 1}
            />
          ))}
        </ul>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="home-about-heading">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mono-label text-dept-accent">
              02 — {t("home.aboutHeading")}
            </p>
            <h2
              id="home-about-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
            >
              {t("home.statementHeading")}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-body">
              {t("home.aboutBody")}
            </p>
            <Link
              href={`/${resolved}/about`}
              className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-soft hover:text-dept-accent"
            >
              {t("home.aboutCta")}
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-soft group-hover:translate-x-1"
              />
            </Link>
          </div>

          <aside
            aria-labelledby="home-trust-heading"
            className="h-fit rounded-card border border-border bg-surface p-7 shadow-card"
          >
            <h2
              id="home-trust-heading"
              className="font-display text-lg font-bold text-ink-900"
            >
              {t("home.trustHeading")}
            </h2>
            <p className="mt-2 text-xs text-muted">{t("home.trustNote")}</p>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex gap-3">
                <dt className="visually-hidden">{t("footer.emailLabel")}</dt>
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
                <dt className="visually-hidden">{t("footer.phoneLabel")}</dt>
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
                <dt className="visually-hidden">{t("footer.addressLabel")}</dt>
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
            <p className="mono-label mt-6 text-muted">{SITE.motto}</p>
          </aside>
        </div>
      </SectionBand>

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("about.ctaHeading")}
          body={t("about.ctaBody")}
        />
      </div>
    </>
  );
}
