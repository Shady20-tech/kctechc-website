/**
 * Human-readable descriptions of Supabase failures.
 *
 * Server Actions used to collapse every database failure into a generic code, so
 * an operator saw the same message for a missing key, a denied policy and a
 * malformed query. These helpers keep the real message available without ever
 * including a credential: Supabase's `message`/`code` describe the request and
 * the response, not the key that signed it.
 */

type SupabaseErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

const MAX_DETAIL_LENGTH = 500;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_DETAIL_LENGTH) : null;
}

/** Format a PostgREST/Supabase error for an admin-facing notice. */
export function describeSupabaseError(
  error: unknown,
  fallback = "The database request failed without an error message.",
): string {
  if (error && typeof error === "object") {
    const value = error as SupabaseErrorLike;
    const message = clean(value.message);
    const code = clean(value.code);
    if (message) return code ? `${message} (${code})` : message;
    if (code) return `${fallback} (${code})`;
  }

  if (error instanceof Error) {
    const message = clean(error.message);
    if (message) return message;
  }

  return fallback;
}

/**
 * Explain why `createAdminClient()` returned null.
 *
 * The distinction matters: a missing public URL, a missing server key and a
 * correctly configured deployment are three different operator actions, and the
 * old single "unconfigured" code sent all three to the same message.
 */
export function describeMissingAdminClient(options: {
  hasPublicConfig: boolean;
  hasServerKey: boolean;
}): string {
  if (!options.hasPublicConfig) {
    return "Supabase URL or publishable key is missing from the server environment.";
  }
  if (!options.hasServerKey) {
    return "Supabase server key is missing. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, then restart or redeploy.";
  }
  return "The Supabase admin client could not be created.";
}
