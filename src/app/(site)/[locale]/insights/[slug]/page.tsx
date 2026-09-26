import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/content/RichText";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { INSIGHTS_PATH } from "@/lib/config/navigation";
import { allCategories, findAuthor, localizeCategory } from "@/lib/content/defaults";
import { formatDate } from "@/lib/content/format";
import { loadInsight, loadServices } from "@/lib/content/loaders";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Insight article page.
 *
 * The byline is required, not optional: the database refuses to publish an
 * article without an author, so an article reaching this page always has one.
 * That is what makes the `Article` structured data honest — it names a real
 * person rather than attributing the piece to the organization by default.
 *
 * An article with no author found (for example an author deactivated after
 * publication) falls back to the organization's name rather than rendering an
 * empty byline or failing the page.
 */
export function generateStaticParams() {
  // Articles are loaded from the database at request time, so no slugs are
  // enumerated here; the route renders on demand and is still cached by Next.js.
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const article = await loadInsight(slug, locale);
  if (!article) return {};

  return buildMetadata({
    locale,
    pathWithoutLocale: `${INSIGHTS_PATH}/${slug}`,
    title: article.seo.title ?? article.title,
    description: article.seo.description ?? article.summary,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    noindex: article.seo.noindex ?? false,
  });
}

export default async function InsightArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const article = await loadInsight(slug, resolved);
  if (!article) notFound();

  const author = article.authorSlug ? findAuthor(article.authorSlug) : undefined;
  const authorName = author?.displayName ?? t("common.brand");
  const articlePath = `/${resolved}${INSIGHTS_PATH}/${article.slug}`;

  const category = article.categorySlug
    ? allCategories()
        .map((entry) => localizeCategory(entry, resolved))
        .find((entry) => entry.slug === article.categorySlug)
    : undefined;

  const relatedServices = article.department
    ? (await loadServices(article.department, resolved)).filter((service) =>
        article.relatedServiceSlugs.includes(service.slug),
      )
    : [];

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.insights"), href: `/${resolved}${INSIGHTS_PATH}` },
    { name: article.title, href: articlePath },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.insights"), path: `/${resolved}${INSIGHTS_PATH}` },
          { name: article.title, path: articlePath },
        ])}
      />
      <JsonLdScript
        data={articleJsonLd({
          headline: article.title,
          description: article.summary,
          path: articlePath,
          locale: resolved,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          authorName,
          imagePath: article.coverImagePath,
        })}
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
            {category ? (
              <p className="mono-label text-dept-accent">{category.name}</p>
            ) : null}
            <h1 className="display-tight mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {article.summary}
            </p>
            <p className="mt-6 text-sm text-ink-300">
              {t("insights.byAuthor", { author: authorName })}
              {author?.roleTitle ? ` · ${author.roleTitle}` : ""}
              {" · "}
              {t("insights.publishedOn", {
                date: formatDate(article.publishedAt, resolved),
              })}
            </p>
          </div>
        </div>
      </section>

      <SectionBand labelledBy="article-body-heading">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 id="article-body-heading" className="visually-hidden">
              {t("a11y.articleBody")}
            </h2>
            <RichText body={article.body} />

            <p className="mt-10">
              <Link
                href={`/${resolved}${INSIGHTS_PATH}`}
                className="text-sm font-semibold text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
              >
                {t("insights.backToInsights")}
              </Link>
            </p>
          </div>

          <aside className="space-y-6">
            {author ? (
              <section
                aria-labelledby="article-author-heading"
                className="rounded-card border border-border bg-surface-alt p-6"
              >
                <h2
                  id="article-author-heading"
                  className="mono-label text-muted"
                >
                  {t("insights.byAuthor", { author: author.displayName })}
                </h2>
                <p className="mt-2 text-sm font-semibold text-ink-900">
                  {author.displayName}
                </p>
                <p className="text-sm text-body">
                  {author.roleTitle ?? t("insights.authorRoleFallback")}
                </p>
                {author.bio ? (
                  <p className="mt-3 text-sm text-body">{author.bio}</p>
                ) : null}
              </section>
            ) : null}

            {relatedServices.length > 0 && article.department ? (
              <section
                aria-labelledby="article-related-heading"
                className="rounded-card border border-border bg-surface-alt p-6"
                {...departmentScopeProps(article.department)}
              >
                <h2
                  id="article-related-heading"
                  className="mono-label text-muted"
                >
                  {t("insights.relatedHeading")}
                </h2>
                <ul className="mt-4 space-y-3">
                  {relatedServices.map((service) => (
                    <li key={service.slug}>
                      <Link
                        href={`/${resolved}/${article.department}/services/${service.slug}`}
                        className="text-sm font-medium text-ink-900 transition-soft hover:text-dept-accent"
                      >
                        {service.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </SectionBand>

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("dm.ctaHeading")}
          body={t("dm.ctaBody")}
        />
      </div>
    </>
  );
}
