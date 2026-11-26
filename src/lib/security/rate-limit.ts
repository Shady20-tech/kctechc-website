import "server-only";

/**
 * Minimal in-process fixed-window limiter.
 *
 * Deliberately dependency-free and per-instance: it blunts brute-force and
 * form-spam bursts, and is not a distributed quota. When a shared store is
 * configured in a later phase this module is the seam to swap, without touching
 * callers.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, {
      count: 1,
      resetAt: now + options.windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSeconds: options.windowSeconds,
    };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.limit - existing.count,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Best-effort client identifier for limiter keys; never stored or logged. */
export function clientKeyFrom(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

/**
 * Rate-limit key for a form submission.
 *
 * Prefers the visitor's IP, but falls back to a per-browser cookie rather than a
 * literal `"unknown"`. Behind a proxy that does not set `x-forwarded-for` every
 * visitor collapsed into one shared bucket, so a handful of unrelated checkouts
 * locked the form for everybody — the tenth person to order in ten minutes was
 * told "too many attempts" for no reason of their own.
 *
 * The cookie value is opaque and never logged; it identifies a browser, not a
 * person, and is only used to keep one visitor's retries from spending another
 * visitor's budget.
 */
export function submissionKeyFrom(
  headers: Headers,
  scope: string,
  cookieValue: string | null | undefined,
): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  if (ip) return `${scope}:ip:${ip}`;
  if (cookieValue) return `${scope}:browser:${cookieValue}`;
  // Nothing identifies the caller. This is still a shared bucket, but it now
  // only happens for a client that blocks cookies and sends no forwarded header.
  return `${scope}:anonymous`;
}
