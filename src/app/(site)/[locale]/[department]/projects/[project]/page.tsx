import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/content/RichText";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentHasServices } from "@/lib/content/defaults";
import { loadProject, loadProjects, loadServices } from "@/lib/content/loaders";
import { splitProjectMedia } from "@/lib/content/projects";
import { localizeRegion } from "@/lib/content/types";
import { findRegion } from "@/lib/content/regions";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";
import { projectMediaPublicUrl } from "@/lib/uploads/storage";

/**
 * Project detail page.
 *
 * Renders the before/after pair as a two-column comparison where both images
 * exist, and each image on its own where only one does — a "comparison" with a
 * missing half would imply a change that was not photographed.
 *
 * Alt text comes from the media record, which the database requires. Caption and
 * credit render separately, because they are different claims: a caption
 * describes the image, a credit attributes it.
 *
 * Static params for project detail pages.
 *
 * Slugs are data-driven: a published project is enumerated per locale so its page
 * is prerendered. With nothing published the list is empty and the route renders
 * on demand, which is the correct behaviour — there is no bundled project to
 * pretend otherwise.
 */
export async function generateStaticParams() {
  const params: {
    locale: string;
    department: string;
    project: string;
  }[] = [];

  for (const locale of LOCALES) {
    for (const department of DEPARTMENTS) {
      if (!departmentHasServices(department.slug)) continue;
      const projects = await loadProjects(department.slug, locale);
      for (const project of projects) {
        params.push({ locale, department: department.slug, project: project.slug });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string; project: string }>;
}): Promise<Metadata> {
  const { locale, department, project } = await params;
  if (!isLocale(locale)) return {};

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) return {};

  const current = await loadProject(definition.slug, project, locale);
  if (!current) return {};

  const pathWithoutLocale = `/${department}/projects/${current.slug}`;

  const metadata = buildMetadata({
    locale,
    pathWithoutLocale,
    title: current.seo.title ?? current.title,
    description: current.seo.description ?? current.summary,
    noindex: current.seo.noindex ?? false,
  });

  // An editor-supplied canonical wins where present, matching the service page.
  // Without this the override would be accepted and never rendered.
  if (current.seo.canonicalOverride) {
    return {
      ...metadata,
      alternates: {
        ...metadata.alternates,
        canonical: current.seo.canonicalOverride,
      },
    };
  }

  return metadata;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; department: string; project: string }>;
}) {
  const { locale, department, project } = await params;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const current = await loadProject(definition.slug, project, resolved);
  if (!current) notFound();

  const departmentLabel = t(definition.labelKey);
  const projectsPath = `/${resolved}/${definition.slug}/projects`;
  const projectPath = `${projectsPath}/${current.slug}`;

  const services = await loadServices(definition.slug, resolved);
  const deliveredServices = services.filter((entry) =>
    current.serviceSlugs.includes(entry.slug),
  );

  const { before, after, general } = splitProjectMedia(current);

  const region = current.regionSlug ? findRegion(current.regionSlug) : undefined;
  const regionLabel = region ? localizeRegion(region, resolved).name : undefined;

  const propertyTypeLabel: Record<string, string> = {
    residential: t("projects.propertyTypeResidential"),
    commercial: t("projects.propertyTypeCommercial"),
    industrial: t("projects.propertyTypeIndustrial"),
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: departmentLabel, href: `/${resolved}/${definition.slug}` },
    { name: t("projects.metaTitle"), href: projectsPath },
    { name: current.title, href: projectPath },
  ];

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: departmentLabel, path: `/${resolved}/${definition.slug}` },
          { name: t("projects.metaTitle"), path: projectsPath },
          { name: current.title, path: projectPath },
        ])}
      />

      <section className="on-ink relative overflow-hidden bg-ink-950">
        <div aria-hidden="true" className="absolute inset-0 bg-grid" />
        <div aria-hidden="true" className="absolute inset-0 bg-glow" />
        <div className="relative container-page py-16 sm:py-20">
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={t("a11y.breadcrumb")}
            tone="light"
            className="mb-8"
          />
          <div className="max-w-3xl">
            <p className="mono-label text-dept-accent">
              {t("projects.eyebrow")}
            </p>
            <h1 className="display-tight mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              {current.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {current.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {current.propertyType ? (
                <span className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium text-white">
                  {propertyTypeLabel[current.propertyType] ??
                    current.propertyType}
                </span>
              ) : null}
              {regionLabel ? (
                <span className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium text-white">
                  {regionLabel}
                </span>
              ) : null}
              {current.completedYear ? (
                <span className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium text-white">
                  {t("projects.completedLabel")} {current.completedYear}
                </span>
              ) : null}
            </div>

            <div className="mt-8">
              <ButtonLink
                href={`/${resolved}/${definition.slug}/quote`}
                variant="accentOnInk"
                size="lg"
              >
                {t("projects.requestHeading")}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Before/after comparison, rendered only where the photography exists. */}
      {before && after ? (
        <SectionBand labelledBy="project-comparison-heading">
          <h2
            id="project-comparison-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("projects.comparisonHeading")}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              { item: before, label: t("projects.beforeHeading") },
              { item: after, label: t("projects.afterHeading") },
            ].map(({ item, label }) => {
              const url = projectMediaPublicUrl(item.storagePath);
              return (
                <figure key={label}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-surface-sunken">
                    {url ? (
                      <Image
                        src={url}
                        alt={item.alt}
                        fill
                        // The comparison is the first media block on the page,
                        // so it is above the fold and eager.
                        priority
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center p-4 text-sm text-muted">
                        {item.alt}
                      </p>
                    )}
                  </div>
                  <figcaption className="mt-3 text-sm text-body">
                    <span className="mono-label text-dept-accent">{label}</span>
                    {item.caption ? (
                      <span className="mt-1 block">{item.caption}</span>
                    ) : null}
                    {item.credit ? (
                      <span className="mt-1 block text-xs text-muted">
                        {item.credit}
                      </span>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </SectionBand>
      ) : before || after ? (
        // Only one half of the pair exists. Shown on its own rather than as a
        // comparison, so the page does not imply a change that was not
        // photographed.
        <SectionBand labelledBy="project-single-image-heading">
          <h2
            id="project-single-image-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {before ? t("projects.beforeHeading") : t("projects.afterHeading")}
          </h2>
          {[before ?? after].map((item) => {
            if (!item) return null;
            const url = projectMediaPublicUrl(item.storagePath);
            return (
              <figure key={item.storagePath} className="mt-6 max-w-2xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-surface-sunken">
                  {url ? (
                    <Image
                      src={url}
                      alt={item.alt}
                      fill
                      priority
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center p-4 text-sm text-muted">
                      {item.alt}
                    </p>
                  )}
                </div>
                <figcaption className="mt-3 text-sm text-body">
                  {item.caption ? <span>{item.caption}</span> : null}
                  {item.credit ? (
                    <span className="mt-1 block text-xs text-muted">
                      {item.credit}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </SectionBand>
      ) : null}

      <SectionBand labelledBy="project-detail-heading">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="project-detail-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("projects.scopeHeading")}
            </h2>

            {current.description ? (
              <div className="mt-5">
                <RichText body={current.description} />
              </div>
            ) : null}

            {current.scope ? (
              <div className="mt-8">
                <h3 className="text-base font-semibold text-ink-900">
                  {t("projects.scopeHeading")}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-body">
                  {current.scope}
                </p>
              </div>
            ) : null}

            {current.outcome ? (
              <div className="mt-8">
                <h3 className="text-base font-semibold text-ink-900">
                  {t("projects.outcomeHeading")}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-body">
                  {current.outcome}
                </p>
              </div>
            ) : null}

            {current.hasFallback && resolved !== "en" ? (
              <p className="mt-8 rounded-card border border-border bg-surface p-4 text-xs text-muted">
                {t("projects.translationNotice")}
              </p>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section
              aria-labelledby="project-facts-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="project-facts-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("projects.resultsHeading")}
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {current.location ? (
                  <div>
                    <dt className="font-medium text-ink-900">
                      {t("projects.locationLabel")}
                    </dt>
                    <dd className="text-body">{current.location}</dd>
                  </div>
                ) : null}
                {regionLabel ? (
                  <div>
                    <dt className="font-medium text-ink-900">
                      {t("projects.regionLabel")}
                    </dt>
                    <dd className="text-body">{regionLabel}</dd>
                  </div>
                ) : null}
                {current.propertyType ? (
                  <div>
                    <dt className="font-medium text-ink-900">
                      {t("projects.propertyTypeLabel")}
                    </dt>
                    <dd className="text-body">
                      {propertyTypeLabel[current.propertyType] ??
                        current.propertyType}
                    </dd>
                  </div>
                ) : null}
                {current.completedYear ? (
                  <div>
                    <dt className="font-medium text-ink-900">
                      {t("projects.completedLabel")}
                    </dt>
                    <dd className="text-body">{current.completedYear}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {deliveredServices.length > 0 ? (
              <section
                aria-labelledby="project-services-heading"
                className="rounded-card border border-border bg-surface-alt p-6"
              >
                <h2
                  id="project-services-heading"
                  className="text-base font-semibold text-ink-900"
                >
                  {t("projects.relatedServicesHeading")}
                </h2>
                <ul className="mt-4 space-y-3">
                  {deliveredServices.map((service) => (
                    <li key={service.slug}>
                      <Link
                        href={`/${resolved}/${definition.slug}/services/${service.slug}`}
                        className="text-sm font-medium text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
                      >
                        {service.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="text-sm">
              <Link
                href={projectsPath}
                className="font-semibold text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
              >
                {t("projects.backToProjects")}
              </Link>
            </p>
          </aside>
        </div>
      </SectionBand>

      {/* Remaining general views. Lazy-loaded: they are below the detail text. */}
      {general.length > 0 ? (
        <SectionBand tone="alt" labelledBy="project-gallery-heading">
          <h2
            id="project-gallery-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("projects.galleryHeading")}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {general.map((item) => {
              const url = projectMediaPublicUrl(item.storagePath);
              return (
                <li key={item.storagePath}>
                  <figure>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-surface-sunken">
                      {url ? (
                        <Image
                          src={url}
                          alt={item.alt}
                          fill
                          loading="lazy"
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <p className="flex h-full items-center justify-center p-4 text-sm text-muted">
                          {item.alt}
                        </p>
                      )}
                    </div>
                    {item.caption || item.credit ? (
                      <figcaption className="mt-2 text-sm text-body">
                        {item.caption ? <span>{item.caption}</span> : null}
                        {item.credit ? (
                          <span className="mt-1 block text-xs text-muted">
                            {item.credit}
                          </span>
                        ) : null}
                      </figcaption>
                    ) : null}
                  </figure>
                </li>
              );
            })}
          </ul>
        </SectionBand>
      ) : null}

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("projects.requestHeading")}
          body={t("projects.requestBody")}
          accent
        />
      </div>
    </div>
  );
}
