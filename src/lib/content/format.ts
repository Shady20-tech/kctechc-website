import type { Locale } from "@/lib/i18n/locales";

/**
 * Locale-aware date formatting for dynamic content.
 *
 * An explicit `timeZone` is set so the printed date is identical on the server
 * and on a client in another zone; without it a date near midnight can render as
 * a different day after hydration. Locales use the Cameroon variants to match the
 * `en-CM` / `fr-CM` annotations the rest of the site advertises.
 */
export function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  // An unparseable date is shown as-is rather than as "Invalid Date".
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CM" : "en-CM", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
