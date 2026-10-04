import {
  DEPARTMENT_SLUGS,
  DEPARTMENT_THEME_TOKENS,
  isDepartmentSlug,
  type DepartmentSlug,
} from "@/lib/config/site";
import { LOCALES, isLocale } from "@/lib/i18n/locales";

/**
 * Department micro-theme resolution.
 *
 * The active theme is derived from the route, not from a component prop or a
 * stored preference, so it is correct on a deep link, on a client-side
 * navigation and on a full reload without any state to keep in sync. A page
 * cannot forget to declare its theme because the path is the declaration.
 *
 * Three consumers share this one function so they cannot disagree:
 *
 * 1. The inline bootstrap script in the root `<head>` resolves the theme before
 *    the first paint, which is what stops a deep link into a department page
 *    from flashing the corporate palette first.
 * 2. `ThemeController` re-resolves it on every client navigation, so moving from
 *    a department page back to a corporate page removes the attribute again.
 * 3. The department pages' `generateViewport` derives the mobile `theme-color`.
 *
 * The attribute is set on the document element, not on a page wrapper, because
 * the shared header and footer are outside the page subtree and must follow the
 * theme too.
 */

/** Attribute carrying the active theme on `<html>`. */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * Resolve the department theme for a pathname, or `null` for corporate.
 *
 * The leading locale segment is skipped, then the first remaining segment is
 * matched against the department slugs. Any unrecognised value — an unknown
 * department, a corporate route, an admin route, a malformed path — returns
 * `null`, which is the robust fallback to the global theme.
 */
export function themeSlugFromPathname(pathname: string): DepartmentSlug | null {
  const segments = pathname.split("/").filter(Boolean);
  const start = segments[0] && isLocale(segments[0]) ? 1 : 0;
  const candidate = segments[start];
  return candidate && isDepartmentSlug(candidate) ? candidate : null;
}

/**
 * Self-contained bootstrap script for the root `<head>`.
 *
 * Deliberately dependency-free and minified: it runs synchronously before the
 * first paint, so anything it imports would be another round trip. The slug and
 * locale lists are injected from the same constants the runtime uses, so adding
 * a department cannot leave the bootstrap behind. It is wrapped in `try`/`catch`
 * so a browser with storage or scripting restrictions degrades to the corporate
 * theme rather than throwing during document parse.
 */
export function themeBootstrapScript(): string {
  const slugs = JSON.stringify(DEPARTMENT_SLUGS);
  const locales = JSON.stringify(LOCALES);
  return (
    "(function(){try{var s=" +
    slugs +
    ",l=" +
    locales +
    ',p=location.pathname.split("/").filter(Boolean),c=(p[0]&&l.indexOf(p[0])>-1)?p[1]:p[0];' +
    'if(c&&s.indexOf(c)>-1){document.documentElement.setAttribute("' +
    THEME_ATTRIBUTE +
    '",c);}}catch(e){}})();'
  );
}

/**
 * Mobile browser-chrome colour for a department, taken from the same tokens the
 * theme paints with. Matches the dark band at the top of a department page so
 * the browser chrome blends with the hero rather than showing the corporate ink.
 */
export function themeColorFor(slug: DepartmentSlug): string {
  return DEPARTMENT_THEME_TOKENS[slug].ink950;
}
