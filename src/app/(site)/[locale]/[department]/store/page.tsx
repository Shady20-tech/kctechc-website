import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ProductGrid } from "@/components/store/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { storePathFor } from "@/lib/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { loadCategories, loadProducts } from "@/lib/store/loaders";
import { filterProducts, isStoreSort } from "@/lib/store/search";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department store index.
 *
 * Every department has a store at `/{locale}/{department}/store`. The catalogue
 * is empty until a real product is published, and this page says so plainly
 * rather than filling the space with invented products — a fabricated product
 * with a price and a stock figure is a commercial offer the company has not made.
 *
 * Search, filtering and sorting run over the localized catalogue in application
 * code, because the searchable text is the translated text — a French visitor
 * searching "ordinateur" must match a French title, which a query against the
 * canonical `products.title` column could never do.
 */
export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ department: department.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: storePathFor(department),
    title: t("store.metaTitle"),
    description: t("store.metaDescription"),
  });
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const storePath = storePathFor(department);
  const query = await searchParams;

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const searchTerm = first(query.q) ?? "";
  const categoryFilter = first(query.category);
  const availabilityParam = first(query.availability);
  const sortParam = first(query.sort);

  const [categories, allProducts] = await Promise.all([
    loadCategories(resolved, department),
    loadProducts(resolved, department),
  ]);

  const products = filterProducts(allProducts, {
    query: searchTerm,
    category: categoryFilter,
    availability:
      availabilityParam === "in_stock" || availabilityParam === "out_of_stock"
        ? availabilityParam
        : undefined,
    sort: isStoreSort(sortParam) ? sortParam : "relevance",
  });

  const hasFilters =
    searchTerm.length > 0 ||
    Boolean(categoryFilter) ||
    Boolean(availabilityParam) ||
    (sortParam !== undefined && sortParam !== "relevance");

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${storePath}` },
  ];

  const listJsonLd = itemListJsonLd({
    name: t("store.heading"),
    path: `/${resolved}${storePath}`,
    items: products.map((product) => ({
      name: product.title,
      path: `/${resolved}${storePath}/${product.categorySlug}/${product.slug}`,
    })),
  });

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.store"), path: `/${resolved}${storePath}` },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <SectionBand
        labelledBy="store-heading"
        {...departmentScopeProps(
          department as (typeof DEPARTMENTS)[number]["slug"],
        )}
      >
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />
        <PageIntro
          eyebrow={t("store.eyebrow")}
          heading={t("store.heading")}
          intro={t("store.intro")}
        />
        <h2 id="store-heading" className="visually-hidden">
          {t("store.heading")}
        </h2>
      </SectionBand>

      {categories.length > 0 ? (
        <SectionBand tone="alt" labelledBy="store-categories-heading">
          <h2
            id="store-categories-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {t("store.categoriesHeading")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            <li>
              <Link
                href={`/${resolved}${storePath}`}
                className="inline-flex items-center rounded-pill border border-border bg-surface px-4 py-1.5 text-sm font-medium text-body transition-soft hover:border-border-strong hover:text-ink-900"
              >
                {t("store.allCategories")}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/${resolved}${storePath}/${category.slug}`}
                  className="inline-flex items-center rounded-pill border border-border bg-surface px-4 py-1.5 text-sm font-medium text-body transition-soft hover:border-border-strong hover:text-ink-900"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </SectionBand>
      ) : null}

      <SectionBand labelledBy="store-results-heading">
        <h2 id="store-results-heading" className="visually-hidden">
          {t("store.heading")}
        </h2>

        {allProducts.length === 0 ? (
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-ink-900">
              {t("store.emptyHeading")}
            </h3>
            <p className="mt-3 text-base text-body">{t("store.emptyBody")}</p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}/${department}/services`}
                variant="secondary"
              >
                {t("store.emptyCta")}
              </ButtonLink>
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-ink-900">
              {t("store.noResultsHeading")}
            </h3>
            <p className="mt-3 text-base text-body">
              {t("store.noResultsBody")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}${storePath}`}
                variant="secondary"
              >
                {t("store.clearFilters")}
              </ButtonLink>
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted" aria-live="polite">
              {products.length === 1
                ? t("store.resultsCountOne")
                : t("store.resultsCount", { count: products.length })}
              {hasFilters ? ` · ${t("store.filterLabel")}` : ""}
            </p>
            <ProductGrid products={products} locale={resolved} t={t} />
          </>
        )}
      </SectionBand>
    </>
  );
}
