import "server-only";

import { cache } from "react";

import type { Locale } from "@/lib/i18n/locales";
import { createPublicClient } from "@/lib/supabase/public";
import { loadCategoryRecords, loadProductRecordsByIds } from "./loaders";
import { resolveBySlug } from "./slug-resolution";
import type { LocalizedProduct } from "./types";
import { localizeProduct } from "./defaults";
import {
  STORE_PAGE_SIZE,
  STORE_PRIMARY_CURRENCY,
  type StoreSort,
} from "./search";

/**
 * The store catalogue's database-side query layer.
 *
 * Filtering, counting and pagination happen in `search_products` — one round trip
 * that returns the page and its total under the same predicate, so the number
 * shown and the rows returned cannot disagree. The page never loads the catalogue
 * into React and filters it: that approach is correct only while the catalogue is
 * small, and it is what the brief rules out.
 *
 * The RPC returns the matched ids and their total; only those rows are hydrated,
 * so a search payload is bounded by the page size rather than by the catalogue
 * size. Every loader returns an empty result on failure, matching the contract the
 * other content loaders follow: a database outage degrades the store to its empty
 * state, not to an error page.
 */

export type CatalogueParams = {
  departmentSlug: string;
  locale: Locale;
  query?: string;
  /**
   * A category's URL slug — the locale's own slug, or the canonical one — which
   * `resolveCategoryId` maps back to the row it belongs to.
   */
  categorySlug?: string;
  /** The currency the price bounds are expressed in. */
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  brand?: string;
  sort?: StoreSort;
  page?: number;
};

export type CataloguePage = {
  items: readonly LocalizedProduct[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** The facet counts the store sidebar and category navigation render. */
export type StoreFacets = {
  /** Real published-product counts, keyed by canonical category slug. */
  categories: ReadonlyMap<string, number>;
  /** The brands that actually occur, with their counts, most common first. */
  brands: readonly { value: string; count: number }[];
};

export const EMPTY_STORE_FACETS: StoreFacets = {
  categories: new Map(),
  brands: [],
};

/** The database's sort vocabulary. Kept here so the RPC and the UI cannot drift. */
function sqlSort(sort: StoreSort): string {
  return sort.replace(/-/g, "_");
}

/** Whether a sort orders by price, and so needs one currency to compare in. */
export function isPriceSort(sort: StoreSort | undefined): boolean {
  return sort === "price-asc" || sort === "price-desc";
}

/**
 * Resolve a department slug once per request.
 *
 * The store index asks for the same department from the catalogue, the facets and
 * the category navigation. Without this cache those were three identical round
 * trips, each costing the database's full request latency.
 */
const resolveDepartmentId = cache(
  async (slug: string): Promise<string | null> => {
    const supabase = createPublicClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return data?.id ?? null;
  },
);

/**
 * Resolve a category URL segment to its id within a department.
 *
 * The segment is the slug *for the active locale*, so a French URL carries
 * `ordinateurs` where the canonical column says `laptops`. Matching the raw
 * segment against the canonical column would silently return nothing for every
 * translated category, so the segment goes through the same
 * `resolveBySlug` rules the product pages use — the locale's own slug first, the
 * canonical slug second — and only then is the canonical slug resolved to an id,
 * which is what the RPC filters on.
 */
async function resolveCategoryId(
  segment: string,
  locale: Locale,
  departmentSlug: string,
  departmentId: string,
): Promise<string | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;

  const record = resolveBySlug(
    await loadCategoryRecords(departmentSlug),
    segment,
    locale,
  );
  if (!record) return null;

  const { data } = await supabase
    .from("product_categories")
    .select("id")
    .eq("slug", record.slug)
    .eq("department_id", departmentId)
    .eq("publish_state", "published")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Query one page of the published catalogue.
 *
 * Returns an empty page on any failure — unconfigured, unreachable, malformed —
 * so the storefront renders its empty state instead of an error.
 */
export async function queryCatalogue(
  params: CatalogueParams,
): Promise<CataloguePage> {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = STORE_PAGE_SIZE;
  const empty: CataloguePage = {
    items: [],
    total: 0,
    page,
    pageSize,
    pageCount: 0,
  };

  try {
    const supabase = createPublicClient();
    if (!supabase) return empty;

    const departmentId = await resolveDepartmentId(params.departmentSlug);
    if (!departmentId) return empty;

    const categoryId = params.categorySlug
      ? await resolveCategoryId(
          params.categorySlug,
          params.locale,
          params.departmentSlug,
          departmentId,
        )
      : null;
    // A category slug in the URL that does not exist is a miss, not "all
    // products": showing the whole catalogue under a filtered URL would be a
    // non-canonical state that claims a filter it is not applying.
    if (params.categorySlug && !categoryId) return empty;

    // A price sort without an explicit currency would order raw minor units across
    // currencies — 100000 XAF would rank against 1000 USD as though the numbers
    // were comparable, which the brief forbids. The sort therefore always carries
    // the currency it is expressed in, defaulting to the store's primary one.
    const currency =
      params.currency ??
      (isPriceSort(params.sort) ? STORE_PRIMARY_CURRENCY : undefined);

    const { data: matches, error } = await supabase.rpc("search_products", {
      p_query: params.query?.trim() || undefined,
      p_department_id: departmentId,
      p_category_id: categoryId ?? undefined,
      p_currency: currency,
      p_min_price: params.minPrice ?? undefined,
      p_max_price: params.maxPrice ?? undefined,
      p_in_stock: params.inStockOnly ?? undefined,
      p_brand: params.brand?.trim() || undefined,
      p_locale: params.locale,
      p_sort: sqlSort(params.sort ?? "relevance"),
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

    if (error || !matches || matches.length === 0) return empty;

    const ids = matches.map((match) => match.id).filter(Boolean);
    const total = Number(matches[0]?.total_count ?? ids.length);
    const records = await loadProductRecordsByIds(ids);
    const items = records.map((record) =>
      localizeProduct(record, params.locale),
    );

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(Math.ceil(total / pageSize), 1),
    };
  } catch {
    return empty;
  }
}

/**
 * The store's facet counts: per-category totals and the brands that occur.
 *
 * Both come from `product_facets` under the same predicate `search_products`
 * uses, so a category shortcut reading "12" leads to a result set of 12 and a
 * brand with no products is never offered.
 */
export async function loadStoreFacets(
  departmentSlug: string,
): Promise<StoreFacets> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return EMPTY_STORE_FACETS;

    const departmentId = await resolveDepartmentId(departmentSlug);
    if (!departmentId) return EMPTY_STORE_FACETS;

    const [{ data: rows }, { data: categories }] = await Promise.all([
      supabase.rpc("product_facets", { p_department_id: departmentId }),
      supabase
        .from("product_categories")
        .select("id, slug")
        .eq("department_id", departmentId),
    ]);

    const slugById = new Map(
      (categories ?? []).map((category) => [category.id, category.slug]),
    );

    const counts = new Map<string, number>();
    const brands: { value: string; count: number }[] = [];
    for (const row of rows ?? []) {
      if (row.facet === "category") {
        const slug = slugById.get(row.value);
        if (slug) counts.set(slug, Number(row.total));
      } else if (row.facet === "brand" && row.value) {
        brands.push({ value: row.value, count: Number(row.total) });
      }
    }
    brands.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return { categories: counts, brands };
  } catch {
    return EMPTY_STORE_FACETS;
  }
}
