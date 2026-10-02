/**
 * Content-Security-Policy for the public site.
 *
 * `connect-src` allows Supabase (auth + REST) and Tolgee, which are the only
 * outbound calls the browser makes. `frame-ancestors 'none'` is a stronger
 * clickjacking defence than X-Frame-Options alone.
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
}): string {
  const connectSources = ["'self'"];
  if (options.supabaseUrl) connectSources.push(options.supabaseUrl);
  if (options.tolgeeApiUrl) connectSources.push(options.tolgeeApiUrl);
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
    `connect-src ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
