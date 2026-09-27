import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/config/server-env";

/**
 * Fapshi provider adapter.
 *
 * Everything that touches a secret lives here, and the module carries
 * `import "server-only"` so an accidental import from a Client Component is a
 * build error rather than a leaked key in a browser bundle.
 *
 * API shape (Fapshi, current REST):
 *   * `POST /initiate-pay` — create a payment link and redirect the customer to
 *     Fapshi's hosted checkout. Returns `link`, `transId` and `dateInitiated`.
 *   * `GET /payment-status/{transId}` — server-side verification. The verified
 *     amount is what the order is checked against; a client-reported success is
 *     never trusted.
 *   * Webhook — Fapshi POSTs the same body as `/payment-status` to the URL set on
 *     the service dashboard when a payment becomes SUCCESSFUL, FAILED or EXPIRED.
 *     The `x-wh-secret` header carries the dashboard-configured secret.
 *
 * Three deliberate constraints:
 *
 *   * **No card data.** This module never accepts or forwards a card number, CVV
 *     or expiry. Fapshi's hosted page collects payment details on Fapshi's own
 *     domain, which keeps this site out of PCI scope entirely.
 *   * **No simulated success.** When credentials are absent, every function
 *     returns an explicit `unconfigured` result. Nothing here ever returns a
 *     success it did not receive from the provider.
 *   * **XAF only.** Fapshi settles in Central African CFA franc. Rather than send
 *     a currency the provider does not support and discover it in production, any
 *     other currency is rejected here.
 *
 * Two differences from a redirect-provider integration are load-bearing and are
 * called out at their use sites: Fapshi has no idempotency header, so the
 * guarantee is enforced by this application and a unique index instead; and
 * Fapshi delivers each webhook exactly once with no retry, so the return URL is
 * not merely a convenience — it is the path that recovers a missed delivery.
 */

const FAPSHI_LIVE_BASE = "https://live.fapshi.com";

/** Currency the store transacts in. Fapshi supports no other. */
export const PAYMENT_CURRENCY = "XAF";

/** Fapshi rejects any amount below this. Checked here rather than discovered. */
export const MIN_AMOUNT_MINOR = 100;

/**
 * The environment the credentials belong to.
 *
 * Read from configuration rather than inferred, so a sandbox key can never be
 * pointed at the live host by accident: the two move together.
 */
function apiBase(): string {
  return serverEnv.fapshiBaseUrl ?? FAPSHI_LIVE_BASE;
}

export type ProviderChargeRequest = {
  /** Our reference, sent to Fapshi as `externalId`. */
  txRef: string;
  /** Amount in XAF. Fapshi takes an integer, and XAF has no minor unit. */
  amountMinor: number;
  currency: string;
  customerEmail: string;
  /** Where Fapshi returns the customer after the hosted page. */
  redirectUrl: string;
  /** Shown on the customer's statement and on the hosted page. */
  narration: string;
};

export type ProviderChargeResult =
  | { ok: true; kind: "redirect"; link: string; providerReference: string | null }
  | { ok: false; error: string; retryable: boolean };

export type ProviderVerification =
  | {
      ok: true;
      status: "succeeded" | "failed" | "pending";
      amountMinor: number;
      currency: string;
      providerReference: string | null;
      /** Fapshi's own status string, for the audit trail. */
      providerStatus: string;
      /**
       * The channel the customer actually paid through, as Fapshi reports it.
       *
       * This is the honest record: our checkout collects an *intent* (MTN,
       * Orange), but Fapshi's hosted page lets the customer switch before paying,
       * and `initiate-pay` has no method field to constrain them. Recording this
       * next to the intent is what makes a reconciliation dispute answerable.
       */
      providerMedium: string | null;
    }
  | { ok: false; error: string; retryable: boolean };

/** True when the provider can be called at all. */
export function isProviderConfigured(): boolean {
  return serverEnv.fapshiApiUser !== null && serverEnv.fapshiApiKey !== null;
}

/**
 * Fapshi has no public/publishable key: `initiate-pay` is a server-side call and
 * the hosted page needs no client credential. There is therefore nothing to hand
 * to the browser, and this adapter deliberately exposes no key accessor at all.
 */

