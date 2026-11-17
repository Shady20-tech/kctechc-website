import { MarketplacePagination } from "@/components/marketplace/MarketplacePagination";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import {
  buildListingQuery,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * Listing pagination.
 *
 * A binding over the shared `MarketplacePagination`: it knows how a listing URL
 * is written — every filter, the view flag, and the rule that page 1 is the
 * absence of the parameter — and the shared component renders the control. Page 1
 * is omitted rather than written out, so `/listings` and `/listings?page=1` are
 * not two addresses for one page.
 */
export function ListingPagination({
  locale,
  t,
  filters,
  page,
  pageCount,
  view,
}: {
  locale: Locale;
  t: Translator["t"];
  filters: ListingFilters;
  page: number;
  pageCount: number;
  view: "list" | "map";
}) {
  const basePath = `/${locale}/real-estate/listings`;

  function hrefFor(target: number): string {
    const next: ListingFilters = {
      ...filters,
      page: target > 1 ? target : undefined,
    };
    const params = new URLSearchParams(
      buildListingQuery(next).replace(/^\?/, ""),
    );
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  return (
    <MarketplacePagination
      page={page}
      pageCount={pageCount}
      hrefFor={hrefFor}
      labels={{
        nav: t("realEstate.search.paginationLabel"),
        previous: t("realEstate.search.previousPage"),
        next: t("realEstate.search.nextPage"),
        page: (target) => t("realEstate.search.pageNumber", { page: target }),
      }}
    />
  );
}
