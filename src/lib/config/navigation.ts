import { DEPARTMENTS } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

/**
 * Primary navigation model.
 *
 * Defined once and consumed by the desktop header, the mobile drawer and the
 * sitemap, so the three cannot drift apart. Previously the nav was assembled
 * inline in the locale layout, which made it impossible to test in isolation and
 * easy for a route to be listed in one surface but not another.
 *
 * An entry is either a plain link or a menu (the Departments dropdown). Modelling
 * it as a discriminated union rather than an optional `children` array means the
 * renderers must handle both shapes explicitly — there is no state in which a
 * menu exists but its panel is silently dropped.
 */
export type NavLink = {
  kind: "link";
  href: string;
  label: string;
};

export type NavMenu = {
  kind: "menu";
  label: string;
  /** Label for the panel's own landmark, e.g. "Departments menu". */
  ariaLabel: string;
  items: readonly { href: string; label: string }[];
};

export type NavEntry = NavLink | NavMenu;

/** Locale-relative paths that make up the public site, excluding `/`. */
export const NAV_PATHS = [
  "/about",
  "/services",
  "/gallery",
  "/blog",
  "/contact",
] as const;

/**
 * Build the primary nav for a locale.
 *
 * Order is the requested information hierarchy: Home, About us, Departments,
 * Services, Gallery, Contact, Blog. Departments sits between About us and
 * Services deliberately — it is the pivot from "who we are" to "what we do",
 * and keeping it in the middle of the bar balances the row.
 *
 * Department links stay real anchors inside the dropdown, so every department
 * remains one click away and crawlable rather than hidden behind JavaScript.
 */
export function buildPrimaryNav(
  locale: Locale,
  t: Translator["t"],
): NavEntry[] {
  return [
    { kind: "link", href: `/${locale}`, label: t("nav.home") },
    { kind: "link", href: `/${locale}/about`, label: t("nav.aboutUs") },
    {
      kind: "menu",
      label: t("nav.departments"),
      ariaLabel: t("a11y.departmentsMenu"),
      items: DEPARTMENTS.map((department) => ({
        href: `/${locale}/${department.slug}`,
        label: t(department.labelKey),
      })),
    },
    { kind: "link", href: `/${locale}/services`, label: t("nav.services") },
    { kind: "link", href: `/${locale}/gallery`, label: t("nav.gallery") },
    { kind: "link", href: `/${locale}/contact`, label: t("nav.contact") },
    { kind: "link", href: `/${locale}/blog`, label: t("nav.blog") },
  ];
}
