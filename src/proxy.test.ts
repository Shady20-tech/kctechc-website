import { describe, expect, it } from "vitest";

import { config } from "@/proxy";
import {
  NON_LOCALIZED_EXACT_PATHS,
  NON_LOCALIZED_EXTENSIONS,
} from "@/lib/i18n/routing";

/**
 * Locale-rewrite exclusions.
 *
 * The proxy rewrites every un-prefixed public path to `/{locale}{path}`. That is
 * correct for pages and catastrophic for root-level metadata routes, which have
 * no localized variant: `/manifest.webmanifest` was rewritten to
 * `/en/manifest.webmanifest`, which is a 404. Nothing failed loudly — the page
 * still rendered — but every page load logged two 404s and the browser could not
 * read the manifest. That is a real defect and a best-practices failure.
 *
 * Next.js requires the matcher to be a static literal, so it cannot be generated
 * from the declared lists in `routing.ts`. These tests close that gap from the
 * other side: they evaluate the *real* pattern in `src/proxy.ts` against every
 * path and extension the lists declare, so adding a metadata route without
 * updating the pattern fails here instead of in production console logs.
 */

function matcher(): string {
  const pattern = config.matcher?.[0];
  if (!pattern) throw new Error("proxy matcher is missing");
  return pattern;
}

/**
 * Evaluate the matcher the way Next.js does.
 *
 * The pattern is `/{group}`, and the leading `/` is matched literally *before*
 * the lookahead runs — so the exclusion alternatives are compared against the
 * path with its leading slash already consumed. `_next/static`, not
 * `/_next/static`. Emulating that here matters: testing the raw pattern against a
 * slash-prefixed path silently defeats every literal exclusion and leaves only
 * the extension list doing any work, which made a broken test look reassuring.
 */
function isRewritten(pathname: string): boolean {
  const body = pathname.replace(/^\//, "");
  // `matcher()` is `/((?!…).*)`; dropping the literal `/` leaves the group, which
  // is then anchored against the slash-less path.
  return new RegExp(`^${matcher().slice(1)}$`).test(body);
}

describe("proxy locale-rewrite exclusions", () => {
  it("never rewrites the web manifest", () => {
    // The regression. The manifest is a root metadata route with no localized
    // counterpart, so rewriting it produced a 404 on every page load.
    expect(isRewritten("/manifest.webmanifest")).toBe(false);
  });

  it.each([...NON_LOCALIZED_EXACT_PATHS].map((path) => `/${path}`))(
    "never rewrites the declared metadata route %s",
    (pathname) => {
      expect(isRewritten(pathname)).toBe(false);
    },
  );

  it.each([...NON_LOCALIZED_EXTENSIONS].map((ext) => `/some/file.${ext}`))(
    "never rewrites a %s asset path",
    (pathname) => {
      expect(isRewritten(pathname)).toBe(false);
    },
  );

  it.each([
    "/brand/kc-monogram.png",
    "/hero/corporate-v2.jpg",
    "/icon.png",
    "/apple-icon.png",
    "/fonts/inter.woff2",
    "/styles/site.css",
    "/chunks/app.js",
  ])("never rewrites the asset %s", (pathname) => {
    expect(isRewritten(pathname)).toBe(false);
  });

  it.each([
    "/",
    "/en",
    "/fr/terms",
    "/real-estate",
    "/store/product/example",
    "/en/insights/some-article",
    "/privacy",
  ])("still rewrites the public page %s", (pathname) => {
    expect(isRewritten(pathname)).toBe(true);
  });

  it("excludes every extension the metadata routes and assets use", () => {
    // `webmanifest` was the gap. Enumerated so the intent survives a refactor of
    // the list itself, independently of the loop above.
    for (const ext of [
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
    ]) {
      expect(NON_LOCALIZED_EXTENSIONS).toContain(ext);
      expect(matcher()).toContain(ext);
    }
  });
});
