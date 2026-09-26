import { DEPARTMENTS } from "@/lib/config/site";
import { INSIGHTS_PATH, STORE_PATH } from "@/lib/config/redirects";
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
  "/insights",
  "/contact",
  // The store sits under the Digital Marketing department rather than at the
  // root, because it is that department's commercial surface. It is listed here
  // because it is a primary nav entry, and this list is what the sitemap and the
  // nav-consistency test both read.
  STORE_PATH,
] as const;

/**
 * Translation key for the articles section label.
 *
 * Phase 2 rendered this entry as "Blog" at `/blog`; Phase 3 names the section
 * "Insights (blog)" and gives it a real article model. The section is served at
 * `/insights` with `/blog` permanently redirecting to it, so there is exactly one
 * canonical URL per article rather than two competing ones. The label lives here
 * as a single constant so switching it back to `nav.blog` is a one-line change if
 * the "Blog" wording is preferred.
 */
export const INSIGHTS_LABEL_KEY = "nav.insights";

// Defined in `./redirects` so `next.config.ts` can import the redirect table
// without pulling in this module's dependency chain.
export { INSIGHTS_PATH, LEGACY_REDIRECTS, STORE_PATH } from "./redirects";

/**
 * Build the primary nav for a locale.
 *
 * Order is the requested information hierarchy: Home, About us, Departments,
 * Services, Gallery, Contact, Insights. Departments sits between About us and
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
    {
      kind: "link",
      href: `/${locale}${INSIGHTS_PATH}`,
      label: t(INSIGHTS_LABEL_KEY),
    },
    { kind: "link", href: `/${locale}${STORE_PATH}`, label: t("nav.store") },
  ];
}
