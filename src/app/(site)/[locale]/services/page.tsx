import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Corporate services overview.
 *
 * Deliberately an index rather than a service catalogue. The business brief lists
 * each department's service areas at the department level and does not supply
 * itemised service names, prices or durations, so this page links through to the
 * departments instead of inventing a list. The "detailed descriptions are
 * published by each department" note is honest about that, and is the natural
 * place for the Phase 3 service detail pages to attach.
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
    pathWithoutLocale: "/services",
    title: t("services.metaTitle"),
    description: t("services.metaDescription"),
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.services"), href: `/${resolved}/services` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.services"), path: `/${resolved}/services` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("services.eyebrow")}
          heading={t("services.heading")}
          intro={t("services.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="services-departments-heading">
        <h2
          id="services-departments-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("services.departmentsHeading")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          {t("services.departmentsIntro")}
        </p>

        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li
              key={department.slug}
              {...departmentScopeProps(department.slug)}
              className="h-full"
            >
              <Link
                href={`/${resolved}/${department.slug}`}
                className="card-edge hover-lift group flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-card bg-ink-950 text-white transition-soft group-hover:bg-dept-accent"
                >
                  <DepartmentIcon slug={department.slug} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-ink-900">
                  {t(department.labelKey)}
                </h3>
                <p className="mt-2 flex-1 text-sm text-body">
                  {t(department.descriptionKey)}
                </p>
                <span className="mt-5 text-sm font-semibold text-ink-900 underline underline-offset-4 transition-soft group-hover:text-dept-accent">
                  {t("actions.visitDepartment")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="services-how-heading">
        <h2
          id="services-how-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("services.howHeading")}
        </h2>
        <p className="mt-3 max-w-3xl text-base text-body">
          {t("services.howBody")}
        </p>
      </SectionBand>

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("services.ctaHeading")}
          body={t("services.ctaBody")}
        />
      </div>
    </>
  );
}
