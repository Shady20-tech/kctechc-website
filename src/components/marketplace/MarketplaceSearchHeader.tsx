import type { ReactNode } from "react";

import { MarketplaceCategoryNavigation } from "./MarketplaceCategoryNavigation";
import type { MarketplaceCategoryItem } from "./types";

/**
 * The marketplace search header.
 *
 * The prominent search area a marketplace landing page needs: a location
 * selector, a keyword input, a search button, and the quick category shortcuts
 * under them. It is a Server Component and a plain GET form, so the search IS a
 * URL — submitting navigates to the results path with the filters encoded, the
 * result is shareable and cacheable, and it works without JavaScript.
 *
 * The *fields* are passed in as `fields`, because the set of controls differs per
 * department: Real Estate offers a region select and property categories, the
 * store offers a category select and a brand, and Electrical Services offers a
 * region. The shell owns the layout, the submit button and the shortcut row; the
 * department owns what goes in it.
 */
export function MarketplaceSearchHeader({
  action,
  fields,
  submitLabel,
  categories,
  categoriesLabel,
}: {
  /** The results path the GET form submits to. */
  action: string;
  /** The department's own search controls, rendered in the form's field row. */
  fields: ReactNode;
  submitLabel: string;
  categories: readonly MarketplaceCategoryItem[];
  categoriesLabel: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <form
        method="get"
        action={action}
        className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
      >
        {fields}
        <div className="flex items-end">
          <MarketplaceSearchSubmit label={submitLabel} />
        </div>
      </form>

      {categories.length > 0 ? (
        <div className="mt-5">
          <p className="mono-label text-muted">{categoriesLabel}</p>
          <div className="mt-2">
            <MarketplaceCategoryNavigation
              items={categories}
              ariaLabel={categoriesLabel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The search button.
 *
 * Isolated in its own component so the `accentOnInk` pairing is decided in one
 * place. The search area sits inside an ink hero on Real Estate, where the
 * accent resolves to its bright variant and white text on it is ~1.9:1; ink text
 * on the bright fill is the pairing that passes. A department that renders the
 * header on a light surface still gets a legible control.
 */
function MarketplaceSearchSubmit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-dept-accent-bright px-5 py-3 text-sm font-semibold text-ink-950 transition-soft hover:opacity-90 sm:w-auto"
    >
      <SearchIcon />
      {label}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
