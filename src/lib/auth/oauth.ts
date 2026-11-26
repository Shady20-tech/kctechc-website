/**
 * Social sign-in providers.
 *
 * Which providers are offered is decided here and nowhere else. Google uses
 * Google Identity Services in the browser and exchanges the ID token with
 * `signInWithIdToken` when the public client id is configured; without it the
 * UI falls back to Supabase's server-side OAuth redirect, so the Google button
 * is never silently removed. Facebook always uses the redirect.
 *
 * A provider is *offered* only when the deployment says it is enabled. Supabase
 * keeps the provider secrets; the Google client ID is public and is read from
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Enabling a provider is therefore dashboard
 * configuration plus, for Google, one public environment variable.
 *
 * Google and Facebook are offered by default. The env flag exists so a
 * deployment can narrow the set, and it is still the honest gate for an
 * unconfigured provider: Supabase fails one with a raw `provider is not enabled`
 * error on the provider's own page, which is a dead end the visitor cannot act
 * on. A deployment that wants no social buttons sets the flag to a value that
 * names no supported provider, for example `none`.
 */

/** The providers this site supports, in the order they are presented. */
export const OAUTH_PROVIDERS = ["google", "facebook"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Providers that use the server-side `signInWithOAuth` redirect.
 *
 * Google uses Google Identity Services when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is
 * set, because that path shows the site's verified domain on the consent
 * screen. When the client id is absent the UI falls back to this redirect
 * rather than hiding Google, so the button is always available. Facebook
 * always uses the redirect.
 */
export const SERVER_OAUTH_PROVIDERS = ["google", "facebook"] as const;

export type ServerOAuthProvider = (typeof SERVER_OAUTH_PROVIDERS)[number];

/** Narrow an arbitrary string to a provider the server action may start. */
export function isServerOAuthProvider(
  value: unknown,
): value is ServerOAuthProvider {
  return (
    typeof value === "string" &&
    (SERVER_OAUTH_PROVIDERS as readonly string[]).includes(value)
  );
}

/** Providers offered when `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` is not set at all. */
const DEFAULT_ENABLED_PROVIDERS: readonly OAuthProvider[] = [
  "google",
  "facebook",
];

/** Narrow an arbitrary string to a supported provider. */
export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return (
    typeof value === "string" &&
    (OAUTH_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * Enabled providers, read from the environment.
 *
 * `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` is a comma-separated list, for example
 * `google,facebook`. Unknown names are ignored rather than trusted, so a typo
 * cannot render a button that fails at the provider.
 *
 * When the variable is absent or blank the site offers Google and Facebook,
 * because those are the providers it ships with. An explicit value narrows the
 * set, and a value that names no supported provider (`none`) hides every social
 * button, which is how a deployment turns the feature off.
 */
export function enabledOAuthProviders(
  raw: string | undefined = process.env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS,
): OAuthProvider[] {
  if (!raw || !raw.trim()) return [...DEFAULT_ENABLED_PROVIDERS];
  const requested = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return OAUTH_PROVIDERS.filter((provider) => requested.includes(provider));
}

/**
 * Where Supabase sends the browser back to for a server-side OAuth provider.
 *
 * Must be listed in the project's allowed redirect URLs, or Supabase refuses the
 * flow. The locale rides along so the visitor returns to their own language
 * rather than to the default one, and `/auth/callback` decides the destination
 * once it can see whether the account still needs to declare a role. `next` is
 * optional and is validated by the caller before it reaches this builder.
 */
export function oauthCallbackUrl(
  siteUrl: URL,
  locale: string,
  next?: string | null,
): string {
  const url = new URL("/auth/callback", siteUrl);
  url.searchParams.set("locale", locale);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
