"use client";

import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import { useAccountSummary } from "@/lib/hooks/use-account-summary";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * The public header's "return to your dashboard" control.
 *
 * A signed-in dashboard user — a console role, or a customer holding an approved
 * landlord/agent capability — sees a link back to their workspace while browsing
 * the public site. An ordinary customer sees nothing, because they have no
 * dashboard; the header keeps offering the account hub to them instead.
 *
 * The header is a Server Component and must stay one, so the decision cannot be
 * made there without reading `cookies()` and making every public page dynamic. It
 * is therefore a client island, and the shared account summary
 * (`useAccountSummary` + `/api/account/summary`) supplies the answer — the same
 * store the account icon reads, so one request answers both controls rather than
 * two islands asking the server about the same session. Nothing renders until the
 * answer arrives, so the server and first client render agree and there is no
 * hydration mismatch.
 *
 * The label is resolved from a message key rather than a server-sent string: a
 * translator function cannot cross the Server/Client boundary, and the translator
 * is pure and isomorphic, so the island translates its own copy.
 *
 * `compact` renders the icon alone for the desktop bar, whose width budget is
 * binding in French; the accessible name carries the destination there. The
 * mobile drawer uses the full label, where there is room.
 */
export function DashboardReturnAction({
  locale,
  size = "sm",
  compact = false,
  className,
  onNavigate,
}: {
  locale: Locale;
  size?: ButtonSize;
  /** Icon-only, for the narrow desktop bar. The label moves to `aria-label`. */
  compact?: boolean;
  className?: string;
  /** Called on click, so a host that opens over the page (the drawer) can close. */
  onNavigate?: () => void;
}) {
  const t = createTranslator(locale).t;
  const pathname = usePathname();
  const home = useAccountSummary(locale, pathname)?.dashboard ?? null;

  if (!home) return null;

  const label = t(home.labelKey);

  return (
    <Link
      href={home.href}
      onClick={onNavigate}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={buttonClasses({
        variant: "accentOnInk",
        size,
        className: compact ? `px-2.5 ${className ?? ""}` : className,
      })}
    >
      <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
      {compact ? null : <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
