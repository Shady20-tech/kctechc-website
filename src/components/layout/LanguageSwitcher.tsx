"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  LOCALES,
  type Locale,
} from "@/lib/i18n/locales";
import { buildLocaleSwitchHref } from "@/lib/i18n/routing";

/**
 * Language switcher.
 *
 * Builds each target URL from the current path so switching language keeps the
 * visitor on the same page. `hreflang` is set on every link, which reinforces
 * the reciprocal alternate annotations declared in page metadata.
 *
 * Only `usePathname` is read. `useSearchParams` would force every page using the
 * header into a client-side-render bailout, which would cost us the prerendered
 * markup and its correct `hreflang` links; carrying filter query state across a
 * language switch is a later-phase concern, not worth that trade.
 */
export function LanguageSwitcher({
  currentLocale,
  label,
  className,
  tone = "dark",
  compact = false,
}: {
  currentLocale: Locale;
  label: string;
  className?: string;
  /** `light` is for use on the dark ink header; `dark` for light surfaces. */
  tone?: "dark" | "light";
  /**
   * Renders the two-letter codes instead of the full language names. Used on the
   * narrow end of the header, where the full names plus the logo and the menu
   * button exceed the viewport and give the whole page a horizontal scrollbar.
   * The accessible name is unaffected — see the `aria-label` below.
   */
  compact?: boolean;
}) {
  const pathname = usePathname();

  const activeClass =
    tone === "light"
      ? "rounded-card px-2.5 py-1.5 text-sm font-semibold text-white underline decoration-teal-300 decoration-2 underline-offset-4"
      : "rounded-card px-2.5 py-1.5 text-sm font-semibold text-ink-900 underline decoration-2 underline-offset-4";
  const idleClass =
    tone === "light"
      ? "rounded-card px-2.5 py-1.5 text-sm text-white/60 transition-soft hover:bg-white/5 hover:text-white"
      : "rounded-card px-2.5 py-1.5 text-sm text-muted transition-soft hover:text-ink-900";

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex items-center gap-0.5">
        {LOCALES.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link
                href={buildLocaleSwitchHref(pathname, "", locale)}
                hrefLang={locale}
                aria-current={isCurrent ? "true" : undefined}
                // The visible text is an abbreviation in compact mode, so the
                // full language name is supplied here rather than left as "EN".
                aria-label={compact ? LOCALE_LABELS[locale] : undefined}
                className={isCurrent ? activeClass : idleClass}
              >
                {compact ? LOCALE_SHORT_LABELS[locale] : LOCALE_LABELS[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
