import "server-only";

import {
  createAdminClient,
  missingAdminClientDetail,
} from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/** A read that distinguishes "no rows" from "the query failed". */
export type AdminReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "read_failed"; detail: string };

/**
 * Admin reads use the service-role client when it is configured, because these
 * pages are already behind a role guard and the read must not disappear while a
 * hosted project waits for a grant. The session client remains the fallback so a
 * deployment with only a public key still works, and RLS then decides.
 */
export async function adminReadClient() {
  return createAdminClient() ?? (await createClient());
}

export function unconfiguredRead(): AdminReadResult<never> {
  return {
    ok: false,
    reason: "unconfigured",
    detail: missingAdminClientDetail(),
  };
}

export function failedRead(error: unknown): AdminReadResult<never> {
  return {
    ok: false,
    reason: "read_failed",
    detail: describeSupabaseError(error),
  };
}
