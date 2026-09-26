import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";

/**
 * Refresh the Supabase auth session from `src/middleware.ts`.
 *
 * Supabase access tokens are short-lived, so the cookie pair must be rotated on
 * every request. This only touches cookies — no database reads happen here, as
 * the brief forbids slow work in middleware.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const config = getSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // Touching the user forces a token refresh when the access token expired.
    await supabase.auth.getUser();
  } catch {
    // A network failure here must not block the request; the page-level guard
    // re-checks authorization against the database.
  }

  return response;
}
