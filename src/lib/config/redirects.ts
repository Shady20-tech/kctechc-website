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
];
