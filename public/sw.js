/*
 * KC Technology Corporation service worker.
 *
 * Two jobs, in this order of importance:
 *
 * 1. Make the site installable. Chromium requires a service worker with a
 *    `fetch` handler before it will fire `beforeinstallprompt` or mint a WebAPK,
 *    so without this file "Add to Home screen" degrades to a plain bookmark.
 * 2. Serve a real offline page instead of the browser's error screen.
 *
 * It is deliberately conservative, because this runs on a live site and a
 * caching bug here is worse than no service worker at all:
 *
 *   * `/api`, `/admin`, `/auth` and the customer auth pages (`/login`,
 *     `/sign-up`, `/forgot-password`, `/reset-password`) are never touched. A
 *     cached authenticated response would be served to the next visitor on a
 *     shared device, a cached admin page could show stale operational data, and
 *     a cached auth form could show a stale error or success state.
 *   * Only build-hashed `/_next/static` assets are cache-first. Their filenames
 *     change whenever their contents do, so a stale entry is impossible.
 *   * Navigations are network-first, so a deployed change is picked up on the
 *     next load and the cache is only a fallback.
 *   * Non-OK responses are never cached, so a transient 500 cannot become
 *     permanent.
 *
 * Plain JavaScript in `public/` on purpose: it is served as a static file at
 * `/sw.js` and must not go through the bundler, and the scope it needs is the
 * site root.
 */

const VERSION = "v1";
const STATIC_CACHE = `kc-static-${VERSION}`;

// Both localized offline pages are precached by their concrete URLs rather than
// the un-prefixed `/offline`. That route is rewritten by `src/proxy.ts` to a
// locale, so precaching it would depend on redirect-following semantics in
// `cache.addAll` and would pin every visitor to whichever language the proxy
// guessed for the worker's own request. Naming the two pages keeps the fallback
// in the visitor's language.
const OFFLINE_PAGES = { en: "/en/offline", fr: "/fr/offline" };

// Path segments the worker must never intercept. The map is matched both at the
// root (`/admin`) and after a locale segment (`/en/account`), because the
// localized dashboard and auth pages are the same private surfaces.
const NEVER_CACHE_SEGMENTS = new Set([
  "api",
  "admin",
  "auth",
  "account",
  "login",
  "sign-up",
  "forgot-password",
  "reset-password",
]);

function isPrivatePath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (NEVER_CACHE_SEGMENTS.has(segments[0])) return true;
  return (
    (segments[0] === "en" || segments[0] === "fr") &&
    segments.length > 1 &&
    NEVER_CACHE_SEGMENTS.has(segments[1])
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Precache the offline pages so the fallback works on the very first
      // offline visit, not only after one has been seen once.
      await cache.addAll(Object.values(OFFLINE_PAGES));
      // Take over as soon as possible; there is no in-flight state worth
      // preserving across a version bump.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions, so a changed strategy cannot keep
      // serving entries written by the old one.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("kc-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable. A POST is a mutation and must always reach the server.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (Supabase, Tolgee, analytics) is left entirely alone: this
  // worker has no business proxying another origin's responses.
  if (url.origin !== self.location.origin) return;

  // Authenticated or personal surfaces, and every API route, go straight to the
  // network with no cache read and no cache write. This covers both `/admin` and
  // the localized `/{locale}/account` dashboards.
  if (isPrivatePath(url.pathname)) return;

  // Build-hashed assets are immutable, so cache-first is safe and fastest.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Page navigations: network-first, with the offline page as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Nothing cached for this URL. Fall back to the offline page in the
    // visitor's own language, derived from the failed URL's locale prefix.
    const locale = new URL(request.url).pathname.startsWith("/fr")
      ? "fr"
      : "en";
    const offline = await cache.match(OFFLINE_PAGES[locale]);
    if (offline) return offline;

    // Nothing cached at all: a plain 503 beats a rejected promise, which would
    // surface as a network error page.
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain" },
    });
  }
}
