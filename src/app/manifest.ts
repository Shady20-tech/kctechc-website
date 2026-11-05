import type { MetadataRoute } from "next";

import { BRAND_COLORS, SITE } from "@/lib/config/site";

/**
 * Web app manifest.
 *
 * The icons are what make the site installable at all: Chromium requires a 192px
 * and a 512px icon before it will offer installation or mint a WebAPK, and it
 * refuses to mint one without a `maskable` entry. `public/icons/` is generated
 * from the brand mark — see `src/lib/config/pwa-icons.test.ts`, which asserts
 * every path here resolves on disk at the declared size. A mistyped icon path
 * fails silently as an uninstallable app, with no error anywhere.
 *
 * `start_url` is `/`, the language-neutral gateway, not a locale. The gateway is
 * the one URL that is correct for every visitor, and it offers the language
 * choice rather than guessing; sending an installed app straight to `/en` would
 * make the install itself a language decision.
 *
 * `scope` is `/` so in-app navigation stays inside the installed window. Without
 * it the scope defaults to the directory of `start_url`, which is `/` here, so
 * this is explicit rather than load-bearing — it documents the intent.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.legalName,
    short_name: SITE.shortName,
    description:
      "Digital marketing, electrical services and real estate across Cameroon.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: BRAND_COLORS.ink,
    lang: "en",
    dir: "ltr",
    categories: ["business", "shopping", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android crops a maskable icon to the launcher's own shape, so the mark
        // is drawn inside the safe zone on the ink band. Without a maskable entry
        // Chrome adds a white padding rectangle instead, which looks broken
        // against a dark launcher.
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Departments", url: "/en" },
      { name: "Store", url: "/en/digital-marketing/store" },
      { name: "Property listings", url: "/en/real-estate/listings" },
    ],
  };
}
