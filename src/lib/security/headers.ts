/**
 * Content-Security-Policy for the public site.
 *
 * `connect-src` allows Supabase (auth + REST), Tolgee and the map tile origin,
 * which are the only outbound calls the browser makes. `frame-ancestors 'none'`
 * is a stronger clickjacking defence than X-Frame-Options alone.
 *
 * The map origin is required, not optional. `PropertyMap` fetches a MapLibre
 * style and its vector tiles from `tiles.openfreemap.org`; without that host the
 * style request is refused by CSP, MapLibre never fires `load`, the component's
 * timeout marks the map unavailable, and the visitor sees "the map could not be
 * loaded" over a page whose list is fine. Nothing in the page source or in a unit
 * test shows the cause — the request only exists at runtime.
 *
 * MapLibre also spawns its worker from a blob URL, so `worker-src` must admit
 * `blob:` alongside the service worker's `'self'`.
 *
 * Google Analytics is allowed only when `analyticsEnabled` is set, which the
 * caller derives from `NEXT_PUBLIC_GA_MEASUREMENT_ID`. `src/lib/analytics/track.ts`
 * loads `gtag.js` from `googletagmanager.com` and gtag beacons to
 * `google-analytics.com`; without those hosts in `script-src` and `connect-src`
 * the script is blocked and the whole measurement layer silently reports
 * nothing — the script tag is added at runtime, so the failure never appears in
 * the page source or in any unit test. Gating on the flag keeps a deployment with
 * no measurement id from carrying the allowance at all.
 */
export function buildContentSecurityPolicy(options: {
  supabaseUrl: string | null;
  tolgeeApiUrl: string;
  isDevelopment: boolean;
  /** True when GA4 is configured; only then are Google's hosts allowed. */
  analyticsEnabled?: boolean;
  /**
   * Origin serving MapLibre styles and vector tiles. Defaults to OpenFreeMap,
   * which is the adapter's default provider.
   */
  mapTileOrigin?: string;
}): string {
  const connectSources = ["'self'"];
  if (options.supabaseUrl) connectSources.push(options.supabaseUrl);
  if (options.tolgeeApiUrl) connectSources.push(options.tolgeeApiUrl);
  connectSources.push(options.mapTileOrigin ?? "https://tiles.openfreemap.org");
  if (options.isDevelopment) connectSources.push("ws:", "wss:");

  const scriptSources = ["'self'", "'unsafe-inline'"];
  // Next.js dev mode and React refresh evaluate strings; never allow this in
  // production builds.
  if (options.isDevelopment) scriptSources.push("'unsafe-eval'");

  if (options.analyticsEnabled) {
    scriptSources.push("https://www.googletagmanager.com");
    connectSources.push(
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
    );
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // The service worker at `/sw.js` is fetched under `worker-src`, which falls
    // back to `child-src` and then `script-src` when absent. Stated explicitly so
    // a future narrowing of `script-src` cannot silently make the site
    // uninstallable — the failure would be a console CSP error and no install
    // prompt, with nothing else to go on. `blob:` is for MapLibre, which builds
    // its tile worker from a blob URL.
    "worker-src 'self' blob:",
    `connect-src ${connectSources.join(" ")}`,
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
