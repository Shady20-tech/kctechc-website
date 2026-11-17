"use client";

import { User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import { useAccountSummary } from "@/lib/hooks/use-account-summary";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The header's account action.
 *
 * The header is a Server Component and must stay one: reading the session with
 * `cookies()` in the shared layout would force every public page to render
 * dynamically and cost the prerendered HTML the SEO requirements depend on. So
 * the link is rendered statically as a signed-out control — the markup that was
 * there before — and this client island updates it once `/api/account/summary`
 * answers. `useAccountSummary` owns that read and its first value is `null`, so
 * the server render and the first client render agree.
 *
 * The control is an icon, not a text label: a person glyph, replaced by the
 * account's own profile picture when one is set, so a signed-in visitor sees
 * themselves in the header. The accessible name still carries the full label
 * ("Sign in" or "Your account"), which is also the hover title.
 *
 * `showLabel` renders the icon with its visible label beside it, for the mobile
 * drawer where there is room and a bare glyph would be a poor target; the desktop
 * bar uses the icon alone to stay inside its width budget.
 */
export function AccountAction({
  locale,
  signInLabel,
  accountLabel,
  size = "sm",
  showLabel = false,
  className,
  onNavigate,
}: {
  locale: Locale;
  signInLabel: string;
  accountLabel: string;
  size?: ButtonSize;
  /** Render the visible label beside the icon (mobile drawer). */
  showLabel?: boolean;
  className?: string;
  /** Called on click, so a host that opens over the page (the mobile drawer) can close. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const summary = useAccountSummary(locale, pathname);

  const signedIn = summary?.signedIn ?? false;
  const href = signedIn
    ? summary?.accountHref ?? `/${locale}/account`
    : "/admin/login";
  const label = signedIn ? accountLabel : signInLabel;
  const avatarUrl = signedIn ? summary?.avatarUrl ?? null : null;

  const box =
    size === "lg" ? "h-12 w-12" : size === "md" ? "h-11 w-11" : "h-10 w-10";
  const icon = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  // With a visible label the control is a bar item, not a square icon.
  if (showLabel) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={buttonClasses({ variant: "accentOnInk", size, className })}
      >
        <AvatarMark url={avatarUrl} icon={icon} />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={label}
      title={label}
      className={`relative inline-flex ${box} shrink-0 items-center justify-center rounded-control text-white/75 transition-soft hover:bg-white/5 hover:text-white ${className ?? ""}`}
    >
      <AvatarMark url={avatarUrl} icon={icon} />
    </Link>
  );
}

/**
 * The icon or profile picture inside the account control.
 *
 * A person glyph is the default so a signed-out visitor and a signed-in one
 * without a picture both read as "account"; a picture replaces it once the
 * account has one. The image is decorative (`alt=""`) because the link's own
 * accessible name already identifies the destination.
 */
function AvatarMark({ url, icon }: { url: string | null; icon: string }) {
  if (url) {
    return (
      <span className={`relative ${icon} shrink-0 overflow-hidden rounded-full`}>
        <Image src={url} alt="" fill sizes="24px" className="object-cover" />
      </span>
    );
  }

  return <User aria-hidden="true" className={icon} />;
}
