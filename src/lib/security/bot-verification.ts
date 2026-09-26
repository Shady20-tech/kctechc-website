import "server-only";

import { serverEnv } from "@/lib/config/server-env";

/**
 * Bot-verification seam.
 *
 * The existing controls — honeypot, rate limit, service-role write — stop naive
 * form spam, but none of them verifies that a human is present. This module is
 * the single place a real verification provider (Cloudflare Turnstile, hCaptcha,
 * reCAPTCHA) plugs in, so that can be added without touching the inquiry action.
 *
 * The current behaviour is deliberate: with no provider configured the check
 * returns `unconfigured` and the caller proceeds using the existing controls. It
 * does NOT pretend verification happened, and it does not fail closed on a site
 * whose owner has not signed up to a provider — that would block real inquiries
 * in exchange for no added protection.
 *
 * When a provider IS configured, a failed or missing token rejects the
 * submission. Enabling verification must make the form stricter, never looser.
 */

export type VerificationResult =
  | { outcome: "verified" }
  | { outcome: "failed" }
  | { outcome: "unconfigured" };

export const isBotVerificationConfigured = (): boolean =>
  serverEnv.botVerificationSecretKey !== null;

/**
 * Verify a submitted token.
 *
 * Returns `unconfigured` when no secret is set, so the caller can distinguish
 * "no provider" from "provider rejected this token" and only the latter is
 * treated as a failure.
 */
export async function verifySubmission(
  token: string | null,
  remoteIp: string | null,
): Promise<VerificationResult> {
  const secret = serverEnv.botVerificationSecretKey;
  if (!secret) return { outcome: "unconfigured" };

  // A configured provider with no token is a failure, not a pass.
  if (!token) return { outcome: "failed" };

  const endpoint =
    serverEnv.botVerificationEndpoint ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(endpoint, {
      method: "POST",
      body,
      // A verification endpoint that hangs must not hang the form submission.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return { outcome: "failed" };

    const payload = (await response.json()) as { success?: boolean };
    return payload.success === true
      ? { outcome: "verified" }
      : { outcome: "failed" };
  } catch {
    // A provider outage fails closed when a provider is configured: the
    // alternative is silently accepting unverified submissions.
    return { outcome: "failed" };
  }
}