function credentials(): { user: string; key: string } | null {
  const user = serverEnv.fapshiApiUser;
  const key = serverEnv.fapshiApiKey;
  if (!user || !key) return null;
  return { user, key };
}

const ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "JPY", "KRW", "VND"]);

/**
 * Amount in the currency's major unit.
 *
 * Fapshi expects an integer. XAF has no minor unit (ISO 4217 exponent 0), so
 * 50 000 XAF is sent as 50000, not 500.00 — dividing by 100 would under-charge by
 * a factor of 100. The divisor follows the currency rather than assuming two
 * decimal places, matching `minorUnitDivisor` on the display side.
 */
function amountForProvider(amountMinor: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? amountMinor
    : Math.round(amountMinor) / 100;
}

/** Convert a provider amount back to minor units. */
export function amountToMinor(amount: number, currency: string): number {
  return Math.round(
    amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100),
  );
}

/**
 * Create a payment link.
 *
 * Fapshi's hosted page presents the available payment channels (MTN Mobile
 * Money, Orange Money) itself, so no method is sent: the customer chooses on
 * Fapshi's page, not in our form. Our `payments.method` still records what the
 * customer picked for reporting and reconciliation.
 *
 * **No idempotency header exists on this API.** A retried network call would
 * therefore create a second link. Two things cover that instead: the caller reuses
 * an existing payment attempt keyed on its idempotency key before reaching here,
 * and `payments.provider_tx_ref` is unique, so a duplicate charge cannot be
 * recorded even if one were created. The provider-side window is closed by
 * refusing to call this at all for a payment row that already has a link.
 */
