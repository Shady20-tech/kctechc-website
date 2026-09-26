import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ProductGrid } from "@/components/store/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH } from "@/lib/config/navigation";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import {
  loadCategories,
  loadCategoryBySlug,
  loadProductsInCategory,
} from "@/lib/store/loaders";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Store category page.
 *
 * The URL segment is the category's localized slug, so a French visitor sees
 * `/fr/digital-marketing/store/ordinateurs` and the English one sees
 * `/en/digital-marketing/store/laptops` for the same category. The segment is
 * resolved back to the category through `loadCategoryBySlug`, which applies the
 * same locale-scoped matching rules the product pages use.
 *
 * A category whose localized slug differs from the canonical one is reachable at
 * both under its own locale — the canonical slug still answers, so an inbound
 * link written before the translation existed keeps working.
 */
export async function generateStaticParams() {
  // The category set is read from the database, so no segments are enumerated;
  // the route renders on demand and Next.js caches the result.
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category: segment } = await params;
  if (!isLocale(locale)) return {};

  const category = await loadCategoryBySlug(segment, locale);
  if (!category) return {};

  const t = createTranslator(locale).t;

  return buildMetadata({
    locale,
    pathWithoutLocale: `${STORE_PATH}/${category.slug}`,
    title: `${category.name} · ${t("store.metaTitle")}`,
    description: category.description ?? t("store.metaDescription"),
  });
}

export default async function StoreCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category: segment } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  // The segment is matched against localized slugs; a miss is a 404, not an empty
  // category, so a typo does not look like an out-of-stock catalogue.
  const category = await loadCategoryBySlug(segment, resolved);
  if (!category) notFound();

  // Products are filtered by the canonical category slug, which is the stable
  // identifier, while the URL keeps the localized one.
  const canonical = (await loadCategories(resolved)).find(
    (entry) => entry.slug === category.slug,
  );
  const products = await loadProductsInCategory(
    canonical?.slug ?? category.slug,
    resolved,
  );

  const categoryPath = `/${resolved}${STORE_PATH}/${category.slug}`;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${STORE_PATH}` },
    { name: category.name, href: categoryPath },
  ];

  const listJsonLd = itemListJsonLd({
    name: category.name,
    path: categoryPath,
    items: products.map((product) => ({
      name: product.title,
      path: `/${resolved}${STORE_PATH}/${category.slug}/${product.slug}`,
    })),
  });

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.store"), path: `/${resolved}${STORE_PATH}` },
          { name: category.name, path: categoryPath },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <SectionBand
        labelledBy="category-heading"
        {...departmentScopeProps("digital-marketing")}
      >
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />
        <PageIntro
          eyebrow={t("store.categoryHeading")}
          heading={category.name}
          intro={category.description}
        />
        <h2 id="category-heading" className="visually-hidden">
          {category.name}
        </h2>
      </SectionBand>

      <SectionBand labelledBy="category-products-heading">
        <h2 id="category-products-heading" className="visually-hidden">
          {t("store.heading")}
        </h2>

        {products.length === 0 ? (
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-ink-900">
              {t("store.categoryEmptyHeading")}
            </h3>
            <p className="mt-3 text-base text-body">
              {t("store.categoryEmptyBody")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}${STORE_PATH}`}
                variant="secondary"
              >
                {t("store.backToStore")}
              </ButtonLink>
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              {products.length === 1
                ? t("store.resultsCountOne")
                : t("store.resultsCount", { count: products.length })}
            </p>
            <ProductGrid products={products} locale={resolved} t={t} />
            <p className="mt-10">
              <ButtonLink
                href={`/${resolved}${STORE_PATH}`}
                variant="ghost"
                size="sm"
              >
                {t("store.backToStore")}
              </ButtonLink>
            </p>
          </>
        )}
      </SectionBand>
    </>
  );
}
