import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy-client";
import {
  DEFAULT_LOCALE,
  isLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/lib/i18n/locales";
import { isNonLocalizedPath } from "@/lib/i18n/routing";

/**
 * Lightweight request interception: locale validation/routing and auth-cookie
 * refresh.
 *
 * Deliberately free of database access. Authorization decisions belong in
 * Server Components and RLS, so this file stays fast on every request.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`; the exported
 * function must be named `proxy` for it to be picked up.
 */

const LOCALE_COOKIE = "kc_locale";

/**
 * Unprefixed admin paths that have a localized counterpart.
 *
 * Sign-in and sign-up are customer-facing doors and are bilingual; every other
 * admin path is internal and English-only. They are therefore served from
 * `/[locale]/admin/...` so they inherit the site header, footer and language
 * switcher, while these unprefixed forms stay working — they are what the shared
 * header, the guards and existing bookmarks link to.
 *
 * Only these two are remapped. An arbitrary `/admin/anything` must not be
 * rewritten, or the mapping would leak into the internal console.
 */
const LOCALIZED_ADMIN_PATHS = new Set(["/admin/login", "/admin/sign-up"]);

function detectLocale(request: NextRequest): string {
  // 1. An explicit choice made by the visitor.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;

  // 2. The browser's stated preference.
  const fromHeader = resolveLocaleFromAcceptLanguage(
    request.headers.get("accept-language"),
  );
  if (fromHeader) return fromHeader;

  // 3. Configured default.
  const configured = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
  return configured && isLocale(configured) ? configured : DEFAULT_LOCALE;
}

function rememberLocale(response: NextResponse, locale: string): void {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Locale-aware redirect for the un-prefixed public tree.
  //
  // `/admin`, `/api` and `/auth` are intentionally excluded: they are not
  // locale-scoped, and rewriting them would break the admin surface.
  if (!isNonLocalizedPath(pathname)) {
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0];

    if (!first) {
      // The corporate gateway at `/` is language-neutral by design. It presents
      // English/French and department choices rather than guessing, so it is
      // served as-is and never redirected.
      return refreshSession(request, NextResponse.next());
    }

    if (!isLocale(first)) {
      const locale = detectLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname}`;
      const redirect = NextResponse.redirect(url, 307);
      rememberLocale(redirect, locale);
      return refreshSession(request, redirect);
    }

    // Preserve an explicit locale choice so later un-prefixed visits honour it.
    const localized = NextResponse.next();
    rememberLocale(localized, first);
    return refreshSession(request, localized);
  }

  // Keep the Supabase auth cookie pair fresh. Cookie handling only.
  //
  // The localized sign-in and sign-up aliases are forwarded here, before the
  // refresh, because there is nothing to refresh for a stateless hop and the
  // destination will run the refresh itself. `rememberLocale` is called so the
  // guess this redirect just made is honoured on the visitor's next unprefixed
  // visit, exactly as the public tree does.
  if (LOCALIZED_ADMIN_PATHS.has(pathname)) {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    const redirect = NextResponse.redirect(url, 307);
    rememberLocale(redirect, locale);
    return redirect;
  }

  return refreshSession(request, NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Run on every path except Next.js internals, the metadata routes, and
     * static assets, which must never be locale-rewritten.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map|txt|xml)$).*)",
  ],
};
