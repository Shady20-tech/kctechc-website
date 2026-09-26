import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";

/**
 * Stateless, anonymous Supabase client for the public render path.
 *
 * The cookie-bound client in `server.ts` calls `cookies()`, which makes any page
 * that reads through it dynamic. Public content pages are meant to be
 * prerendered (`generateStaticParams`), and Next 16 refuses to let such a page
 * turn dynamic at request time, so a loader that touched cookies during
 * prerendering produced no params and then 500'd on every request.
 *
 * This client holds no session and writes no cookies, so it is safe to call from
 * a statically prerendered page. It carries the publishable (anon) key, which is
 * the right level of access for public content: RLS shows it exactly the
 * published rows the loaders already ask for, and it cannot see drafts. The
 * service-role client remains the only way to read unpublished data.
 *
 * Callers that genuinely need the signed-in user's identity — auth guards,
 * admin-only reads — must keep using `server.ts`.
 */
export function createPublicClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createSupabaseClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