export async function createCharge(
  request: ProviderChargeRequest,
): Promise<ProviderChargeResult> {
  const creds = credentials();
  if (!creds) return { ok: false, error: "unconfigured", retryable: false };

  const currency = request.currency.toUpperCase();
  if (currency !== PAYMENT_CURRENCY) {
    return { ok: false, error: "unsupported_currency", retryable: false };
  }

  const amount = amountForProvider(request.amountMinor, currency);
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT_MINOR) {
    // Surfaced explicitly rather than sent and rejected: the customer can be told
    // their basket is below the provider's minimum, which is actionable.
    return { ok: false, error: "amount_below_provider_minimum", retryable: false };
  }

  const body = {
    amount,
    email: request.customerEmail,
    // Fapshi's field names are camelCase. `redirectUrl` is where the customer is
    // sent after the hosted page, and `externalId` is our order reference,
    // returned on every status query and in the webhook body. The latter is the
    // reconciliation key.
    redirectUrl: request.redirectUrl,
    externalId: request.txRef,
    message: request.narration.slice(0, 200),
  };

  try {
    const response = await fetch(`${apiBase()}/initiate-pay`, {
      method: "POST",
      headers: {
        apiuser: creds.user,
        apikey: creds.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // A hung provider must not hold the request open; the customer gets a
      // clear retry rather than a spinning page.
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json()) as {
      message?: string;
      link?: string;
      transId?: string;
      dateInitiated?: string;
    };

    if (!response.ok || !payload.link) {
      return {
        ok: false,
        error: payload.message ?? `provider_http_${response.status}`,
        // A 5xx is worth retrying; a 4xx is a request problem.
        retryable: response.status >= 500,
      };
    }

    return {
      ok: true,
      kind: "redirect",
      link: payload.link,
      providerReference: payload.transId ?? null,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "provider_timeout" : "provider_unreachable",
      retryable: true,
    };
  }
}

/**
 * Verify a transaction server-side.
 *
 * THE authority on whether a payment succeeded. A webhook body *claims* success;
 * this asks Fapshi directly and the caller compares the verified amount against
 * the order. A webhook that says SUCCESSFUL for an amount Fapshi does not confirm
 * is not a payment.
 *
 * Keyed on `transId` — Fapshi's `payment-status` endpoint does not accept our
 * `externalId`. The caller resolves the payment row from our reference and reads
 * the stored `transId` from it.
 *
 * Fapshi rate-limits this endpoint to 6 requests per minute per transaction and
 * documents webhooks as the preferred signal. This is the fallback path, invoked
 * once on return rather than polled.
 */
export async function verifyTransaction(input: {
  transId: string;
}): Promise<ProviderVerification> {
  const creds = credentials();
  if (!creds) return { ok: false, error: "unconfigured", retryable: false };

  if (!input.transId) {
    return { ok: false, error: "missing_reference", retryable: false };
  }

  try {
    const response = await fetch(
      `${apiBase()}/payment-status/${encodeURIComponent(input.transId)}`,
      {
        headers: { apiuser: creds.user, apikey: creds.key },
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = (await response.json()) as {
      message?: string;
      transId?: string;
      status?: string;
      medium?: string;
      amount?: number;
      email?: string;
      externalId?: string;
    };

    if (!response.ok || typeof payload.status !== "string") {
      return {
        ok: false,
        error: payload.message ?? `provider_http_${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }

    const providerStatus = payload.status.toUpperCase();
    const status: "succeeded" | "failed" | "pending" =
      providerStatus === "SUCCESSFUL"
        ? "succeeded"
        : providerStatus === "PENDING" || providerStatus === "CREATED"
          ? "pending"
          : "failed";

    return {
      ok: true,
      status,
      // `amount` is already in XAF, the only currency Fapshi settles in, so it is
      // the minor-unit value directly. The response carries no currency field.
      amountMinor: amountToMinor(payload.amount ?? 0, PAYMENT_CURRENCY),
      currency: PAYMENT_CURRENCY,
      providerReference: payload.transId ?? input.transId,
      providerStatus: providerStatus.toLowerCase(),
      providerMedium:
        typeof payload.medium === "string" ? payload.medium : null,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "provider_timeout" : "provider_unreachable",
      retryable: true,
    };
  }
}

/**
 * Verify a webhook signature.
 *
 * Fapshi sends the dashboard-configured webhook secret in the `x-wh-secret`
 * header. The comparison is constant-time: a byte-by-byte early exit would leak
 * the secret's prefix through response timing, which is enough to reconstruct it
 * against a webhook that echoes nothing.
 *
 * Returns false when no secret is configured. A webhook that cannot be verified
 * must not be trusted, so an unconfigured deployment rejects rather than accepts.
 */
export function verifyWebhookSignature(input: {
  headerSecret: string | null;
}): boolean {
  const secret = serverEnv.fapshiWebhookSecret;
  if (!secret || !input.headerSecret) return false;

  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // (weaker) timing signal, so compare fixed-length digests of each instead.
  const expectedDigest = createHash("sha256").update(secret, "utf8").digest();
  const receivedDigest = createHash("sha256")
    .update(input.headerSecret, "utf8")
    .digest();

  return timingSafeEqual(expectedDigest, receivedDigest);
}

/**
 * Derive a stable provider event id from a webhook body.
 *
 * The replay guard needs an id that is identical across two deliveries of the
 * same event and different between distinct events. Fapshi's payload has no event
 * id, so the id is derived from the fields that identify the event: the
 * transaction id, our reference, its status and the amount. Two deliveries of one
 * event produce the same digest; a genuine second event (a later status change)
 * produces a new one.
 *
 * Fapshi documents a single delivery per event with no retry, so this is a
 * belt-and-braces guard against a manual replay or a proxy that duplicates a
 * request — not the primary protection.
 *
 * Falls back to a digest of the whole body when those fields are absent, which
 * still makes an exact replay a no-op.
 */
export function deriveEventId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;

  const parts = [
    record.transId ?? "",
    record.externalId ?? "",
    record.status ?? "",
    record.amount ?? "",
  ].map((value) => String(value));

  const source = parts.some((part) => part.length > 0)
    ? parts.join("|")
    : JSON.stringify(body);

  return createHash("sha256").update(source).digest("hex");
}

/** An opaque, unguessable reference for `externalId`. */
export function newTransactionReference(prefix = "KC"): string {
  // 16 bytes → 32 hex chars. Long enough that collisions are not a concern and
  // the value cannot be guessed from another order's reference.
  //
  // Fapshi constrains `externalId` to `[a-zA-Z0-9-_]{1,100}`, which this shape
  // satisfies by construction: the prefix is stripped to alphanumerics by the
  // only caller that builds one from an order reference.
  const random = randomBytes(16).toString("hex");
  return `${prefix}-${Date.now().toString(36)}-${random}`.slice(0, 100);
}
