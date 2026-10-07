import { LOCALES } from "../i18n/locales";

/**
 * Canonical paths and legacy redirects.
 *
 * `next.config.ts` is transpiled on its own before the `@/` path alias exists,
 * so this module must not import anything that uses that alias — it may only
 * reach leaf modules through relative paths. `../i18n/locales` qualifies: it is
 * a pure data module with no imports of its own. That is why the redirect table
 * lives here rather than beside the nav model in `navigation.ts`.
 *
 * Keeping one definition here means the header link and the redirect cannot
 * disagree about which URL is canonical.
 */

/** Canonical path for the articles section. */
export const INSIGHTS_PATH = "/insights";

/**
 * Canonical path for the Digital Marketing store.
 *
 * Kept here rather than in the store module so `next.config.ts` can import it
 * without pulling in a dependency chain, exactly as `INSIGHTS_PATH` is.
 */
export const STORE_PATH = "/digital-marketing/store";

/**
 * Canonical path for the Nationwide Real Estate department.
 *
 * The department is addressed as a sibling of the other departments under the
 * active locale, so the gateway link and the redirect table agree on one URL.
 */
export const REAL_ESTATE_PATH = "/real-estate";

/** The property browse, filter and search surface. */
export const PROPERTY_SEARCH_PATH = "/real-estate/listings";

/**
 * The Electrical Services solar-packages surface.
 *
 * Sits under the department (`/electrical-services/packages`) because it is that
 * department's commercial catalogue. Kept here so `next.config.ts` and the nav
 * model can import it without a dependency chain.
 */
export const SOLAR_PACKAGES_PATH = "/electrical-services/packages";

/**
 * The browse surface's former path.
 *
 * Phase 6 shipped the browser at `/real-estate/properties` and the department
 * landing page linked to it, so the URL is live in bookmarks and possibly in an
 * index. `/listings` is the canonical name — the page lists and filters listings,
 * and "properties" read as a second department name beside Real Estate — so the
 * old path redirects rather than being dropped.
 */
const LEGACY_PROPERTY_PATH = "/real-estate/properties";

/** The articles section's former path, still linked from Phase 2 pages. */
const LEGACY_INSIGHTS_PATH = "/blog";

/**
 * Legacy paths that must keep working, each mapped to its canonical equivalent.
 *
 * Phase 2 shipped the section at `/blog` and linked to it as `/${locale}/blog`,
 * so both the bare and the locale-prefixed URLs were live and may be indexed or
 * bookmarked. Both forms are redirected: covering only the bare path would leave
 * every localized URL returning 404.
 */
export const LEGACY_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: LEGACY_INSIGHTS_PATH, to: INSIGHTS_PATH },
  ...LOCALES.map((locale) => ({
    from: `/${locale}${LEGACY_INSIGHTS_PATH}`,
    to: `/${locale}${INSIGHTS_PATH}`,
  })),
  // The property browser's old path, both bare and locale-prefixed. A listing
  // detail page keeps working under either path because the detail route also
  // moves, so the redirect is written for the subtree.
  { from: LEGACY_PROPERTY_PATH, to: PROPERTY_SEARCH_PATH },
  { from: `${LEGACY_PROPERTY_PATH}/:slug`, to: `${PROPERTY_SEARCH_PATH}/:slug` },
  ...LOCALES.flatMap((locale) => [
    { from: `/${locale}${LEGACY_PROPERTY_PATH}`, to: `/${locale}${PROPERTY_SEARCH_PATH}` },
    {
      from: `/${locale}${LEGACY_PROPERTY_PATH}/:slug`,
      to: `/${locale}${PROPERTY_SEARCH_PATH}/:slug`,
    },
  ]),
];
