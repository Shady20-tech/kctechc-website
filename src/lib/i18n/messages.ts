import type { Locale } from "./locales";
import en from "./messages/en.json";
import fr from "./messages/fr.json";

/**
 * Static UI text only. Dynamic database content is localized through the
 * Supabase translation tables and the `translation_entries` index, never here.
 */
export type Messages = typeof en;

export const STATIC_MESSAGES: Record<Locale, Messages> = {
  en,
  fr,
};

/**
 * Dot-path lookup used by the server-side translator. Missing keys return the
 * key itself so a gap is visible in the UI instead of rendering `undefined`.
 */
export function lookupMessage(
  messages: Messages,
  key: string,
): string | undefined {
  const segments = key.split(".");
  let current: unknown = messages;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/** Minimal `{token}` interpolation; keeps ICU out of the client bundle. */
export function interpolate(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}
