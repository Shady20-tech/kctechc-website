import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  type Locale,
} from "./locales";

/**
 * Path helpers shared by `src/proxy.ts`, server components and the language
 * switcher. Keeping them in one place is what lets a language switch preserve
 * the current route instead of dumping the visitor back on the home page.
 */

/** Route prefixes that are never locale-scoped. */
export const NON_LOCALIZED_PREFIXES = ["/admin", "/api", "/auth"] as const;

export function isNonLocalizedPath(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Split `/en/real-estate` into its locale and the locale-relative path. */
export function stripLocaleFromPath(pathname: string): {
  locale: Locale | null;
  pathWithoutLocale: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && isLocale(first)) {
    const rest = segments.slice(1).join("/");
    return { locale: first, pathWithoutLocale: rest ? `/${rest}` : "/" };
  }
  return { locale: null, pathWithoutLocale: pathname || "/" };
}

export function withLocale(locale: Locale, pathWithoutLocale: string): string {
  const normalized =
    pathWithoutLocale === "/" ? "" : `/${pathWithoutLocale.replace(/^\/+/, "")}`;
  return `/${locale}${normalized}`;
}

/**
 * Query parameters that are safe to carry across a language switch. Tracking
 * parameters are dropped so switching language cannot manufacture duplicate
 * indexable URLs, and free-text search is preserved because it is user intent.
 */
const PRESERVED_QUERY_PARAMS = ["q", "page", "sort"] as const;

export function filterSwitchableSearchParams(
  searchParams: URLSearchParams,
): string {
  const filtered = new URLSearchParams();
  for (const key of PRESERVED_QUERY_PARAMS) {
    const value = searchParams.get(key);
    if (value) filtered.set(key, value);
  }
  const serialized = filtered.toString();
  return serialized ? `?${serialized}` : "";
}

/** Build the equivalent URL in another locale, preserving route and query. */
export function buildLocaleSwitchHref(
  currentPathname: string,
  currentSearch: string,
  targetLocale: Locale,
): string {
  const { pathWithoutLocale } = stripLocaleFromPath(currentPathname);
  const query = filterSwitchableSearchParams(
    new URLSearchParams(currentSearch),
  );
  return `${withLocale(targetLocale, pathWithoutLocale)}${query}`;
}

/**
 * Reciprocal `hreflang` alternates. `x-default` points at the language-neutral
 * corporate gateway at `/`, which is the correct signal for "no language
 * preference" rather than defaulting a crawler into English.
 */
export function buildLocaleAlternates(
  pathWithoutLocale: string,
  siteUrl: URL,
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) {
    alternates[locale] = new URL(
      withLocale(locale, pathWithoutLocale),
      siteUrl,
    ).toString();
  }
  alternates["x-default"] = new URL("/", siteUrl).toString();
  return alternates;
}

export { DEFAULT_LOCALE, LOCALES, isLocale };
export type { Locale };
