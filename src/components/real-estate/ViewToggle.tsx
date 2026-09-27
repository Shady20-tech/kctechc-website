import { List, Map } from "lucide-react";
import Link from "next/link";

import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { buildListingQuery, type ListingFilters } from "@/lib/real-estate/search";

/**
 * The list/map switch.
 *
 * Rendered as two links rather than a client-side toggle, for the same reason the
 * filters are a plain form: each view is a real URL, so it can be shared, cached
 * and reached with the back button. It is the current view that is marked
 * `aria-current`, so the state is announced and not only shown by colour.
 *
 * `view` is deliberately not part of `ListingFilters`: it does not change the
 * result set, only how the same result set is presented, so it is appended here
 * on top of the filter query the shared serializer builds.
 */
export function ViewToggle({
  locale,
  t,
  filters,
  view,
}: {
  locale: Locale;
  t: Translator["t"];
  filters: ListingFilters;
  view: "list" | "map";
}) {
  const basePath = `/${locale}/real-estate/listings`;
  const query = buildListingQuery(filters);

  const options = [
    { key: "list" as const, label: t("realEstate.search.viewList"), Icon: List },
    { key: "map" as const, label: t("realEstate.search.viewMap"), Icon: Map },
  ];

  return (
    <div className="inline-flex items-center gap-2">
      <span className="mono-label text-muted">
        {t("realEstate.search.viewLabel")}
      </span>
      <div
        role="group"
        aria-label={t("realEstate.search.viewLabel")}
        className="inline-flex overflow-hidden rounded-pill border border-border"
      >
        {options.map(({ key, label, Icon }) => {
          const isActive = view === key;
          // The map view carries the flag; the list view is the absence of it,
          // so a list URL is the bare filter query and never `?view=list`.
          const href =
            key === "map"
              ? `${basePath}${query}${query ? "&" : "?"}view=map`
              : `${basePath}${query}`;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-soft ${
                isActive
                  ? "bg-dept-accent text-white"
                  : "bg-surface text-body hover:bg-surface-alt"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
