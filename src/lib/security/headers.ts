/**
 * Content-Security-Policy for the public site.
 *
 * `connect-src` allows Supabase (auth + REST) and Tolgee, which are the only
 * outbound calls the browser makes. `frame-ancestors 'none'` is a stronger
 * clickjacking defence than X-Frame-Options alone.
 */
export function buildContentSecurityPolicy(options: {
  supabaseUrl: string | null;
  tolgeeApiUrl: string;
  isDevelopment: boolean;
}): string {
  const connectSources = ["'self'"];
  if (options.supabaseUrl) connectSources.push(options.supabaseUrl);
  if (options.tolgeeApiUrl) connectSources.push(options.tolgeeApiUrl);
  if (options.isDevelopment) connectSources.push("ws:", "wss:");

  const scriptSources = ["'self'", "'unsafe-inline'"];
  // Next.js dev mode and React refresh evaluate strings; never allow this in
  // production builds.
  if (options.isDevelopment) scriptSources.push("'unsafe-eval'");

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
