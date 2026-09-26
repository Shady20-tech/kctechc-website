import type { Locale } from "./locales";
import {
  STATIC_MESSAGES,
  interpolate,
  lookupMessage,
  type Messages,
} from "./messages";

export type TranslateValues = Record<string, string | number>;

export type Translator = {
  /** Translate a static UI key, optionally interpolating `{token}` values. */
  t: (key: string, values?: TranslateValues) => string;
  locale: Locale;
  /** The raw dictionary, for passing a whole namespace into a Client Component. */
  messages: Messages;
};

/**
 * Server-side translator for static UI text.
 *
 * Static text is served from the bundled dictionaries so a page always renders
 * even when Tolgee is unreachable. Tolgee remains the authoring/management layer
 * and is hydrated on top in the browser for editing workflows.
 */
export function createTranslator(locale: Locale): Translator {
  const messages = STATIC_MESSAGES[locale];
  const fallback = STATIC_MESSAGES.en;

  return {
    locale,
    messages,
    t(key, values) {
      const template =
        lookupMessage(messages, key) ?? lookupMessage(fallback, key) ?? key;
      return interpolate(template, values);
    },
  };
}
