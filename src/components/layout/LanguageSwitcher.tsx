"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";
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
}: {
  currentLocale: Locale;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex items-center gap-1">
        {LOCALES.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link
                href={buildLocaleSwitchHref(pathname, "", locale)}
                hrefLang={locale}
                aria-current={isCurrent ? "true" : undefined}
                className={
                  isCurrent
                    ? "rounded px-2 py-1 text-sm font-semibold text-navy-900 underline underline-offset-4"
                    : "rounded px-2 py-1 text-sm text-muted hover:text-navy-900"
                }
              >
                {LOCALE_LABELS[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
