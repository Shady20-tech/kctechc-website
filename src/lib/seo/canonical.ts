import { getSiteUrl } from "@/lib/config/env";
import {
  buildLocaleAlternates,
  stripLocaleFromPath,
  withLocale,
} from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Canonical and alternate-URL helpers.
 *
 * Canonical URLs are always absolute and always locale-qualified so locale
 * routing can never produce duplicate content.
 */

export function canonicalFor(
  locale: Locale,
  pathWithoutLocale: string,
): string {
  return new URL(withLocale(locale, pathWithoutLocale), getSiteUrl()).toString();
}

export function alternatesFor(
  pathWithoutLocale: string,
): Record<string, string> {
  return buildLocaleAlternates(pathWithoutLocale, getSiteUrl());
}

/** Derive the locale-relative path from a concrete pathname. */
export function pathWithoutLocaleFrom(pathname: string): string {
  return stripLocaleFromPath(pathname).pathWithoutLocale;
}

/** Absolute URL for an OG/social image path. */
export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}
