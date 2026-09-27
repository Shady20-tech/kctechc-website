import {
  Activity,
  BarChart3,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  isAdminRole,
  isElevatedRole,
  isRealEstateAdminRole,
  type AppRole,
} from "@/lib/auth/roles";

/**
 * The admin navigation model.
 *
 * Defined once and consumed by the sidebar, the mobile drawer and the dashboard
 * cards, for the same reason the public nav lives in one module: three renderers
 * reading one list cannot drift apart, and a route cannot appear in the sidebar
 * but be missing from the dashboard.
 *
 * Access is expressed as a predicate over the role rather than a duplicated role
 * list. The predicate reuses `src/lib/auth/roles.ts`, which is the same module the
 * pages and Server Actions authorize against — so the link a user sees and the
 * permission that is enforced come from one source. A link that is visible is a
 * link the user is entitled to open; a link they are not entitled to is not
 * rendered at all, and the page behind it re-checks on the server regardless.
 */

export type AdminNavItem = {
  href: string;
  /** Translation key for the label, under the `adminNav` namespace. */
  labelKey: string;
  /**
   * Client-safe icon identity.
   *
   * The icon is looked up from this string on the client rather than passed as a
   * component reference. A Server Component cannot hand a component (or any
   * function) across the boundary to a Client Component, so the sidebar — which is
   * a Client Component and therefore receives the nav as props — would throw on
   * every render if it were given `icon`. The dashboard page is a Server Component
   * and still uses `icon` directly, which is why both exist.
   */
  iconKey: AdminNavIconKey;
  icon: typeof LayoutDashboard;
  /** True when the user's role may see this entry. */
  canSee: (role: AppRole) => boolean;
};

/** The icons the admin nav may use, addressed by a serializable key. */
export const ADMIN_NAV_ICON_KEYS = [
  "dashboard",
  "reports",
  "crm",
  "orders",
  "store",
  "listings",
  "submissions",
  "import",
  "content",
  "users",
  "logs",
  "security",
  "settings",
] as const;

export type AdminNavIconKey = (typeof ADMIN_NAV_ICON_KEYS)[number];

export type AdminNavSection = {
  /** Translation key for the section heading, under `adminNav`. */
  headingKey: string;
  items: readonly AdminNavItem[];
};

/**
 * The nav as a Client Component can receive it.
 *
 * No functions, no component references — only strings. `navSectionsForRoleClient`
 * produces this, and it is the only shape that may cross the server/client
 * boundary. Keeping it a distinct type means the compiler rejects an attempt to
 * hand a Client Component the full `AdminNavItem`, which is the bug this prevents
 * from recurring.
 */
export type AdminNavItemClient = {
  href: string;
  labelKey: string;
  iconKey: AdminNavIconKey;
};

export type AdminNavSectionClient = {
  headingKey: string;
  items: readonly AdminNavItemClient[];
};

const anyAdmin = (role: AppRole) => isAdminRole(role);
const elevated = (role: AppRole) => isElevatedRole(role);
const realEstateAdmin = (role: AppRole) => isRealEstateAdminRole(role);
const superOnly = (role: AppRole) => role === "super_admin";

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    headingKey: "sectionOverview",
    items: [
      {
        href: "/admin",
        labelKey: "dashboard",
        iconKey: "dashboard",
        icon: LayoutDashboard,
        canSee: anyAdmin,
      },
      {
        href: "/admin/reports",
        labelKey: "reports",
        iconKey: "reports",
        icon: BarChart3,
        canSee: anyAdmin,
      },
    ],
  },
  {
    headingKey: "sectionOperations",
    items: [
      {
        href: "/admin/crm",
        labelKey: "crm",
        iconKey: "crm",
        icon: Inbox,
        canSee: anyAdmin,
      },
      {
        href: "/admin/orders",
        labelKey: "orders",
        iconKey: "orders",
        icon: ShoppingCart,
        canSee: anyAdmin,
      },
      {
        href: "/admin/store",
        labelKey: "store",
        iconKey: "store",
        icon: Package,
        canSee: elevated,
      },
    ],
  },
  {
    headingKey: "sectionRealEstate",
    items: [
      {
        href: "/admin/real-estate/listings",
        labelKey: "listings",
        iconKey: "listings",
        icon: Building2,
        canSee: realEstateAdmin,
      },
      {
        href: "/admin/real-estate/submissions",
        labelKey: "submissions",
        iconKey: "submissions",
        icon: FileText,
        canSee: realEstateAdmin,
      },
      {
        href: "/admin/real-estate/import",
        labelKey: "import",
        iconKey: "import",
        icon: FileText,
        canSee: realEstateAdmin,
      },
    ],
  },
  {
    headingKey: "sectionContent",
    items: [
      {
        href: "/admin/content",
        labelKey: "content",
        iconKey: "content",
        icon: FileText,
        canSee: elevated,
      },
      { href: "/admin/users", labelKey: "users", iconKey: "users", icon: Users, canSee: superOnly },
    ],
  },
  {
    headingKey: "sectionSystem",
    items: [
      {
        href: "/admin/logs",
        labelKey: "logs",
        iconKey: "logs",
        icon: Activity,
        canSee: superOnly,
      },
      {
        href: "/admin/security",
        labelKey: "security",
        iconKey: "security",
        icon: ShieldCheck,
        canSee: superOnly,
      },
      {
        href: "/admin/settings",
        labelKey: "settings",
        iconKey: "settings",
        icon: Settings,
        canSee: anyAdmin,
      },
    ],
  },
];

/**
 * The nav sections a given role may see, with empty sections removed.
 *
 * Removing an empty section (rather than rendering a heading with no items) is
 * what keeps a real-estate agent from seeing an empty "Content" heading and
 * concluding the page failed to load.
 */
export function navSectionsForRole(role: AppRole): AdminNavSection[] {
  return ADMIN_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.canSee(role)),
  })).filter((section) => section.items.length > 0);
}

/**
 * The same filtered nav, stripped to what a Client Component may receive.
 *
 * Filtering still happens on the server against the database role; this only drops
 * the `icon` and `canSee` functions that cannot cross the boundary. The sidebar
 * resolves each icon from `iconKey` via its own registry.
 */
export function navSectionsForRoleClient(role: AppRole): AdminNavSectionClient[] {
  return navSectionsForRole(role).map((section) => ({
    headingKey: section.headingKey,
    items: section.items.map((item) => ({
      href: item.href,
      labelKey: item.labelKey,
      iconKey: item.iconKey,
    })),
  }));
}

/**
 * The dashboard cards a role may see.
 *
 * A flat projection of the nav, so the dashboard is a set of doors into the same
 * places the sidebar offers, not a parallel list that can fall out of sync.
 */
export function navItemsForRole(role: AppRole): AdminNavItem[] {
  return navSectionsForRole(role).flatMap((section) => section.items);
}

/**
 * Whether `pathname` is the item's route or a descendant of it.
 *
 * `/admin` is special-cased so it highlights only on the exact dashboard rather
 * than on every admin route, which would leave the dashboard entry permanently
 * active.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
