import "server-only";

import { SITE } from "@/lib/config/site";
import { normalizeTolgeeApiUrl } from "@/lib/tolgee/url";

/**
 * Server-only secrets. `import "server-only"` makes any accidental import from a
 * Client Component a build error, which is the guard that keeps the Supabase
 * service-role key and provider secrets out of client bundles.
 */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function optionalTolgeeUrl(value: string | undefined): string | null {
  const raw = optional(value);
  return raw ? normalizeTolgeeApiUrl(raw) : null;
}

export type SupabaseServerKeySource =
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_SECRET_KEY"
  | null;

export type SupabaseServerKeyType = "legacy_jwt" | "secret" | "unknown" | null;

export type ResolvedSupabaseServerKey = {
  key: string | null;
  source: SupabaseServerKeySource;
  type: SupabaseServerKeyType;
};

function serverKeyType(key: string | null): SupabaseServerKeyType {
  if (!key) return null;
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("eyJ")) return "legacy_jwt";
  return "unknown";
}

/**
 * The one server-key resolver.
 *
 * Supabase calls the server key two things depending on project age: the legacy
 * `service_role` JWT, and the newer `sb_secret_…` key. The dashboard's newer
 * wording is "secret key", and operators naturally name the variable after it,
 * so accept either name rather than reporting a configured deployment as
 * unconfigured. `SUPABASE_SERVICE_ROLE_KEY` wins when both are set.
 *
 * Every server consumer — the admin client factory, the health probe and the
 * admin actions — must read this function rather than `process.env` directly, so
 * a new key name cannot be honoured in one place and ignored in another.
 */
export function resolveSupabaseServerKey(
  env: Record<string, string | undefined> = process.env,
): ResolvedSupabaseServerKey {
  const legacyServiceRoleKey = optional(env.SUPABASE_SERVICE_ROLE_KEY);
  const secretKey = optional(env.SUPABASE_SECRET_KEY);
  const key = legacyServiceRoleKey ?? secretKey;

  return {
    key,
    source: legacyServiceRoleKey
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : secretKey
        ? "SUPABASE_SECRET_KEY"
        : null,
    type: serverKeyType(key),
  };
}

const resolvedServerKey = resolveSupabaseServerKey();

export const serverEnv = {
  supabaseServiceRoleKey: resolvedServerKey.key,
  supabaseServiceRoleKeySource: resolvedServerKey.source,
  supabaseServiceRoleKeyType: resolvedServerKey.type,
  /** Salt for hashing submitter IPs. Rotating it invalidates past hashes. */
  inquiryIpSalt: optional(process.env.INQUIRY_IP_SALT),
  tolgeeApiKey: optional(process.env.TOLGEE_API_KEY),
  /**
   * Optional server-only overrides for the sync worker. The browser runtime uses
   * the `NEXT_PUBLIC_*` pair, but a server-only deployment can keep the project
   * id and API base out of the client bundle. A server-only value wins when both
   * are set; the public value is the fallback.
   */
  // Keep null when absent so the public URL remains the fallback; normalize
  // when present so an accidental /v2 or /projects/... path cannot survive.
  tolgeeApiUrl: optionalTolgeeUrl(process.env.TOLGEE_API_URL),
  tolgeeProjectId: optional(process.env.TOLGEE_PROJECT_ID),
  resendApiKey: optional(process.env.RESEND_API_KEY),
  emailFrom: optional(process.env.EMAIL_FROM),
  emailContactTo: optional(process.env.EMAIL_CONTACT_TO),
  /**
   * Operational inboxes that receive order notifications (comma- or
   * semicolon-separated). Kept server-only so an address is never hardcoded into
   * a client bundle. When unset, notifications fall back to the public contact
   * address in `SITE.email`.
   */
  ordersNotifyTo: optional(process.env.ORDERS_NOTIFY_TO),
  /** Bot verification (Turnstile/hCaptcha). Absent means the check is skipped. */
  botVerificationSecretKey: optional(process.env.BOT_VERIFICATION_SECRET_KEY),
  botVerificationEndpoint: optional(process.env.BOT_VERIFICATION_ENDPOINT),
} as const;

export const isTolgeeServerConfigured = (): boolean =>
  serverEnv.tolgeeApiKey !== null;

/** True when a server-side Supabase secret key is present, whatever its name. */
export const isSupabaseAdminConfigured = (): boolean =>
  serverEnv.supabaseServiceRoleKey !== null;

export const isEmailConfigured = (): boolean => serverEnv.resendApiKey !== null;

/**
 * Recipients for a new-order notification.
 *
 * `ORDERS_NOTIFY_TO` wins when set (so an operator can route orders to a shared
 * mailbox); otherwise every public contact address receives it, so an order is
 * never left without an owner on a deployment that never set the variable.
 */
export function orderNotificationRecipients(): string[] {
  const configured = serverEnv.ordersNotifyTo
    ?.split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return configured && configured.length > 0 ? configured : [...SITE.emails];
}
