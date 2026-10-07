import "server-only";

import { SITE } from "@/lib/config/site";

/**
 * Server-only secrets. `import "server-only"` makes any accidental import from a
 * Client Component a build error, which is the guard that keeps the Supabase
 * service-role key and provider secrets out of client bundles.
 */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export const serverEnv = {
  supabaseServiceRoleKey: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  /** Salt for hashing submitter IPs. Rotating it invalidates past hashes. */
  inquiryIpSalt: optional(process.env.INQUIRY_IP_SALT),
  tolgeeApiKey: optional(process.env.TOLGEE_API_KEY),
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
