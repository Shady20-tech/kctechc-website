import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { CtaBand } from "@/components/ui/Cta";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import {
  allCaseStudyRecords,
  departmentHasServices,
  localizeCaseStudy,
} from "@/lib/content/defaults";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department portfolio.
 *
 * There are no case studies in the business brief, so this page renders an
 * honest empty state rather than sample work. Fabricating a client or a result
 * here would be the single most damaging thing this surface could do — it would
 * be a false claim about a named third party, published on a production path.
 *
 * The filtering and results structures are built and typed even though nothing is
 * published yet, so an editor who adds a case study with client approval sees it
 * appear with no further code change. The database enforces that approval
 * (`case_studies_publish_requires_client_approval`), which is what makes that
 * claim safe to make here.
 *
 * Only departments whose content is published have this surface.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    DEPARTMENTS.filter((department) =>
      departmentHasServices(department.slug),
    ).map((department) => ({ locale, department: department.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) return {};

  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `/${department}/portfolio`,
    title: t("portfolio.metaTitle"),
    description: t("portfolio.metaDescription"),
  });
}

export default async function DepartmentPortfolioPage({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const caseStudies = allCaseStudyRecords()
    .filter((entry) => entry.department === definition.slug)
    .map((entry) => localizeCaseStudy(entry, resolved));

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t(definition.labelKey), href: `/${resolved}/${definition.slug}` },
    {
      name: t("portfolio.metaTitle"),
      href: `/${resolved}/${definition.slug}/portfolio`,
    },
  ];

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t(definition.labelKey), path: `/${resolved}/${definition.slug}` },
          {
            name: t("portfolio.metaTitle"),
            path: `/${resolved}/${definition.slug}/portfolio`,
          },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("portfolio.eyebrow")}
          heading={t("portfolio.heading")}
          intro={t("portfolio.intro")}
        />
      </SectionBand>

      {caseStudies.length === 0 ? (
        <SectionBand labelledBy="portfolio-empty-heading">
          <div className="max-w-2xl">
            <h2
              id="portfolio-empty-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("portfolio.emptyHeading")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-body">
              {t("portfolio.emptyBody")}
            </p>
            <div className="mt-6">
              <ButtonLink
                href={`/${resolved}/contact?department=${definition.slug}`}
                variant="accent"
              >
                {t("portfolio.emptyCta")}
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm">
              <Link
                href={`/${resolved}/${definition.slug}/services`}
                className="font-semibold text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
              >
                {t("service.backToServices")}
              </Link>
            </p>
          </div>
        </SectionBand>
      ) : (
        <SectionBand labelledBy="portfolio-list-heading">
          <h2 id="portfolio-list-heading" className="visually-hidden">
            {t("portfolio.heading")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2">
            {caseStudies.map((study) => (
              <li key={study.slug} className="h-full">
                <article className="flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card">
                  <h3 className="text-base font-semibold text-ink-900">
                    <Link
                      href={`/${resolved}/${definition.slug}/portfolio/${study.slug}`}
                      className="transition-soft hover:text-dept-accent"
                    >
                      {study.title}
                    </Link>
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-body">
                    {study.summary}
                  </p>
                  {study.clientName ? (
                    <p className="mt-4 text-xs text-muted">
                      {t("portfolio.clientLabel")}: {study.clientName}
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-muted">
                      {t("portfolio.confidentialClient")}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        </SectionBand>
      )}

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("dm.ctaHeading")}
          body={t("dm.ctaBody")}
          accent
        />
      </div>
    </div>
  );
}
