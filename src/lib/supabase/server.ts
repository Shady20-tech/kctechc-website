import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";

/**
 * Server Supabase client bound to the request cookie store.
 *
 * Cookie writes are wrapped in try/catch because Server Components cannot set
 * cookies. Refreshing happens in `src/middleware.ts`, so a failed write here is
 * expected and harmless rather than an error to surface.
 */
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; the middleware already refreshed
          // the session for this request.
        }
      },
    },
  });
}
