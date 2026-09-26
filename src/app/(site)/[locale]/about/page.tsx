import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/structured-data";

/**
 * About the company.
 *
 * Written from the supplied business facts only — headquarters, the three
 * departments, and the national scope of real estate. No founding date, staff
 * count, certifications or client names are stated, because none were provided;
 * inventing them would be a credibility and compliance problem.
 *
 * Contact details come from editable settings, so they cannot drift from the
 * footer.
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
  return buildMetadata({
    locale,
    pathWithoutLocale: "/about",
    title: t("about.metaTitle"),
    description: t("about.metaDescription"),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const site = await getSiteContent();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.about"), href: `/${resolved}/about` },
  ];

  const values = [
    { title: t("about.value1Title"), body: t("about.value1Body") },
    { title: t("about.value2Title"), body: t("about.value2Body") },
    { title: t("about.value3Title"), body: t("about.value3Body") },
  ];

  return (
    <>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.about"), path: `/${resolved}/about` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("about.eyebrow")}
          heading={t("about.heading")}
          intro={t("about.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="about-who-heading">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="about-who-heading"
              className="text-xl font-semibold text-navy-900"
            >
              {t("about.whoHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.whoBody")}
            </p>

            <h2 className="mt-8 text-xl font-semibold text-navy-900">
              {t("about.whereHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.whereBody")}
            </p>

            <h2 className="mt-8 text-xl font-semibold text-navy-900">
              {t("about.howHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.howBody")}
            </p>
          </div>

          <aside
            aria-labelledby="about-facts-heading"
            className="rounded-card border border-border bg-surface-alt p-6"
          >
            <h2
              id="about-facts-heading"
              className="text-base font-semibold text-navy-900"
            >
              {t("about.factsHeading")}
            </h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-navy-900">
                  {t("footer.company")}
                </dt>
                <dd className="text-body">{site.legalName}</dd>
              </div>
              <div>
                <dt className="font-medium text-navy-900">
                  {t("footer.officeHeading")}
                </dt>
                <dd className="text-body">
                  <address className="not-italic">
                    {site.contact.address.street}, {site.contact.address.city},
                    <br />
                    {site.contact.address.region}, {site.contact.address.country}
                  </address>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-navy-900">
                  {t("footer.phoneLabel")}
                </dt>
                <dd className="flex flex-col text-body">
                  {site.contact.phones.map((phone) => (
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
              <div>
                <dt className="font-medium text-navy-900">
                  {t("footer.emailLabel")}
                </dt>
                <dd>
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="text-navy-700 underline underline-offset-4"
                  >
                    {site.contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-navy-900">
                  {t("footer.mottoLabel")}
                </dt>
                <dd className="text-body">{site.motto}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="about-values-heading">
        <h2
          id="about-values-heading"
          className="text-xl font-semibold text-navy-900"
        >
          {t("about.valuesHeading")}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <li
              key={value.title}
              className="rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <h3 className="text-base font-semibold text-navy-900">
                {value.title}
              </h3>
              <p className="mt-2 text-sm text-body">{value.body}</p>
            </li>
          ))}
        </ul>
      </SectionBand>

      <SectionBand labelledBy="about-departments-heading">
        <h2
          id="about-departments-heading"
          className="text-xl font-semibold text-navy-900"
        >
          {t("about.departmentsHeading")}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li
              key={department.slug}
              className="rounded-card border border-border bg-surface p-6 shadow-card"
              style={{
                borderTopColor: department.accent,
                borderTopWidth: "4px",
              }}
            >
              <h3 className="text-base font-semibold text-navy-900">
                {t(department.labelKey)}
              </h3>
              <p className="mt-2 text-sm text-body">
                {t(department.descriptionKey)}
              </p>
              <Link
                href={`/${resolved}/${department.slug}`}
                className="mt-4 inline-block text-sm font-semibold text-navy-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
              >
                {t("actions.visitDepartment")}
              </Link>
            </li>
          ))}
        </ul>
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
