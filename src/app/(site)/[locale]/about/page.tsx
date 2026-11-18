import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { ChairmanMessage } from "@/components/ui/ChairmanMessage";
import { CtaBand } from "@/components/ui/Cta";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { PageHero } from "@/components/ui/PageHero";
import { DEPARTMENTS } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * About the company.
 *
 * Written from the supplied business profile only — the company overview,
 * vision, mission, core values, leadership and headquarters. No founding date,
 * staff count, certifications, client names or project metrics are stated,
 * because none were provided; inventing them would be a credibility and
 * compliance problem.
 *
 * The social row is rendered from `SOCIAL_PROFILES`, the same source the footer
 * and the `Organization` structured data read, so the visible links and the
 * machine-readable `sameAs` cannot drift apart.
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
    { title: t("about.value4Title"), body: t("about.value4Body") },
    { title: t("about.value5Title"), body: t("about.value5Body") },
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

      <PageHero
        eyebrow={t("about.eyebrow")}
        heading={t("about.heading")}
        intro={t("about.intro")}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel={t("a11y.breadcrumb")}
        image="/hero/corporate-v3.jpg"
        meta={[
          {
            term: t("footer.officeHeading"),
            detail: t("about.heroMetaOffice"),
          },
          {
            term: t("nav.departments"),
            detail: t("about.heroMetaDepartments"),
          },
          { term: t("footer.mottoLabel"), detail: site.motto },
        ]}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={`/${resolved}/services`}
            variant="accentOnInk"
            size="lg"
          >
            {t("nav.services")}
          </ButtonLink>
          <ButtonLink
            href={`/${resolved}/contact`}
            variant="secondaryOnInk"
            size="lg"
          >
            {t("actions.contact")}
          </ButtonLink>
        </div>
      </PageHero>

      <SectionBand labelledBy="about-who-heading">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="about-who-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("about.overviewHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.overviewBody1")}
            </p>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.overviewBody2")}
            </p>

            <h2 className="mt-8 text-xl font-semibold text-ink-900">
              {t("about.visionHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.visionBody")}
            </p>

            <h2 className="mt-8 text-xl font-semibold text-ink-900">
              {t("about.missionHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t("about.missionBody")}
            </p>
          </div>

          <aside
            aria-labelledby="about-facts-heading"
            className="rounded-card border border-border bg-surface-alt p-6"
          >
            <h2
              id="about-facts-heading"
              className="text-base font-semibold text-ink-900"
            >
              {t("about.factsHeading")}
            </h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-ink-900">
                  {t("footer.company")}
                </dt>
                <dd className="text-body">{site.legalName}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-900">
                  {t("footer.officeHeading")}
                </dt>
                <dd className="text-body">
                  <address className="not-italic">
                    {site.contact.address.street}, {site.contact.address.city},
                    <br />
                    {site.contact.address.region},{" "}
                    {site.contact.address.country}
                  </address>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-900">
                  {t("footer.phoneLabel")}
                </dt>
                <dd className="flex flex-col text-body">
                  {site.contact.phones.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      className="inline-flex min-h-6 items-center text-ink-700 underline underline-offset-4"
                    >
                      {phone}
                    </a>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-900">
                  {t("footer.emailLabel")}
                </dt>
                <dd>
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="inline-flex min-h-6 items-center text-ink-700 underline underline-offset-4"
                  >
                    {site.contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-900">
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
          className="text-xl font-semibold text-ink-900"
        >
          {t("about.valuesHeading")}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <li
              key={value.title}
              className="rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <h3 className="text-base font-semibold text-ink-900">
                {value.title}
              </h3>
              <p className="mt-2 text-sm text-body">{value.body}</p>
            </li>
          ))}
        </ul>
      </SectionBand>

      {/* Founder's message. The portrait and the letter are the human attribution
          for everything the page states above; the letter itself carries the
          vision, the three pillars and the core values in the founder's words. */}
      <ChairmanMessage
        locale={resolved}
        eyebrow={t("about.leadershipHeading")}
        heading={t("about.chairmanHeading")}
      />

      <SectionBand tone="alt" labelledBy="about-social-heading">
        <h2
          id="about-social-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("about.socialHeading")}
        </h2>
        <p className="mt-3 max-w-2xl text-base text-body">
          {t("about.socialBody")}
        </p>
        <SocialLinks
          t={t}
          tone="light"
          className="mt-6"
          ariaLabel={t("a11y.socialLinks")}
        />
      </SectionBand>

      <SectionBand labelledBy="about-departments-heading">
        <h2
          id="about-departments-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("about.departmentsHeading")}
        </h2>
        <p className="mt-3 max-w-2xl text-base text-body">
          {t("about.departmentsIntro")}
        </p>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li
              key={department.slug}
              {...departmentScopeProps(department.slug)}
            >
              <Link
                href={`/${resolved}/${department.slug}`}
                className="card-edge group flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-control bg-ink-950 text-white transition-soft group-hover:bg-dept-accent"
                >
                  <DepartmentIcon slug={department.slug} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-ink-900">
                  {t(department.labelKey)}
                </h3>
                <p className="mt-2 flex-1 text-sm text-body">
                  {t(department.descriptionKey)}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-soft group-hover:text-dept-accent">
                  {t("actions.visitDepartment")}
                  <ArrowRight
                    aria-hidden="true"
                    className="card-arrow h-4 w-4"
                  />
                </span>
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
