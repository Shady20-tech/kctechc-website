export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * SEO language-region annotations. URL segments stay `/en` and `/fr` for
 * usability, while `hreflang` advertises the Cameroon-specific variants.
 */
export const LOCALE_SEO_TAGS: Record<Locale, string> = {
  en: "en-CM",
  fr: "fr-CM",
};

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the best locale for a request. Accept-Language quality values are
 * honoured so a French-preferring browser is served `/fr` on the localized tree;
 * the corporate root never guesses and stays language-neutral.
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | null,
): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qualityParam = params.find((param) => param.trim().startsWith("q="));
      const quality = qualityParam
        ? Number.parseFloat(qualityParam.split("=")[1] ?? "")
        : 1;
      return {
        tag: (tag ?? "").trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    const base = entry.tag.split("-")[0] ?? "";
    if (isLocale(base)) return base;
  }
  return null;
}
