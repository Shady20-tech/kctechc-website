import { NextResponse } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/config/env";
import {
  isEmailConfigured,
  isSupabaseAdminConfigured,
  serverEnv,
} from "@/lib/config/server-env";

// This endpoint reports the *running process* configuration. Without a dynamic
// declaration Next prerenders it at build time (the route reads no request
// data), so an environment variable added after the build would never appear
// and the probe would confidently report the wrong answer.
export const dynamic = "force-dynamic";

const startedAt = new Date().toISOString();

/**
 * Health endpoint.
 *
 * Reports which optional integrations are configured without ever returning a
 * credential value. Used by deployment checks and uptime monitoring.
 *
 * There is no `payments` entry: the site takes no payment through a provider.
 * An order is emailed to the business, so its health signal is `email`.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    build: {
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
        process.env.GIT_COMMIT_SHA?.slice(0, 7) ??
        null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      startedAt,
    },
    locale: {
      default: publicEnv.defaultLocale,
      supported: ["en", "fr"],
    },
    integrations: {
      supabase: isSupabaseConfigured(),
      // Boolean only, never the value. Admin writes and Storage uploads use the
      // service-role client; without this key every one of them reports
      // "unconfigured" even when the public Supabase connection is healthy.
      supabaseAdmin: isSupabaseAdminConfigured(),
      // The variable name, not the value. This distinguishes "the deployment
      // never received the key" from "it arrived under a name the app did not
      // read", which is otherwise invisible from the health response.
      supabaseAdminKeySource: serverEnv.supabaseServiceRoleKeySource,
      // Format only, never a fragment of the value. A legacy `service_role`
      // JWT and a current `sb_secret_…` key are both valid; anything else is a
      // pasted database password or truncated value and will be refused.
      supabaseAdminKeyType: serverEnv.supabaseServiceRoleKeyType,
      tolgee: Boolean(publicEnv.tolgeeProjectId),
      email: isEmailConfigured(),
      maps: publicEnv.mapProvider,
    },
  });
}
