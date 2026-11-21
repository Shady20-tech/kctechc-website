import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { MarketplaceEmptyState } from "@/components/marketplace/MarketplaceEmptyState";
import { MarketplacePagination } from "@/components/marketplace/MarketplacePagination";
import { MarketplaceSearchLayout } from "@/components/marketplace/MarketplaceSearchLayout";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { StoreActiveFilters } from "@/components/store/StoreActiveFilters";
import { StoreFilterSidebar } from "@/components/store/StoreFilterSidebar";
import { StoreResultsToolbar } from "@/components/store/StoreResultsToolbar";
import { ProductGrid } from "@/components/store/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { storePathFor } from "@/lib/config/navigation";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { loadStoreFacets, queryCatalogue } from "@/lib/store/catalogue";
import { localizeCategory } from "@/lib/store/defaults";
import {
  loadCategories,
  loadCategoryBySlug,
  loadCategoryRecords,
  resolveBySlug,
} from "@/lib/store/loaders";
import {
  activeStoreFilterKeys,
  buildStoreQuery,
  hasActiveStoreFilters,
  parseStoreFilters,
} from "@/lib/store/search";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Store category page.
 *
 * The URL segment is the category's localized slug, so a French visitor sees
 * `/fr/digital-marketing/store/ordinateurs` and the English one sees
 * `/en/digital-marketing/store/laptops` for the same category.
 *
 * It is the store index scoped to one category, and it uses the *same* filtering
 * experience: the category is pinned into the filter state and then every control
 * — keyword, price, brand, in-stock, sort, pagination — works exactly as it does
 * on the index. The category select is therefore not offered here; it is already
 * decided by the URL. Everything else narrows within the category, and all of it
 * happens in `search_products`, never by loading the category into React.
 *
 * A category whose localized slug differs from the canonical one is reachable at
 * both under its own locale — the canonical slug still answers, so an inbound
 * link written before the translation existed keeps working.
 *
 * `[category]` is the one param `generateStaticParams` cannot enumerate (the
 * category set is data), so the route renders per request and reads
 * `searchParams` for its filter state. Awaiting `searchParams` on a route the
 * router still treats as prerenderable throws `DYNAMIC_SERVER_USAGE`, which is
 * why this page answered 500 in the production build while rendering fine in
 * dev. The declaration below states that intent rather than leaving it to
 * inference; the slug route beside it needs none because it reads no
 * `searchParams`.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  // The category set is read from the database, so no category segments are
  // enumerated; only the department segment is, from the static list.
  return DEPARTMENTS.map((department) => ({ department: department.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale, department, category: segment } = await params;
  if (!isLocale(locale)) return {};
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) return {};

  const category = await loadCategoryBySlug(segment, locale, department);
  if (!category) return {};

  const t = createTranslator(locale).t;

  // The bare category page is indexable; a narrowed view of it is not, for the
  // same reason a filtered store index is not — every price/brand permutation
  // would be a near-duplicate. The category segment itself is pinned, so only the
  // remaining filters decide indexability.
  const filters = { ...parseStoreFilters(await searchParams), category: undefined };

  return buildMetadata({
    locale,
    pathWithoutLocale: `${storePathFor(department)}/${category.slug}`,
    title: `${category.name} · ${t("store.metaTitle")}`,
    description: category.description ?? t("store.metaDescription"),
    noindex: hasActiveStoreFilters(filters),
  });
}

