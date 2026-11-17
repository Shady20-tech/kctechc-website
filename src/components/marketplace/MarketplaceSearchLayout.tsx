import type { ReactNode } from "react";

import { MarketplaceMobileFilterDrawer } from "./MarketplaceMobileFilterDrawer";
import type { MarketplaceDrawerLabels } from "./types";

/**
 * The marketplace search layout.
 *
 * One two-column results shell for every department: a compact filter column on
 * the left, the results on the right. The column is a grid track, not a fixed
 * width, so the results area takes the remaining space and nothing overflows
 * horizontally; the sidebar lands between 250 and 300px on a typical desktop
 * (17rem/272px, 18rem/288px at the `xl` breakpoint).
 *
 * The filter column is `hidden` below `lg` and replaced by the mobile drawer, so a
 * narrow viewport never gets a squeezed sidebar or a page that scrolls sideways.
 * The drawer renders the *same* form as the desktop column — the `filters` render
 * prop is called once per presentation — so the two cannot drift.
 *
 * Everything else is a slot: `header` (breadcrumbs and the page title),
 * `toolbar`, `meta` (active-filter chips, a save-search control), `results` and
 * `footer`. The layout arranges them; it never inspects them, so a store passes
 * product results and Real Estate passes property results without either
 * department's data reaching the other.
 *
 * A Server Component: the only client part is the drawer's trigger, which owns
 * the open state.
 */
export function MarketplaceSearchLayout({
  filters,
  drawerLabels,
  activeCount,
  sidebarAriaLabel,
  header,
  toolbar,
  meta,
  results,
  footer,
  showSidebar = true,
}: {
  /**
   * Renders the department's filter form for a presentation.
   *
   * Called with `"sidebar"` for the desktop column and `"drawer"` for the mobile
   * panel. The department returns its own fields either way, so there is exactly
   * one implementation of the filters rendered twice.
   */
  filters: (variant: "sidebar" | "drawer") => ReactNode;
  drawerLabels: MarketplaceDrawerLabels;
  /** The number of active filters, shown on the drawer trigger. */
  activeCount: number;
  sidebarAriaLabel: string;
  header?: ReactNode;
  toolbar?: ReactNode;
  meta?: ReactNode;
  results: ReactNode;
  footer?: ReactNode;
  /**
   * Whether to render the filter column at all.
   *
   * A department whose filters are all derived from its data can end up with
   * nothing to offer — a gallery with no published records has no service, region
   * or property type to choose between. An empty sidebar with three "All" selects
   * is worse than no sidebar, so the caller turns it off; the results area then
   * takes the full width and no mobile drawer trigger is rendered.
   */
  showSidebar?: boolean;
}) {
  return (
    <>
      {header}

      <div className="container-page section-tight">
        <div
          className={
            showSidebar
              ? "grid gap-8 lg:grid-cols-[17rem_1fr] xl:grid-cols-[18rem_1fr]"
              : ""
          }
        >
          {/* Desktop filter column. `hidden` below `lg`; the drawer covers that. */}
          {showSidebar ? (
            <aside aria-label={sidebarAriaLabel} className="hidden lg:block">
              <div className="sticky top-24 rounded-card border border-border bg-surface p-5">
                {filters("sidebar")}
              </div>
            </aside>
          ) : null}

          <div className="min-w-0">
            {showSidebar ? (
              <div className="mb-4 lg:hidden">
                <MarketplaceMobileFilterDrawer
                  labels={drawerLabels}
                  activeCount={activeCount}
                >
                  {filters("drawer")}
                </MarketplaceMobileFilterDrawer>
              </div>
            ) : null}

            {toolbar}
            {meta}
            {results}
          </div>
        </div>
      </div>

      {footer}
    </>
  );
}
