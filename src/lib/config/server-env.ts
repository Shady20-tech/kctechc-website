import "server-only";

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
  tolgeeApiKey: optional(process.env.TOLGEE_API_KEY),
  resendApiKey: optional(process.env.RESEND_API_KEY),
  emailFrom: optional(process.env.EMAIL_FROM),
  emailContactTo: optional(process.env.EMAIL_CONTACT_TO),
  paymentProvider: optional(process.env.PAYMENT_PROVIDER),
  flutterwavePublicKey: optional(process.env.FLUTTERWAVE_PUBLIC_KEY),
  flutterwaveSecretKey: optional(process.env.FLUTTERWAVE_SECRET_KEY),
  flutterwaveWebhookSecret: optional(process.env.FLUTTERWAVE_WEBHOOK_SECRET),
} as const;

/**
 * Payments stay disabled until real credentials exist. Code paths must branch on
 * this rather than simulating a successful charge.
 */
export const isPaymentProviderConfigured = (): boolean =>
  serverEnv.flutterwaveSecretKey !== null &&
  serverEnv.flutterwavePublicKey !== null;

export const isTolgeeServerConfigured = (): boolean =>
  serverEnv.tolgeeApiKey !== null;

export const isEmailConfigured = (): boolean => serverEnv.resendApiKey !== null;
