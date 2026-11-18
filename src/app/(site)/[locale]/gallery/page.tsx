import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Camera } from "lucide-react";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { PageHero } from "@/components/ui/PageHero";
import { corporatePageHero, DEPARTMENTS } from "@/lib/config/site";
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
  const hero = corporatePageHero("gallery");

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

      <PageHero
        eyebrow={t("gallery.eyebrow")}
        heading={t("gallery.heading")}
        intro={t("gallery.intro")}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel={t("a11y.breadcrumb")}
        image={hero?.image}
        credit={hero?.credit}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={`/${resolved}/contact`}
            variant="accentOnInk"
            size="lg"
          >
            {t("actions.contact")}
          </ButtonLink>
          <ButtonLink
            href={`/${resolved}/services`}
            variant="secondaryOnInk"
            size="lg"
          >
            {t("nav.services")}
          </ButtonLink>
        </div>
      </PageHero>

      <SectionBand labelledBy="gallery-empty-heading">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
          <div>
            <h2
              id="gallery-empty-heading"
              className="font-display text-2xl font-bold text-ink-900"
            >
              {t("gallery.emptyHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-body">
              {t("gallery.emptyBody")}
            </p>
          </div>

          {/* The publication rule, stated as a rule rather than as prose. It is the
              reason the page is empty, and a reader who understands it does not
              read the emptiness as a broken page. */}
          <aside
            aria-labelledby="gallery-rule-heading"
            className="rounded-card border border-border bg-surface-alt p-6"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-control bg-ink-950 text-white"
            >
              <Camera className="h-5 w-5" />
            </span>
            <h2
              id="gallery-rule-heading"
              className="mt-4 text-base font-semibold text-ink-900"
            >
              {t("gallery.ruleHeading")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-body">
              {[
                t("gallery.ruleItem1"),
                t("gallery.ruleItem2"),
                t("gallery.ruleItem3"),
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-dept-accent">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <h3 className="mono-label mt-14 text-muted">
          {t("gallery.browseDepartments")}
        </h3>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li
              key={department.slug}
              {...departmentScopeProps(department.slug)}
            >
              <Link
                href={`/${resolved}/${department.slug}`}
                className="card-edge group flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-control bg-ink-950 text-white transition-soft group-hover:bg-dept-accent"
                >
                  <DepartmentIcon slug={department.slug} className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-ink-900">
                  {t(department.labelKey)}
                </span>
                <span className="mt-1 flex-1 block text-sm text-body">
                  {t(department.descriptionKey)}
                </span>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-soft group-hover:text-dept-accent">
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
    </>
  );
}
