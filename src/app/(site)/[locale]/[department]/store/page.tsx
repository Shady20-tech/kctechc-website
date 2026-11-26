import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { MarketplaceCategoryNavigation } from "@/components/marketplace/MarketplaceCategoryNavigation";
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
import { DEPARTMENTS } from "@/lib/config/site";
import { storePathFor } from "@/lib/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { loadStoreFacets, queryCatalogue } from "@/lib/store/catalogue";
import { localizeCategory } from "@/lib/store/defaults";
import { loadCategoryRecords } from "@/lib/store/loaders";
import {
  activeStoreFilterKeys,
  buildStoreQuery,
  hasActiveStoreFilters,
  parseStoreFilters,
} from "@/lib/store/search";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department store index.
 *
 * Every department has a store at `/{locale}/{department}/store`, and they all
 * share one filtering experience: a two-column results layout with a collapsible
 * filter sidebar, a mobile drawer, active-filter chips and pagination. The shell
 * and the controls are the shared `marketplace` components; the *fields* are the
 * store's own, because a product has a brand and a price in a currency, and a
 * property has bedrooms and a region.
 *
 * Search, filtering, counting and pagination all happen in `search_products` —
 * one database round trip that returns the page and its total under the same
 * predicate. The catalogue is never loaded into React and filtered there: that is
 * the approach the brief rules out, and it is why the counts on this page are
 * real counts of what the visitor will actually see.
 *
 * The catalogue is empty until a real product is published, and the page says so
 * plainly rather than filling the space with invented products — a fabricated
 * product with a price and a stock figure is a commercial offer the company has
 * not made.
 */
export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ department: department.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) return {};
  const t = createTranslator(locale).t;
  // A filtered store view is a view of the catalogue, not a page of its own. Every
  // region/price/brand permutation would otherwise be indexed as a near-duplicate
  // of the bare store, which is the duplicate-content concern the SEO rules
  // govern. Real Estate and the projects gallery apply the same rule.
  const filters = parseStoreFilters(await searchParams);
  return buildMetadata({
    locale,
    pathWithoutLocale: storePathFor(department),
    title: t("store.metaTitle"),
    description: t("store.metaDescription"),
    noindex: hasActiveStoreFilters(filters),
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
  const basePath = `/${resolved}${storePath}`;
  const filters = parseStoreFilters(await searchParams);

  const [records, facets, page] = await Promise.all([
    loadCategoryRecords(department),
    loadStoreFacets(department),
    queryCatalogue({
      departmentSlug: department,
      locale: resolved,
      query: filters.query,
      categorySlug: filters.category,
      currency: filters.currency,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      inStockOnly: filters.inStock,
      brand: filters.brand,
      sort: filters.sort,
      page: filters.page,
    }),
  ]);
  const categories = records.map((record) =>
    localizeCategory(record, resolved),
  );

  // The category navigation offers the real categories with their real counts, so
  // a shortcut reading "12" leads to a result set of 12. The count is looked up by
  // the *canonical* slug because that is what `product_facets` counts by, while
  // the link and the active test use the locale's own slug — the segment the URL
  // carries.
  const categoryNav = records.map((record) => {
    const category = localizeCategory(record, resolved);
    return {
      value: category.slug,
      label: category.name,
      href: `${basePath}${buildStoreQuery({ category: category.slug })}`,
      count: facets.categories.get(record.slug),
      active: filters.category === category.slug,
    };
  });

  const activeCount = activeStoreFilterKeys(filters).length;
  const hasFilters = hasActiveStoreFilters(filters);
  const hasCatalogue = page.total > 0 || hasFilters;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: basePath },
  ];

  const listJsonLd = itemListJsonLd({
    name: t("store.heading"),
    path: basePath,
    items: page.items.map((product) => ({
      name: product.title,
      path: `${basePath}/${product.categorySlug}/${product.slug}`,
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
          { name: t("nav.store"), path: basePath },
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
            categories={categoryNav}
            variant={variant}
          />
        )}
        header={
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
        }
        toolbar={
          hasCatalogue ? (
            <StoreResultsToolbar
              locale={resolved}
              basePath={basePath}
              filters={filters}
              total={page.total}
            />
          ) : null
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
                      : t("store.emptyHeading")
                  }
                  body={
                    hasFilters ? t("store.noResultsBody") : t("store.emptyBody")
                  }
                  action={
                    hasFilters ? (
                      <ButtonLink href={basePath} variant="secondary">
                        {t("store.clearFilters")}
                      </ButtonLink>
                    ) : (
                      <ButtonLink
                        href={`/${resolved}/${department}/services`}
                        variant="secondary"
                      >
                        {t("store.emptyCta")}
                      </ButtonLink>
                    )
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
          categories.length > 0 ? (
            <SectionBand tone="alt" labelledBy="store-categories-heading">
              <h2
                id="store-categories-heading"
                className="text-lg font-semibold text-ink-900"
              >
                {t("store.allCategoriesHeading")}
              </h2>
              <div className="mt-4">
                <MarketplaceCategoryNavigation
                  items={categoryNav}
                  ariaLabel={t("store.allCategoriesHeading")}
                />
              </div>
            </SectionBand>
          ) : null
        }
      />
    </>
  );
}
