import type { ReactNode } from "react";

/**
 * The typed configuration shared by the marketplace components.
 *
 * These are the shapes the reusable components accept, and nothing here names a
 * department. A store passes its own product filters, Real Estate passes its own
 * listing filters, and Electrical Services passes its own project filters: the
 * components never see a filter model, only the rendered labels, hrefs and
 * counts each department computes from its own typed state.
 *
 * That split is deliberate. One component reading a union of all three filter
 * models would make every department depend on the other two's data — the
 * "giant untyped filtering component" the brief rules out — and would let a
 * store attribute leak onto a property card.
 */

/** A quick-navigation entry: a real category with a real count. */
export type MarketplaceCategoryItem = {
  /** The filter value, used for the active test. */
  value: string;
  /** The already-translated visible label. */
  label: string;
  /** The full URL, built by the department from its own filter model. */
  href: string;
  /** A real result count, from the same predicate the search uses. */
  count?: number;
  /** Whether this entry is the current selection. */
  active?: boolean;
};

/** One removable active-filter chip. */
export type MarketplaceActiveFilterChip = {
  /** A stable key for the React list and the removal link. */
  key: string;
  /** The already-translated chip label, including its value. */
  label: string;
  /** The URL with exactly this one filter removed. */
  href: string;
  /** The accessible name for the removal link, e.g. "Remove filter Region: X". */
  removeLabel: string;
};

/** One sort option, with an already-translated label. */
export type MarketplaceSortChoice = {
  value: string;
  label: string;
};

/** The labels a filter sidebar needs, translated by the calling page. */
export type MarketplaceFilterLabels = {
  submit: string;
  clear: string;
  close?: string;
  /** Rendered under the actions when at least one filter is set. */
  activeCount?: string;
};

/** Everything the mobile drawer needs to render its trigger and panel. */
export type MarketplaceDrawerLabels = {
  open: string;
  title: string;
  close: string;
};

/** A results toolbar's already-translated summary text. */
export type MarketplaceToolbarLabels = {
  /** The total, e.g. "12 properties" — pluralized by the calling page. */
  total: string;
  /** The location and/or category line, when either is set. */
  detail?: string;
  /** The sort control's accessible label. */
  sortLabel: string;
};

/** An empty-state block: either "nothing published yet" or "no matches". */
export type MarketplaceEmptyStateProps = {
  heading: string;
  body: string;
  /** Optional call to action, typically a "clear filters" link. */
  action?: ReactNode;
};

/** A sidebar section's heading and body. */
export type MarketplaceFilterSectionProps = {
  title: string;
  children: ReactNode;
  /** Open on first paint. A filter hidden behind six collapsed groups is unused. */
  defaultOpen?: boolean;
  /** A count badge beside the title, when the section has an active value. */
  count?: number;
};
