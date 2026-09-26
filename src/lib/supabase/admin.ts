import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config/env";
import { serverEnv } from "@/lib/config/server-env";
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
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
