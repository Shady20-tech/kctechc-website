import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentCopyPrefix } from "@/lib/content/department-copy";
import { departmentHasServices } from "@/lib/content/defaults";
import { loadProjects, loadServices } from "@/lib/content/loaders";
import {
  filterProjects,
  isUnfiltered,
  projectPropertyTypeFilterValues,
  projectRegionFilterValues,
  projectServiceFilterValues,
} from "@/lib/content/projects";
import { REGIONS, regionsHomeFirst } from "@/lib/content/regions";
import { PROPERTY_TYPES, localizeRegion } from "@/lib/content/types";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";
import { projectMediaPublicUrl } from "@/lib/uploads/storage";

/**
 * Electrical project gallery.
 *
 * Filterable by service area, region and property type, where the data supports
 * it: the filter controls are derived from the projects that actually exist, so
 * an option that would return nothing is never offered. A filter that produces an
 * empty result reads as a broken page, which is worse than not showing it.
 *
 * The unfiltered gallery is the canonical URL. A filtered view is a navigational
 * state rather than a separate page, so it is `noindex` — otherwise every filter
 * permutation would compete with the gallery itself in the index, which is the
 * duplicate-content concern that also governs locale routing.
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
  searchParams,
}: {
  params: Promise<{ locale: string; department: string }>;
  searchParams: Promise<{
    service?: string;
    region?: string;
    propertyType?: string;
  }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) return {};

  const { service, region, propertyType } = await searchParams;
  const t = createTranslator(locale).t;

  return buildMetadata({
    locale,
    pathWithoutLocale: `/${department}/projects`,
    title: t("projects.metaTitle"),
    description: t("projects.metaDescription"),
    // A filtered view is a navigational state, not a page in its own right.
    noindex: !isUnfiltered({ service, region, propertyType }),
  });
}

export default async function DepartmentProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string }>;
  searchParams: Promise<{
    service?: string;
    region?: string;
    propertyType?: string;
  }>;
}) {
  const { locale, department } = await params;
  const { service, region, propertyType } = await searchParams;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const copy = departmentCopyPrefix(definition.slug) ?? "dm";
  const departmentLabel = t(definition.labelKey);

  const [allProjects, services] = await Promise.all([
    loadProjects(definition.slug, resolved),
    loadServices(definition.slug, resolved),
  ]);

  const filters = { service, region, propertyType };
  const filtered = filterProjects(allProjects, filters);

  // Filter options come from the published projects, so an option that cannot
  // return anything is not offered.
  const serviceFilterValues = projectServiceFilterValues(
    allProjects,
    services.map((entry) => entry.slug),
  );
  const regionFilterValues = projectRegionFilterValues(
    allProjects,
    REGIONS.map((entry) => entry.slug),
  );
  const propertyTypeFilterValues = projectPropertyTypeFilterValues(
    allProjects,
    PROPERTY_TYPES,
  );

  const serviceLabelBySlug = new Map(
    services.map((entry) => [entry.slug, entry.title]),
  );
  const regionLabelBySlug = new Map(
    regionsHomeFirst().map((entry) => [
      entry.slug,
      localizeRegion(entry, resolved).name,
    ]),
  );
  const propertyTypeLabel: Record<string, string> = {
    residential: t("projects.propertyTypeResidential"),
    commercial: t("projects.propertyTypeCommercial"),
    industrial: t("projects.propertyTypeIndustrial"),
  };

  const hasFilters =
    serviceFilterValues.length > 0 ||
    regionFilterValues.length > 0 ||
    propertyTypeFilterValues.length > 0;

  const projectsPath = `/${resolved}/${definition.slug}/projects`;

  const listJsonLd = itemListJsonLd({
    name: t("projects.metaTitle"),
    path: projectsPath,
    items: allProjects.map((project) => ({
      name: project.title,
      path: `${projectsPath}/${project.slug}`,
    })),
  });

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: departmentLabel, href: `/${resolved}/${definition.slug}` },
    { name: t("projects.metaTitle"), href: projectsPath },
  ];

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: departmentLabel, path: `/${resolved}/${definition.slug}` },
          { name: t("projects.metaTitle"), path: projectsPath },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("projects.eyebrow")}
          heading={t("projects.heading")}
          intro={t("projects.intro")}
        />
      </SectionBand>

      {allProjects.length === 0 ? (
        <SectionBand labelledBy="projects-empty-heading">
          <div className="max-w-2xl">
            <h2
              id="projects-empty-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("projects.emptyHeading")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-body">
              {t("projects.emptyBody")}
            </p>
            <div className="mt-6">
              <ButtonLink
                href={`/${resolved}/${definition.slug}/quote`}
                variant="accent"
              >
                {t("projects.emptyCta")}
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
        <>
          {hasFilters ? (
            <SectionBand labelledBy="projects-filter-heading">
              <h2 id="projects-filter-heading" className="visually-hidden">
                {t("projects.filterServiceLabel")}
              </h2>
              {/* A GET form, so the filters work without JavaScript and the
                  state lives entirely in the URL. That is also what keeps one
                  filter state to one address. */}
              <form
                method="get"
                action={projectsPath}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div>
                  <label
                    htmlFor="filter-service"
                    className="block text-sm font-medium text-ink-900"
                  >
                    {t("projects.filterServiceLabel")}
                  </label>
                  <select
                    id="filter-service"
                    name="service"
                    defaultValue={service ?? ""}
                    className="mt-1.5 w-full rounded-card border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                  >
                    <option value="">{t("projects.filterAll")}</option>
                    {serviceFilterValues.map((slug) => (
                      <option key={slug} value={slug}>
                        {serviceLabelBySlug.get(slug) ?? slug}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-region"
                    className="block text-sm font-medium text-ink-900"
                  >
                    {t("projects.filterRegionLabel")}
                  </label>
                  <select
                    id="filter-region"
                    name="region"
                    defaultValue={region ?? ""}
                    className="mt-1.5 w-full rounded-card border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                  >
                    <option value="">{t("projects.filterAll")}</option>
                    {regionFilterValues.map((slug) => (
                      <option key={slug} value={slug}>
                        {regionLabelBySlug.get(slug) ?? slug}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-property-type"
                    className="block text-sm font-medium text-ink-900"
                  >
                    {t("projects.filterPropertyTypeLabel")}
                  </label>
                  <select
                    id="filter-property-type"
                    name="propertyType"
                    defaultValue={propertyType ?? ""}
                    className="mt-1.5 w-full rounded-card border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                  >
                    <option value="">{t("projects.filterAll")}</option>
                    {propertyTypeFilterValues.map((value) => (
                      <option key={value} value={value}>
                        {propertyTypeLabel[value] ?? value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-card bg-dept-accent px-4 py-2.5 text-sm font-semibold text-white transition-soft hover:opacity-90"
                  >
                    {t("projects.filterApply")}
                  </button>
                  {!isUnfiltered(filters) ? (
                    <Link
                      href={projectsPath}
                      className="text-sm font-semibold text-ink-900 underline underline-offset-4"
                    >
                      {t("projects.clearFilters")}
                    </Link>
                  ) : null}
                </div>
              </form>
            </SectionBand>
          ) : null}

          <SectionBand labelledBy="projects-results-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                id="projects-results-heading"
                className="text-xl font-semibold text-ink-900"
              >
                {t("projects.resultsHeading")}
              </h2>
              <p className="text-sm text-muted">
                {filtered.length === 1
                  ? t("projects.resultsCountOne")
                  : t("projects.resultsCount", { count: filtered.length })}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="mt-6 max-w-2xl">
                <h3 className="text-base font-semibold text-ink-900">
                  {t("projects.noResultsHeading")}
                </h3>
                <p className="mt-2 text-sm text-body">
                  {t("projects.noResultsBody")}
                </p>
                <p className="mt-4">
                  <Link
                    href={projectsPath}
                    className="text-sm font-semibold text-ink-900 underline underline-offset-4"
                  >
                    {t("projects.clearFilters")}
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((project) => {
                  // The card image is the project's first general view, or its
                  // "after" image when that is all there is. A project with no
                  // media renders without an image rather than with a placeholder
                  // that would imply photography exists.
                  const cardMedia =
                    project.media.find((item) => item.role === "general") ??
                    project.media.find((item) => item.role === "after") ??
                    project.media[0];
                  const imageUrl = cardMedia
                    ? projectMediaPublicUrl(cardMedia.storagePath)
                    : null;

                  return (
                    <li key={project.slug} className="h-full">
                      <Link
                        href={`${projectsPath}/${project.slug}`}
                        className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
                      >
                        {imageUrl && cardMedia ? (
                          <span className="relative block aspect-[4/3] overflow-hidden bg-surface-sunken">
                            <Image
                              src={imageUrl}
                              alt={cardMedia.alt}
                              fill
                              // Below the fold on the gallery, so lazy by
                              // default: the browser loads it as it scrolls in.
                              loading="lazy"
                              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover transition-soft group-hover:scale-[1.02]"
                            />
                          </span>
                        ) : null}

                        <span className="flex flex-1 flex-col p-5">
                          <span className="text-base font-semibold text-ink-900 transition-soft group-hover:text-dept-accent">
                            {project.title}
                          </span>
                          <span className="mt-2 flex-1 text-sm text-body">
                            {project.summary}
                          </span>

                          <span className="mt-4 flex flex-wrap gap-2">
                            {project.propertyType ? (
                              <Badge tone="accent">
                                {propertyTypeLabel[project.propertyType] ??
                                  project.propertyType}
                              </Badge>
                            ) : null}
                            {project.regionSlug ? (
                              <Badge tone="neutral">
                                {regionLabelBySlug.get(project.regionSlug) ??
                                  project.regionSlug}
                              </Badge>
                            ) : null}
                          </span>

                          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 underline underline-offset-4">
                            {t("actions.learnMore")}
                            <ArrowRight
                              aria-hidden="true"
                              className="h-4 w-4 transition-soft group-hover:translate-x-1"
                            />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionBand>
        </>
      )}

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t(`${copy}.ctaHeading`)}
          body={t(`${copy}.ctaBody`)}
          accent
        />
      </div>
    </div>
  );
}
