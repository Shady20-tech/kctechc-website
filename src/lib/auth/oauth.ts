/**
 * Social sign-in providers.
 *
 * Which providers are offered is decided here and nowhere else. The list is
 * closed on purpose: `signInWithOAuthProviderAction` validates the submitted
 * provider against {@link OAUTH_PROVIDERS}, so a crafted POST cannot ask Supabase
 * to start a flow for a provider this deployment has not configured.
 *
 * A provider is *offered* only when the deployment says it is enabled. Supabase
 * keeps the client ids and secrets; nothing secret reaches this module or the
 * browser. Enabling a provider is therefore dashboard configuration, not a code
 * change.
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
 * Where Supabase sends the browser back to.
 *
 * Must be listed in the project's allowed redirect URLs, or Supabase refuses the
 * flow. The locale rides along so the visitor returns to their own language
 * rather than to the default one, and `/auth/callback` decides the destination
 * once it can see whether the account still needs to declare a role.
 */
export function oauthCallbackUrl(siteUrl: URL, locale: string): string {
  const url = new URL("/auth/callback", siteUrl);
  url.searchParams.set("locale", locale);
  return url.toString();
}
