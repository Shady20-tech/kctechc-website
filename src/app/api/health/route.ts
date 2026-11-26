import { NextResponse } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/config/env";
import { isEmailConfigured, serverEnv } from "@/lib/config/server-env";

// Cache the probe briefly so monitoring cannot turn into a load source.
export const revalidate = 30;

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
    locale: {
      default: publicEnv.defaultLocale,
      supported: ["en", "fr"],
    },
    integrations: {
      supabase: isSupabaseConfigured(),
      // Boolean only, never the value. Admin writes and Storage uploads use the
      // service-role client; without this key every one of them reports
      // "unconfigured" even when the public Supabase connection is healthy.
      supabaseAdmin: Boolean(serverEnv.supabaseServiceRoleKey),
      tolgee: Boolean(publicEnv.tolgeeProjectId),
      email: isEmailConfigured(),
      maps: publicEnv.mapProvider,
    },
  });
}
