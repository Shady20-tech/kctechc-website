/**
 * Validated environment access.
 *
 * Public values are read at build time from `NEXT_PUBLIC_*`. Server-only secrets
 * are read lazily and never bundled into client code: importing a secret from a
 * module that a Client Component also imports would leak it, so secret access is
 * isolated in `server-env.ts`.
 */

function readPublic(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const publicEnv = {
  siteUrl: readPublic(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  defaultLocale: readPublic(process.env.NEXT_PUBLIC_DEFAULT_LOCALE, "en"),
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "",
  mapProvider: readPublic(process.env.NEXT_PUBLIC_MAP_PROVIDER, "openfreemap"),
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  tolgeeApiUrl: readPublic(
    process.env.NEXT_PUBLIC_TOLGEE_API_URL,
    "https://app.tolgee.io",
  ),
  tolgeeProjectId: process.env.NEXT_PUBLIC_TOLGEE_PROJECT_ID?.trim() ?? "",
} as const;

/**
 * Absolute base URL used for canonical links, sitemaps and OG images.
 * Falls back to localhost so builds never fail when the variable is absent.
 */
export function getSiteUrl(): URL {
  try {
    return new URL(publicEnv.siteUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

/**
 * Supabase may legitimately be unconfigured in a fresh checkout. Callers must
 * handle `null` explicitly rather than silently talking to an undefined host.
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) return null;
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabasePublishableKey };
}

export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;
