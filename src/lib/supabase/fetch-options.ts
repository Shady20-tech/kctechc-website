/**
 * Shared request policy for every Supabase client.
 *
 * Two independent problems made a database outage stall a page for ~7s:
 *
 * 1. supabase-js retries a failed request three times with 1s/2s/4s exponential
 *    backoff. Against an unreachable host every attempt fails instantly with
 *    `ECONNREFUSED`, so the retries add no resilience and a flat ~7s of latency.
 *    Measured: one query took 7033ms with retry on and 1ms with it off.
 * 2. Nothing bounded a single attempt, so a *hung* connection — a blackholed IP or
 *    a stalled TLS handshake, which does not refuse — waited for the OS timeout.
 *
 * Every loader already degrades to its bundled fallback, an empty list or an
 * empty page on an error, and every Server Action surfaces an error the user can
 * retry, so failing fast is strictly better than hanging. Both controls are
 * needed: `retry: false` stops the backoff storm, `boundedFetch` caps one attempt.
 */

/** Upper bound on a single Supabase round trip. */
export const SUPABASE_REQUEST_TIMEOUT_MS = 4000;

/**
 * `AbortSignal.timeout` aborts the request itself rather than only settling a
 * race, so the socket is released instead of lingering until the OS gives up.
 *
 * A caller-supplied signal wins, so a request that is already cancellable keeps
 * its own lifetime.
 */
export function boundedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
  });
}

/**
 * Connection options shared by the public, cookie-bound and service-role clients.
 *
 * `retry: false` applies to all three on purpose: a retry only helps a brief blip,
 * while it costs seconds of visible latency on every failure. A caller that wants
 * to retry can do so explicitly, having seen the error.
 */
export const SUPABASE_CLIENT_OPTIONS = {
  db: { retry: false },
  global: { fetch: boundedFetch },
} as const;
