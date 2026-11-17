import { NextResponse } from "next/server";

import { resolveAccountSummary } from "@/lib/auth/account-summary";
import { isLocale } from "@/lib/i18n/locales";

/**
 * The signed-in caller's account summary, for the public header controls.
 *
 * The shared site header must stay statically renderable — reading the session
 * there with `cookies()` would make every public page dynamic and cost the
 * prerendered HTML the SEO layer depends on — so the header renders its static
 * markup and this endpoint tells the client island whether the visitor is signed
 * in, where their account lives, and whether they have a dashboard to return to.
 * It is the same split as `/api/cart/summary`.
 *
 * It returns only the fields the controls display, never the role or the
 * memberships, and the destinations re-check the session on arrival, so this is a
 * convenience rather than a control.
 *
 * `force-dynamic` because the answer depends on the request cookie.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = requested && isLocale(requested) ? requested : "en";

  const summary = await resolveAccountSummary(locale);

  return NextResponse.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}
