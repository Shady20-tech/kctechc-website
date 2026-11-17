import { NextResponse } from "next/server";

import { resolveDashboardHome } from "@/lib/auth/dashboard-home";
import { isLocale } from "@/lib/i18n/locales";

/**
 * The signed-in caller's dashboard, for the public header's return control.
 *
 * The shared site header must stay statically renderable — reading the session
 * there with `cookies()` would make every public page dynamic and cost the
 * prerendered HTML the SEO layer depends on — so the header renders its static
 * markup and this endpoint tells the client island whether the caller has a
 * dashboard to return to. It is the same split as `/api/cart/summary`.
 *
 * It returns only a destination and a message key, never the profile, the role or
 * the memberships, so the response carries no more than the button needs.
 * `resolveDashboardHome` re-checks the session and the capability server-side, and
 * the destination page re-checks both again on arrival, so this endpoint is a
 * convenience rather than a control.
 *
 * `force-dynamic` because the answer depends on the request cookie.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = requested && isLocale(requested) ? requested : "en";

  const home = await resolveDashboardHome(locale);

  return NextResponse.json(home, {
    headers: { "cache-control": "no-store" },
  });
}
