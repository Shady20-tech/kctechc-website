import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { INSIGHTS_PATH } from "@/lib/config/navigation";
import { allCategories, localizeCategory } from "@/lib/content/defaults";
import { formatDate } from "@/lib/content/format";
import { loadInsights } from "@/lib/content/loaders";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * Insights category archive.
 *
 * Categories are real (the three department subject areas) even when no article
 * has been published in one yet, so an empty category renders its own empty state
 * rather than a 404. That distinction matters: the category exists and is linked
 * from the index, so sending a reader to a not-found page would be wrong.
 *
 * The category is validated against the known set, so an arbitrary path segment
 * cannot produce an indexable page for a category that does not exist.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    allCategories().map((category) => ({
      locale,
      category: category.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isLocale(locale)) return {};

  const definition = allCategories().find((entry) => entry.slug === category);
  if (!definition) return {};

  const t = createTranslator(locale).t;
  const localized = localizeCategory(definition, locale);

  return buildMetadata({
    locale,
    pathWithoutLocale: `${INSIGHTS_PATH}/category/${category}`,
    title: t("insights.categoryHeading", { category: localized.name }),
    description: t("insights.metaDescription"),
  });
}

export default async function InsightCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  if (!isLocale(locale)) notFound();

  const definition = allCategories().find((entry) => entry.slug === category);
  if (!definition) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const localized = localizeCategory(definition, resolved);

  const articles = (await loadInsights(resolved)).filter(
    (article) => article.categorySlug === category,
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.insights"), href: `/${resolved}${INSIGHTS_PATH}` },
    {
      name: localized.name,
      href: `/${resolved}${INSIGHTS_PATH}/category/${category}`,
    },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.insights"), path: `/${resolved}${INSIGHTS_PATH}` },
          {
            name: localized.name,
            path: `/${resolved}${INSIGHTS_PATH}/category/${category}`,
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
          eyebrow={t("insights.eyebrow")}
          heading={t("insights.categoryHeading", {
            category: localized.name,
          })}
          intro={localized.description ?? t("insights.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="category-articles-heading">
        <h2 id="category-articles-heading" className="visually-hidden">
          {t("insights.categoriesHeading")}
        </h2>

        {articles.length === 0 ? (
          <div className="max-w-2xl rounded-card border border-border bg-surface-alt p-8">
            <p className="text-base text-body">
              {t("insights.emptyCategory")}
            </p>
            <div className="mt-6">
              <ButtonLink
                href={`/${resolved}${INSIGHTS_PATH}`}
                variant="accent"
              >
                {t("insights.backToInsights")}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug} className="h-full">
                <article className="flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card">
                  <h3 className="text-base font-semibold text-ink-900">
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
        )}
      </SectionBand>
    </>
  );
}
