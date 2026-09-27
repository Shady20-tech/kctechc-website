/**
 * Analytics redaction.
 *
 * The single place that decides what may leave the browser for a measurement
 * endpoint. A parameter not on the allowlist is dropped rather than passed
 * through, because the failure that matters here is silent: an event carrying a
 * customer's email looks identical to a correct one in the GA4 debug view, and
 * by the time anyone notices it is already retained.
 *
 * The functions are pure so they can be tested without a browser, and so the
 * redaction rule can be asserted directly rather than only observed as a
 * side-effect of a `track` call.
 */

import {
  SAFE_ITEM_KEYS,
  SAFE_PARAM_KEYS,
  type AnalyticsItem,
  type AnalyticsEvent,
} from "./events";

/**
 * A value that is *structurally* non-personal.
 *
 * Only primitives pass. An object or array is dropped rather than serialized,
 * because an allowlisted key whose value is a nested object is how a PII leak
 * would actually arrive — `content_id: { email: "..." }` typechecks today and
 * would be sent without this check.
 */
function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Drop empty strings so a blank field is absent rather than sent as `""`. */
function isMeaningful(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Keep only allowlisted item keys whose values are scalar.
 *
 * A malformed item loses its bad fields; it is not dropped entirely, so a
 * partial item still produces a usable event rather than a gap.
 */
export function sanitizeItem(item: AnalyticsItem): AnalyticsItem {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_ITEM_KEYS) {
    const value = (item as Record<string, unknown>)[key];
    if (isMeaningful(value) && isScalar(value)) safe[key] = value;
  }
  return safe as AnalyticsItem;
}

/**
 * Reduce an event to the parameters that may be transmitted.
 *
 * Items are sanitized individually. Any other key is dropped, whether or not it
 * is on the allowlist, if its value is not a scalar.
 */
export function sanitizeEvent(
  event: AnalyticsEvent,
): { name: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {};

  for (const key of SAFE_PARAM_KEYS) {
    const value = (event.params as Record<string, unknown>)[key];
    if (!isMeaningful(value)) continue;

    if (key === "items") {
      if (Array.isArray(value)) {
        params.items = value.map((item) => sanitizeItem(item as AnalyticsItem));
      }
      continue;
    }

    if (isScalar(value)) params[key] = value;
  }

  return { name: event.name, params };
}

/**
 * Hash a search term before it is measured.
 *
 * A search box is the one place a visitor types free text, and they routinely
 * type an email address or a phone number into it looking for their own record.
 * Sending that to an analytics provider would be a disclosure the visitor did
 * not anticipate, so only a salted hash travels and the term itself never does.
 *
 * Uses SHA-256 via Web Crypto, available in every browser the site supports and
 * in Node for tests. Returns null rather than the raw term if hashing is
 * unavailable — dropping the value is the safe failure, not sending it.
 */
export async function hashSearchTerm(term: string): Promise<string | null> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const bytes = new TextEncoder().encode(`kc-analytics:${normalized}`);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // No subtle crypto (or a non-secure context). Drop the term rather than
    // send it unhashed.
    return null;
  }
}
