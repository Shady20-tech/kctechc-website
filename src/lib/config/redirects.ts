/**
 * Canonical paths and legacy redirects.
 *
 * Deliberately dependency-free. `next.config.ts` is transpiled on its own before
 * the application modules exist, so anything it imports must not pull in a chain
 * of aliased application imports — which is why this lives apart from
 * `navigation.ts` rather than beside the nav model that also needs these values.
 *
 * Keeping one definition here means the header link and the redirect cannot
 * disagree about which URL is canonical.
 */

/** Canonical path for the articles section. */
export const INSIGHTS_PATH = "/insights";

/**
 * Legacy paths that must keep working. Each maps to the canonical path it now
 * redirects to; `next.config.ts` issues a permanent redirect for every entry.
 */
export const LEGACY_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: "/blog", to: INSIGHTS_PATH },
];
