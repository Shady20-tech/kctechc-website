import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { BRAND_COLORS } from "@/lib/config/site";

/**
 * PWA installability contract.
 *
 * Chromium will not offer installation without a 192px and a 512px icon, and will
 * not mint a WebAPK without a `maskable` one. A mistyped icon path is the worst
 * kind of failure: nothing errors, the page renders, and the only symptom is that
 * the install prompt never appears — which is indistinguishable from "the visitor
 * is not eligible yet".
 *
 * These assertions resolve every declared path on disk and check the actual pixel
 * dimensions, because `sizes: "512x512"` in the manifest is a claim about a file
 * rather than a description of it.
 */

const PUBLIC = join(process.cwd(), "public");

/** Read PNG dimensions straight from the IHDR chunk — no image dependency. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  // 8-byte signature, then a 4-byte length, the `IHDR` tag, and the dimensions.
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("web app manifest", () => {
  const m = manifest();

  it("declares the fields Chromium requires for installation", () => {
    // Each of these is independently required; a missing one disables the prompt.
    expect(m.name || m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.icons?.length).toBeGreaterThan(0);
  });

  it("has a 192px and a 512px icon", () => {
    const sizes = (m.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("has a maskable icon, or Android shows a white padding box", () => {
    const maskable = (m.icons ?? []).filter(
      (icon) => icon.purpose === "maskable",
    );
    expect(maskable.length).toBeGreaterThan(0);
  });

  it("resolves every icon path on disk at its declared size", () => {
    for (const icon of m.icons ?? []) {
      const src = String(icon.src);
      const file = join(PUBLIC, src.replace(/^\//, ""));
      expect(() => statSync(file), `missing file for ${src}`).not.toThrow();

      const { width, height } = pngSize(file);
      expect(`${width}x${height}`, `declared size for ${src}`).toBe(icon.sizes);
    }
  });

  it("agrees with the root viewport theme colour", () => {
    // Both paint the same chrome — the manifest on Android around an installed
    // app, the viewport meta in the mobile browser bar — so a divergence shows as
    // a seam between the two. The layout is read as source rather than imported,
    // because importing it pulls `next/font` in and that cannot load under Vitest.
    const layout = readFileSync(
      join(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("themeColor: BRAND_COLORS.ink");
    expect(m.theme_color).toBe(BRAND_COLORS.ink);
  });

  it("starts at the language-neutral gateway, not a locale", () => {
    // An installed app that opens `/en` would have made the install itself a
    // language decision.
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
  });
});

describe("service worker", () => {
  const source = readFileSync(join(PUBLIC, "sw.js"), "utf8");

  it("is served as a static file from public/", () => {
    // It must not go through the bundler: it needs the site root as its scope and
    // a stable `/sw.js` URL for the registration call.
    expect(() => statSync(join(PUBLIC, "sw.js"))).not.toThrow();
  });

  it("registers a fetch handler, which installability requires", () => {
    expect(source).toContain('addEventListener("fetch"');
  });

  it("never caches authenticated or API surfaces", () => {
    // A cached `/admin` or `/api` response would be served to the next visitor on
    // a shared device. This is the one mistake here that is a security problem
    // rather than a staleness one.
    expect(source).toContain("/api/");
    expect(source).toContain("/admin");
    expect(source).toContain("/auth");
    expect(source).toContain("NEVER_CACHE");
  });

  it("precaches the offline page", () => {
    expect(source).toContain("/en/offline");
    expect(source).toContain("/fr/offline");
    expect(source).toContain("cache.addAll");
  });

  it("deletes caches from previous versions on activate", () => {
    // Without this a changed caching strategy keeps serving entries written by
    // the old one, which is the classic "why is production stale" bug.
    expect(source).toContain("caches.keys()");
    expect(source).toContain("caches.delete");
  });

  it("only intercepts GET requests", () => {
    expect(source).toContain('request.method !== "GET"');
  });

  it("leaves cross-origin requests alone", () => {
    // Supabase, Tolgee and analytics must not be proxied by this worker.
    expect(source).toContain("url.origin !== self.location.origin");
  });
});

describe("offline route", () => {
  it("exists as a localized page", () => {
    const page = join(
      process.cwd(),
      "src/app/(site)/[locale]/offline/page.tsx",
    );
    expect(() => statSync(page)).not.toThrow();
    // `noindex` matters: a crawler must not list "you are offline" as a page.
    expect(readFileSync(page, "utf8")).toContain("index: false");
  });
});

/**
 * Where the two client pieces are mounted is a real decision, not a detail.
 *
 * The service worker's scope is `/`, so it controls the console whether or not
 * the console registers it; the registration must therefore exist on every route
 * (the root layout), and the *worker* is what excludes `/admin`. The banner is
 * the opposite: it must cover the language-neutral gateway and must not cover the
 * console, which is exactly the `(site)` group. Mounting either in the wrong
 * place produces no error — a console with a floating install banner, or a
 * gateway with no way to install — so both are pinned here.
 */
describe("PWA wiring", () => {
  const read = (relative: string) =>
    readFileSync(join(process.cwd(), relative), "utf8");

  it("registers the worker from the root layout, so the console is covered", () => {
    expect(read("src/app/layout.tsx")).toContain("ServiceWorkerRegistration");
  });

  it("does not register the worker from the site group", () => {
    // A second registration would be redundant, and its absence is what makes the
    // root-layout placement the single source. Match the JSX usage, not the bare
    // name — the layout's comment explains *why* it is not here, and a substring
    // check would fail on its own documentation.
    expect(read("src/app/(site)/layout.tsx")).not.toContain(
      "<ServiceWorkerRegistration",
    );
  });

  it("renders the install banner from the site group, not the root layout", () => {
    expect(read("src/app/(site)/layout.tsx")).toContain("<InstallPrompt />");
    // The root layout is above the `(static)` admin tree, so a banner there would
    // float over the console.
    expect(read("src/app/layout.tsx")).not.toContain("<InstallPrompt />");
  });

  it("derives the banner's locale from the path, not a prop", () => {
    // The gateway `/` has no locale segment, and reading headers would make it
    // dynamic, so the path is the only signal available in both places.
    expect(read("src/components/layout/InstallPrompt.tsx")).toContain(
      "stripLocaleFromPath",
    );
  });

  it("allows the worker and manifest through the CSP", () => {
    // Without `worker-src` the registration is refused by the default-src
    // fallback, and the install prompt never appears — with no visible error.
    const headers = read("src/lib/security/headers.ts");
    expect(headers).toContain("worker-src");
    expect(headers).toContain("manifest-src");
  });
});
