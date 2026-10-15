"use client";

import Link from "next/link";

import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { useHasSession } from "@/lib/hooks/use-session";

/**
 * The header's account action.
 *
 * The header is a Server Component and must stay one: reading the session with
 * `cookies()` in the shared layout would force every public page to render
 * dynamically and cost the prerendered HTML the SEO requirements depend on. So the
 * link is rendered statically as "Sign in" — the markup that was there before —
 * and this client island swaps it to "Your account" once the browser knows there
 * is a session. `useHasSession` owns that read and its first value is `false`, so
 * the server render and the first client render agree.
 */
export function AccountAction({
  locale,
  signInLabel,
  accountLabel,
  size = "sm",
  className,
  onNavigate,
}: {
  locale: Locale;
  signInLabel: string;
  accountLabel: string;
  size?: ButtonSize;
  className?: string;
  /** Called on click, so a host that opens over the page (the mobile drawer) can close. */
  onNavigate?: () => void;
}) {
  const signedIn = useHasSession();

  return (
    <Link
      href={signedIn ? `/${locale}/account` : "/admin/login"}
      onClick={onNavigate}
      className={buttonClasses({ variant: "accentOnInk", size, className })}
    >
      {signedIn ? accountLabel : signInLabel}
    </Link>
  );
}
