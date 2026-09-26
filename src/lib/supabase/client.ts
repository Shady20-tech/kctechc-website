"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";

/**
 * Browser Supabase client. Uses the publishable (anon) key only — the
 * service-role key is never available in client code.
 */
export function createClient() {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient<Database>(config.url, config.key);
}
