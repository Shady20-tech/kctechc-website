import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { DEPARTMENTS } from "@/lib/config/site";
import { allCategories, localizeCategory } from "@/lib/content/defaults";
import { loadInsights } from "@/lib/content/loaders";
import { INSIGHTS_PATH } from "@/lib/config/navigation";
import { formatDate } from "@/lib/content/format";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Insights index.
 *
 * Renders published articles, or an honest empty state when there are none. The
 * business brief contains no articles, so nothing is invented to fill the page:
 * the previous `/blog` route already took this position and the reasoning still
 * holds — a placeholder post under the company name would be a false claim.
 *
 * Category links are shown even while the list is empty, because the categories
 * are real (the three department subject areas) and a reader arriving on an empty
 * index benefits from knowing what will appear here.
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
    pathWithoutLocale: INSIGHTS_PATH,
    title: t("insights.metaTitle"),
    description: t("insights.metaDescription"),
  });
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const articles = await loadInsights(resolved);
  const categories = allCategories().map((category) =>
    localizeCategory(category, resolved),
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.insights"), href: `/${resolved}${INSIGHTS_PATH}` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.insights"), path: `/${resolved}${INSIGHTS_PATH}` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("insights.eyebrow")}
          heading={t("insights.heading")}
          intro={t("insights.intro")}
        />
      </SectionBand>

      {articles.length === 0 ? (
        <SectionBand labelledBy="insights-empty-heading">
          <div className="max-w-2xl rounded-card border border-border bg-surface-alt p-8">
            <h2
              id="insights-empty-heading"
              className="text-lg font-semibold text-ink-900"
            >
              {t("insights.emptyHeading")}
            </h2>
            <p className="mt-3 text-base text-body">{t("insights.emptyBody")}</p>
            <div className="mt-6">
              <ButtonLink href={`/${resolved}/services`} variant="accent">
                {t("insights.emptyCta")}
              </ButtonLink>
            </div>
          </div>

          <h2 className="mono-label mt-10 text-muted">
            {t("insights.categoriesHeading")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/${resolved}${INSIGHTS_PATH}/category/${category.slug}`}
                  className="inline-flex rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-900 transition-soft hover:border-border-strong"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </SectionBand>
      ) : (
        <SectionBand labelledBy="insights-list-heading">
          <h2 id="insights-list-heading" className="visually-hidden">
            {t("insights.heading")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug} className="h-full">
                <article className="flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card">
                  {article.categorySlug ? (
                    <p className="mono-label text-dept-accent">
                      {
                        categories.find(
                          (category) => category.slug === article.categorySlug,
                        )?.name
                      }
                    </p>
                  ) : null}
                  <h3 className="mt-2 text-base font-semibold text-ink-900">
                    <Link
                      href={`/${resolved}${INSIGHTS_PATH}/${article.slug}`}
                      className="transition-soft hover:text-dept-accent"
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-body">
                    {article.summary}
                  </p>
                  <p className="mt-4 text-xs text-muted">
                    {t("insights.publishedOn", {
                      date: formatDate(article.publishedAt, resolved),
                    })}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </SectionBand>
      )}

      <SectionBand tone="alt" labelledBy="insights-departments-heading">
        <h2
          id="insights-departments-heading"
          className="mono-label text-muted"
        >
          {t("gallery.browseDepartments")}
        </h2>
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
