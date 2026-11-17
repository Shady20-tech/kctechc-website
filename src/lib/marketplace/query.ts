/**
 * Shared query-string plumbing for every marketplace surface.
 *
 * Filter state lives entirely in the URL on all three departments, so one filter
 * state is one address: shareable, cacheable, back-button correct, and reachable
 * without JavaScript. Each department keeps its own typed filter model — this
 * module only holds the rules that must be identical across them, so a store
 * query and a listing query cannot disagree about how a repeated parameter or a
 * blank value is written.
 */

/** The first value of a possibly-repeated query parameter. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A non-empty, trimmed string, or undefined.
 *
 * Applied to every raw URL value so an empty `?q=` reads as "no filter" rather
 * than as a filter matching the empty string. Without it `/store?q=` and
 * `/store` are two URLs for one page, which is the duplicate-content problem the
 * locale routing rules already guard against.
 */
export function cleanParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Parse a non-negative integer, rejecting a decimal or any non-numeric input. */
export function parsePositiveInt(
  value: string | undefined,
  options: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return undefined;
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

/** Parse a three-letter ISO-shaped currency code, uppercased. */
export function parseCurrencyCode(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}

/**
 * Parse a repeat-or-comma-joined set parameter.
 *
 * Both forms are accepted — `amenity=a&amenity=b` and `amenity=a,b` — because a
 * link this application builds and one pasted by hand should mean the same
 * thing. Values are lowercased, trimmed, de-duplicated and sorted so two URLs
 * describing the same set are one address.
 */
export function parseSetParam(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const values = raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  const unique = [...new Set(values)].sort();
  return unique.length > 0 ? unique : undefined;
}

/**
 * Serialize a filter state as a query string.
 *
 * Built from scratch rather than by patching the incoming params, so a stale
 * value cannot survive a filter change and a tracking parameter is never carried
 * into an internal link. A key absent from the object is absent from the URL.
 *
 * Array values are written as a repeat and sorted, so two links to the same set
 * serialize identically and a set-valued filter has exactly one address.
 */
export function serializeQuery(
  state: Record<
    string,
    string | number | boolean | readonly string[] | undefined
  >,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === false || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of [...value].sort()) {
        if (entry.length > 0) params.append(key, entry);
      }
      continue;
    }
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * The text a search term is matched against, normalized for comparison.
 *
 * Diacritics are stripped so a French visitor typing "electrique" still matches
 * "électrique", and case and surrounding whitespace are removed for the same
 * reason. Shared so an application-side match and a test of it agree.
 */
export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Whether a search term matches any of a set of fields. */
export function matchesSearch(
  term: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const normalized = normalizeSearchText(term);
  if (normalized.length === 0) return true;
  return normalizeSearchText(fields.filter(Boolean).join(" ")).includes(
    normalized,
  );
}
