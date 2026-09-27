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
  isContentManagerRole,
  isRealEstateAdminRole,
  isStoreManagerRole,
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
  icon: typeof LayoutDashboard;
  /** True when the user's role may see this entry. */
  canSee: (role: AppRole) => boolean;
};

export type AdminNavSection = {
  /** Translation key for the section heading, under `adminNav`. */
  headingKey: string;
  items: readonly AdminNavItem[];
};

const anyAdmin = (role: AppRole) => isAdminRole(role);
// The store and the blog are the two department-gated admin surfaces. Each is a
// predicate rather than a role list so the sidebar, the page guard and the RLS
// policy all answer the question the same way.
const storeManager = (role: AppRole) => isStoreManagerRole(role);
const contentManager = (role: AppRole) => isContentManagerRole(role);
const realEstateAdmin = (role: AppRole) => isRealEstateAdminRole(role);
const superOnly = (role: AppRole) => role === "super_admin";

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    headingKey: "sectionOverview",
    items: [
      {
        href: "/admin",
        labelKey: "dashboard",
        icon: LayoutDashboard,
        canSee: anyAdmin,
      },
      {
        href: "/admin/reports",
        labelKey: "reports",
        icon: BarChart3,
        canSee: anyAdmin,
      },
    ],
  },
  {
    headingKey: "sectionOperations",
    items: [
      { href: "/admin/crm", labelKey: "crm", icon: Inbox, canSee: anyAdmin },
      {
        href: "/admin/orders",
        labelKey: "orders",
        icon: ShoppingCart,
        canSee: anyAdmin,
      },
      {
        href: "/admin/store",
        labelKey: "store",
        icon: Package,
        canSee: storeManager,
      },
    ],
  },
  {
    headingKey: "sectionRealEstate",
    items: [
      {
        href: "/admin/real-estate/listings",
        labelKey: "listings",
        icon: Building2,
        canSee: realEstateAdmin,
      },
      {
        href: "/admin/real-estate/submissions",
        labelKey: "submissions",
        icon: FileText,
        canSee: realEstateAdmin,
      },
      {
        href: "/admin/real-estate/import",
        labelKey: "import",
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
        icon: FileText,
        canSee: contentManager,
      },
      { href: "/admin/users", labelKey: "users", icon: Users, canSee: superOnly },
    ],
  },
  {
    headingKey: "sectionSystem",
    items: [
      {
        href: "/admin/logs",
        labelKey: "logs",
        icon: Activity,
        canSee: superOnly,
      },
      {
        href: "/admin/security",
        labelKey: "security",
        icon: ShieldCheck,
        canSee: superOnly,
      },
      {
        href: "/admin/settings",
        labelKey: "settings",
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
