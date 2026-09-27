import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { buildListingQuery, type ListingFilters } from "@/lib/real-estate/search";

/**
 * Pagination for a result set.
 *
 * Links, not buttons, for the same reason the filters are a form: each page is a
 * real URL, so page 3 can be shared, cached and reached with the back button.
 *
 * The window is a small run of pages around the current one rather than every
 * page. A result set of 400 properties would otherwise render 34 numbered links,
 * which is a wall of numbers that helps nobody find page 2. First and last are
 * always offered as jumps, because they are the two destinations someone actually
 * wants when they are far from the middle.
 *
 * A disabled edge is rendered as text, not as a link to the same page: a link that
 * goes nowhere is a control that does nothing when activated, which is worse than
 * an obvious absence.
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
  if (pageCount <= 1) return null;

  const basePath = `/${locale}/real-estate/listings`;

  function hrefFor(target: number): string {
    const next: ListingFilters = {
      ...filters,
      // Page 1 is the default, so it is written as the absence of the parameter —
      // the same rule the filter serializer follows. That keeps `/listings` and
      // `/listings?page=1` from being two addresses for one page.
      page: target > 1 ? target : undefined,
    };
    const params = new URLSearchParams(buildListingQuery(next).replace(/^\?/, ""));
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  const window = pageWindow(page, pageCount);

  return (
    <nav aria-label={t("realEstate.search.paginationLabel")} className="mt-10">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              rel="prev"
              className={navClasses}
              aria-label={t("realEstate.search.previousPage")}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">
                {t("realEstate.search.previousPage")}
              </span>
            </Link>
          ) : (
            <span className={`${navClasses} opacity-40`} aria-hidden="true">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">
                {t("realEstate.search.previousPage")}
              </span>
            </span>
          )}
        </li>

        {window.map((entry, index) =>
          entry === "gap" ? (
            // A gap is rendered as an ellipsis and marked aria-hidden: it carries
            // no destination, and a screen reader announcing "gap" would be noise.
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={t("realEstate.search.pageNumber", { page: entry })}
                className={`${navClasses} ${
                  entry === page ? "bg-dept-accent text-white" : ""
                }`}
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < pageCount ? (
            <Link
              href={hrefFor(page + 1)}
              rel="next"
              className={navClasses}
              aria-label={t("realEstate.search.nextPage")}
            >
              <span className="sr-only sm:not-sr-only">
                {t("realEstate.search.nextPage")}
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : (
            <span className={`${navClasses} opacity-40`} aria-hidden="true">
              <span className="sr-only sm:not-sr-only">
                {t("realEstate.search.nextPage")}
              </span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

const navClasses =
  "inline-flex items-center gap-1 rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-body transition-soft hover:border-dept-accent";

/**
 * The page numbers to show, with `"gap"` marking an omitted run.
 *
 * Always includes the first and last page, the current page, and one neighbour on
 * each side. Two pages either side was rejected: at narrow widths the row wraps,
 * and a wrapped pagination control is harder to scan than a shorter one.
 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);

  const sorted = [...pages]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const entry of sorted) {
    if (previous !== 0 && entry - previous > 1) result.push("gap");
    result.push(entry);
    previous = entry;
  }
  return result;
}