export default async function StoreCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, department, category: segment } = await params;
  if (!isLocale(locale)) notFound();
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const storePath = storePathFor(department);

  // The segment is matched against localized slugs; a miss is a 404, not an empty
  // category, so a typo does not look like an out-of-stock catalogue. The record
  // is kept canonical because that is what the catalogue query filters on — the
  // localized slug is only the URL segment.
  const records = await loadCategoryRecords(department);
  const record = resolveBySlug(records, segment, resolved);
  if (!record) notFound();
  const category = localizeCategory(record, resolved);

  const basePath = `/${resolved}${storePath}/${category.slug}`;
  // The URL's own category is pinned into the filter state, so a stale `category`
  // parameter in the query string cannot override the segment the visitor is on.
  const filters = { ...parseStoreFilters(await searchParams), category: undefined };

  const [categories, facets] = await Promise.all([
    loadCategories(resolved, department),
    loadStoreFacets(department),
  ]);

  const page = await queryCatalogue({
    departmentSlug: department,
    locale: resolved,
    query: filters.query,
    categorySlug: record.slug,
    currency: filters.currency,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStockOnly: filters.inStock,
    brand: filters.brand,
    sort: filters.sort,
    page: filters.page,
  });

  const activeCount = activeStoreFilterKeys(filters).length;
  const hasFilters = hasActiveStoreFilters(filters);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${storePath}` },
    { name: category.name, href: basePath },
  ];

  const listJsonLd = itemListJsonLd({
    name: category.name,
    path: basePath,
    items: page.items.map((product) => ({
      name: product.title,
      path: `${basePath}/${product.slug}`,
    })),
  });

  function hrefFor(target: number): string {
    return `${basePath}${buildStoreQuery({ ...filters, page: target })}`;
  }

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.store"), path: `/${resolved}${storePath}` },
          { name: category.name, path: basePath },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <MarketplaceSearchLayout
        sidebarAriaLabel={t("store.filtersHeading")}
        drawerLabels={{
          open: t("store.openFilters"),
          title: t("store.filtersHeading"),
          close: t("store.closeFilters"),
        }}
        activeCount={activeCount}
        filters={(variant) => (
          <StoreFilterSidebar
            locale={resolved}
            basePath={basePath}
            filters={filters}
            facets={facets}
            // The category is fixed by the URL, so the sidebar does not offer it.
            categories={[]}
            variant={variant}
          />
        )}
        header={
          <SectionBand
            labelledBy="category-heading"
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
              eyebrow={t("store.categoryHeading")}
              heading={category.name}
              intro={category.description}
            />
            <h2 id="category-heading" className="visually-hidden">
              {category.name}
            </h2>
          </SectionBand>
        }
        toolbar={
          <StoreResultsToolbar
            locale={resolved}
            basePath={basePath}
            filters={filters}
            total={page.total}
          />
        }
        meta={
          activeCount > 0 ? (
            <div className="mt-4">
              <StoreActiveFilters
                locale={resolved}
                basePath={basePath}
                filters={filters}
                categories={categories}
              />
            </div>
          ) : null
        }
        results={
          <>
            {page.items.length === 0 ? (
              <div className="mt-2">
                <MarketplaceEmptyState
                  heading={
                    hasFilters
                      ? t("store.noResultsHeading")
                      : t("store.categoryEmptyHeading")
                  }
                  body={
                    hasFilters
                      ? t("store.noResultsBody")
                      : t("store.categoryEmptyBody")
                  }
                  action={
                    <ButtonLink
                      href={hasFilters ? basePath : `/${resolved}${storePath}`}
                      variant="secondary"
                    >
                      {hasFilters
                        ? t("store.clearFilters")
                        : t("store.backToStore")}
                    </ButtonLink>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-2">
                  <ProductGrid products={page.items} locale={resolved} t={t} />
                </div>
                <MarketplacePagination
                  page={page.page}
                  pageCount={page.pageCount}
                  hrefFor={hrefFor}
                  labels={{
                    nav: t("store.paginationLabel"),
                    previous: t("store.previousPage"),
                    next: t("store.nextPage"),
                    page: (target) => t("store.pageNumber", { page: target }),
                  }}
                />
              </>
            )}
          </>
        }
        footer={
          <SectionBand tone="alt">
            <p>
              <ButtonLink
                href={`/${resolved}${storePath}`}
                variant="ghost"
                size="sm"
              >
                {t("store.backToStore")}
              </ButtonLink>
            </p>
          </SectionBand>
        }
      />
    </>
  );
}
