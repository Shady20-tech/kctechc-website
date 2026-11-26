import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config/env";
import { serverEnv } from "@/lib/config/server-env";
import { describeMissingAdminClient } from "@/lib/supabase/errors";
import { SUPABASE_CLIENT_OPTIONS } from "@/lib/supabase/fetch-options";
import type { Database } from "@/lib/db/database.types";

/**
 * Service-role client for privileged, server-only operations (translation sync,
 * audit writes, admin workflows). It bypasses RLS, so every caller must have
 * already authorized the actor through `src/lib/auth/guards.ts`.
 */
export function createAdminClient() {
  const config = getSupabaseConfig();
  if (!config || !serverEnv.supabaseServiceRoleKey) return null;

  return createSupabaseClient<Database>(
    config.url,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      ...SUPABASE_CLIENT_OPTIONS,
    },
  );
}

/**
 * Why `createAdminClient()` would return null.
 *
 * Callers put this in the action's `detail` so the console can distinguish a
 * missing public URL from a missing server key. It never contains the key.
 */
export function missingAdminClientDetail(): string {
  return describeMissingAdminClient({
    hasPublicConfig: getSupabaseConfig() !== null,
    hasServerKey: serverEnv.supabaseServiceRoleKey !== null,
  });
}
