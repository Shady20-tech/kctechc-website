import type { DashboardKind } from "./dashboard";

/**
 * The navigation model for the customer dashboards (landlord and agent).
 *
 * Defined once and consumed by the sidebar, exactly as the admin console's nav
 * lives in one module: a route cannot appear in one renderer and be missing from
 * another, and the two dashboards (which differ only in what a listing means to
 * the viewer) share the same sidebar shape rather than drifting into two menus.
 *
 * It carries no icon components. The sidebar is a Client Component, and a
 * function — which an icon is — cannot cross the Server/Client boundary, so the
 * model addresses icons by a serializable key and the sidebar resolves each key
 * from its own registry. That is the same split the admin nav documents.
 *
 * This is a leaf module: no server-only imports, no React, no database. It builds
 * hrefs and message keys from the kind and the locale, so it is unit-testable
 * without a Supabase project.
 */

/** The icons a dashboard nav entry may use, addressed by a serializable key. */
export const DASHBOARD_NAV_ICON_KEYS = [
  "overview",
  "create",
  "profile",
  "favorites",
  "savedSearches",
  "kyc",
  "account",
] as const;

export type DashboardNavIconKey = (typeof DASHBOARD_NAV_ICON_KEYS)[number];

export type DashboardNavItem = {
  href: string;
  /** Translation key for the label, under `account.dashboards.nav`. */
  labelKey: string;
  iconKey: DashboardNavIconKey;
  /**
   * True when the entry is the dashboard's own index and should only highlight on
   * an exact match — otherwise it would stay active on every child route.
   */
  exact?: boolean;
};

export type DashboardNavSection = {
  /** Translation key for the section heading, under `account.dashboards.navSections`. */
  headingKey: string;
  items: readonly DashboardNavItem[];
};

/**
 * The sections for one dashboard.
 *
 * `kind` decides only the base path; the structure is identical for a landlord
 * and an agent. The agent's public-profile panel lives on the overview page, so
 * there is no separate entry for it — a link to an anchor on a page already in
 * the menu would be a second way to reach the same place.
 */
export function dashboardNavSections(
  kind: DashboardKind,
  locale: string,
): DashboardNavSection[] {
  const base = `/${locale}/account/${kind}`;

  return [
    {
      headingKey: "sectionManage",
      items: [
        {
          href: base,
          labelKey: "overview",
          iconKey: "overview",
          exact: true,
        },
        { href: `${base}/new`, labelKey: "create", iconKey: "create" },
      ],
    },
    {
      headingKey: "sectionActivity",
      items: [
        {
          href: `/${locale}/real-estate/favorites`,
          labelKey: "favorites",
          iconKey: "favorites",
        },
        {
          href: `/${locale}/real-estate/saved-searches`,
          labelKey: "savedSearches",
          iconKey: "savedSearches",
        },
      ],
    },
    {
      headingKey: "sectionAccount",
      items: [
        {
          href: `/${locale}/account/kyc?for=${kind}`,
          labelKey: "kyc",
          iconKey: "kyc",
        },
        { href: `/${locale}/account`, labelKey: "account", iconKey: "account" },
      ],
    },
  ];
}

/**
 * Whether `pathname` is an item's route or a descendant of it.
 *
 * An `exact` item (the dashboard index) matches only its own path, so the
 * "Overview" entry does not stay highlighted while the user is on the create or
 * edit page. Every other item matches its own path and its descendants, with a
 * `/` boundary so `/account/landlord` does not match `/account/landlord-notes`.
 */
export function isDashboardNavActive(
  item: DashboardNavItem,
  pathname: string,
): boolean {
  if (item.exact) return pathname === item.href;
  const path = item.href.split("?")[0] ?? item.href;
  return pathname === path || pathname.startsWith(`${path}/`);
}
