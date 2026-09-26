import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SectionBand } from "@/components/layout/PageShell";
import { CtaBand } from "@/components/ui/Cta";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS, SITE } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { isLocale, LOCALE_SEO_TAGS, type Locale } from "@/lib/i18n/locales";
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

  return (
    <>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript data={websiteJsonLd(resolved)} />

      <SectionBand tone="accent">
        <PageIntro
          eyebrow={t("home.heroEyebrow")}
          heading={t("home.gatewayHeading")}
          intro={t("home.gatewayIntro")}
        />
        <p className="mt-4 text-sm text-muted">{t("home.heroLocation")}</p>
      </SectionBand>

      <SectionBand labelledBy="departments-heading">
        <h2
          id="departments-heading"
          className="text-2xl font-semibold text-navy-900"
        >
          {t("departments.heading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-body">
          {t("departments.intro")}
        </p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <DepartmentCard
              key={department.slug}
              department={department}
              locale={resolved}
              label={t(department.labelKey)}
              summary={t(department.summaryKey)}
              actionLabel={t("actions.exploreDepartment")}
            />
          ))}
        </ul>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="home-about-heading">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="home-about-heading"
              className="text-2xl font-semibold text-navy-900"
            >
              {t("home.aboutHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("home.aboutBody")}
            </p>
            <Link
              href={`/${resolved}/about`}
              className="mt-5 inline-block text-sm font-semibold text-navy-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
            >
              {t("home.aboutCta")}
            </Link>
          </div>

          <aside
            aria-labelledby="home-trust-heading"
            className="rounded-card border border-border bg-surface p-6 shadow-card"
          >
            <h2
              id="home-trust-heading"
              className="text-base font-semibold text-navy-900"
            >
              {t("home.trustHeading")}
            </h2>
            <p className="mt-1 text-xs text-muted">{t("home.trustNote")}</p>
            <address className="mt-4 space-y-1 text-sm not-italic text-body">
              <p>{site.legalName}</p>
              <p>
                {site.contact.address.street}, {site.contact.address.city}
              </p>
              <p>
                {site.contact.address.region}, {site.contact.address.country}
              </p>
              <p>
                <a
                  href={`mailto:${site.contact.email}`}
                  className="text-navy-700 underline underline-offset-4"
                >
                  {site.contact.email}
                </a>
              </p>
              <p>
                <a
                  href={`tel:${site.contact.phones[0]?.replace(/[^+\d]/g, "")}`}
                  className="text-navy-700 underline underline-offset-4"
                >
                  {site.contact.phones[0]}
                </a>
              </p>
            </address>
            <p className="mt-4 text-xs text-muted">{SITE.motto}</p>
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
        <p className="mt-6 text-xs text-muted">
          {LOCALE_SEO_TAGS[resolved]}
        </p>
      </div>
    </>
  );
}
