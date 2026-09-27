import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, resolveLocaleFromAcceptLanguage } from "@/lib/i18n/locales";
import { safeRedirectPathSchema } from "@/lib/validation/common";

/**
 * Auth callback.
 *
 * Where Supabase confirmation and recovery links land. Supabase sends a
 * short-lived `code` (the PKCE flow) which is exchanged here for a session,
 * server-side, so the tokens never sit in a URL that page script could read and
 * never remain in the browser history after the redirect.
 *
 * This is a Route Handler rather than a page for one reason: it must set cookies,
 * and a Server Component cannot. The exchange writes the auth cookie pair through
 * `createClient`, whose `setAll` is wired to the response cookie store.
 *
 * The `next` parameter is validated against the same open-redirect allowlist as
 * sign-in, so a crafted link cannot bounce a freshly-authenticated visitor to
 * another host.
 *
 * On a failed exchange the visitor is sent to the sign-in page with a reason
 * rather than to a dead end: an expired or already-used link is common (mail
 * clients prefetch links), and the honest next step is to request another.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALE_COOKIE = "kc_locale";

/** The sign-in page is localized; send the visitor to the one matching them. */
function signInPath(acceptLanguage: string | null, cookieLocale?: string): string {
  if (cookieLocale && isLocale(cookieLocale)) return `/${cookieLocale}/admin/login`;
  const fromHeader = resolveLocaleFromAcceptLanguage(acceptLanguage);
  return `/${fromHeader ?? "en"}/admin/login`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next");
  const nextParsed = safeRedirectPathSchema.safeParse(rawNext);
  const destination = nextParsed.success ? nextParsed.data : "/admin";

  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = request.headers.get("accept-language");
  const loginBase = signInPath(acceptLanguage, locale);

  // Supabase reports a failure by putting `error`/`error_description` on the
  // redirect instead of a code. Surface it as a reason, not a crash.
  const providerError = url.searchParams.get("error");

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL(`${loginBase}?reason=unconfigured`, url.origin),
      { status: 303 },
    );
  }

  if (!code || providerError) {
    return NextResponse.redirect(
      new URL(`${loginBase}?reason=link_expired`, url.origin),
      { status: 303 },
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`${loginBase}?reason=link_expired`, url.origin),
      { status: 303 },
    );
  }

  return NextResponse.redirect(new URL(destination, url.origin), {
    status: 303,
  });
}
