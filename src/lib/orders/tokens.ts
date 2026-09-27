import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Guest order access.
 *
 * A visitor with no account still needs to reach the order they just placed and
 * the ones before it. The credential for that is the order's 64-character
 * `access_token`, not its human-readable reference — a reference is six
 * characters from a 32-symbol alphabet, so it is enumerable and is also printed
 * on receipts. The token is what authorizes access.
 *
 * This module keeps the tokens in a single httpOnly cookie as a short list of
 * `{ reference, token }` pairs. Nothing personal is stored: a reference is a
 * label and a token is opaque. The cookie is not readable by script, so an XSS
 * cannot lift it, and it is SameSite=Lax so it is not sent cross-site.
 */

export const ORDER_TOKEN_COOKIE = "kc_orders";

/** Bounded so the cookie cannot grow without limit over a long-lived browser. */
const MAX_REMEMBERED_ORDERS = 20;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type OrderTokenEntry = { reference: string; token: string };

/** An opaque, high-entropy token. Used for client idempotency keys. */
export function newRandomToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Read the remembered entries.
 *
 * Malformed JSON yields an empty list rather than throwing: a corrupted cookie
 * must not break the order history page for a visitor who cannot clear it.
 */
export async function readOrderTokens(): Promise<OrderTokenEntry[]> {
  const store = await cookies();
  const raw = store.get(ORDER_TOKEN_COOKIE)?.value;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const record = entry as Record<string, unknown>;
      return typeof record.reference === "string" &&
        typeof record.token === "string"
        ? [{ reference: record.reference, token: record.token }]
        : [];
    });
  } catch {
    return [];
  }
}

/**
 * Remember an order so a guest can return to it.
 *
 * Most recent first, and de-duplicated by reference so re-placing or re-visiting
 * does not fill the list with one order.
 */
export async function rememberOrderToken(
  reference: string,
  token: string,
): Promise<void> {
  const store = await cookies();
  const existing = await readOrderTokens();

  const next = [
    { reference, token },
    ...existing.filter((entry) => entry.reference !== reference),
  ].slice(0, MAX_REMEMBERED_ORDERS);

  store.set(ORDER_TOKEN_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** The stored token for a reference, or null when not remembered. */
export async function guestTokenFor(reference: string): Promise<string | null> {
  const tokens = await readOrderTokens();
  return tokens.find((entry) => entry.reference === reference)?.token ?? null;
}

/** The references a guest has placed, newest first. */
export async function rememberedOrderReferences(): Promise<string[]> {
  return (await readOrderTokens()).map((entry) => entry.reference);
}
