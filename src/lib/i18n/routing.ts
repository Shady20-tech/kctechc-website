import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales";

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

/**
 * Paths the locale rewrite must never touch, matched by prefix.
 *
 * These are the root-level metadata routes and asset directories. They have no
 * localized variant, so rewriting them to `/{locale}{path}` produces a 404 while
 * the page itself still renders — a silent failure that shows up only as console
 * errors and a missing manifest.
 *
 * `manifest.webmanifest` is here for exactly that reason: it was missed, because
 * the extension list below did not include `webmanifest`, so every page load
 * logged two 404s and the browser could not read the manifest.
 *
 * These lists are the *declared intent*. Next.js requires the matcher to be a
 * static string literal, so it cannot be generated from them at runtime — the
 * literal lives in `src/proxy.ts` and `src/proxy.test.ts` asserts that the real
 * pattern excludes everything listed here. That test is what keeps the two in
 * step; without it the lists would be documentation that quietly goes stale.
 */
export const NON_LOCALIZED_EXACT_PATHS = [
  "_next/static",
  "_next/image",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
] as const;

/** File extensions that are assets, never localized pages. */
export const NON_LOCALIZED_EXTENSIONS = [
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "ico",
  "webmanifest",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "css",
  "js",
  "map",
  "txt",
  "xml",
] as const;

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
    pathWithoutLocale === "/"
      ? ""
      : `/${pathWithoutLocale.replace(/^\/+/, "")}`;
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
