import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Project gallery.
 *
 * Renders an explicit empty state rather than placeholder tiles. No project
 * photography was supplied with the brief, and stock imagery or invented captions
 * would misrepresent completed work — a credibility risk the brief explicitly
 * rules out. The page therefore states plainly that nothing is published yet and
 * routes the visitor to a department, which is more useful than a broken grid.
 *
 * The empty state is a legitimate production state, not a stub: it will be
 * replaced by real media when the Phase 3 content layer supplies it.
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
    pathWithoutLocale: "/gallery",
    title: t("gallery.metaTitle"),
    description: t("gallery.metaDescription"),
  });
}

export default async function GalleryPage({
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
    { name: t("nav.gallery"), href: `/${resolved}/gallery` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.gallery"), path: `/${resolved}/gallery` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("gallery.eyebrow")}
          heading={t("gallery.heading")}
          intro={t("gallery.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="gallery-empty-heading">
        <div className="max-w-2xl rounded-card border border-border bg-surface-alt p-8">
          <h2
            id="gallery-empty-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {t("gallery.emptyHeading")}
          </h2>
          <p className="mt-3 text-base text-body">{t("gallery.emptyBody")}</p>
        </div>

        <h3 className="mono-label mt-10 text-muted">
          {t("gallery.browseDepartments")}
        </h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li key={department.slug} {...departmentScopeProps(department.slug)}>
              <Link
                href={`/${resolved}/${department.slug}`}
                className="card-edge block rounded-card border border-border bg-surface p-5 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
              >
                <span className="block text-sm font-semibold text-ink-900">
                  {t(department.labelKey)}
                </span>
                <span className="mt-1 block text-sm text-body">
                  {t(department.descriptionKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionBand>
    </>
  );
}
