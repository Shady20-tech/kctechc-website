import { createTranslator, type Translator } from "@/lib/i18n/translator";

/**
 * Resolve a flat label map for an admin surface.
 *
 * Several admin components are Client Components and cannot call the translator
 * themselves (a function cannot cross the Server/Client boundary), so the server
 * resolves the strings and passes them down. This helper turns a list of keys into
 * that map, keeping the key list beside the component that consumes it rather than
 * scattered through a page.
 */
export function resolveLabels(
  t: Translator["t"],
  keys: readonly string[],
  prefix?: string,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const key of keys) {
    const full = prefix ? `${prefix}.${key}` : key;
    labels[prefix ? key : full] = t(full);
  }
  return labels;
}

/** Convenience: a translator plus a `labels` resolver bound to a prefix. */
export function adminTranslator(prefix: string) {
  const t = createTranslator("en").t;
  return {
    t,
    labels: (keys: readonly string[]) => resolveLabels(t, keys, prefix),
  };
}
