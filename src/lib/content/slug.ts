/**
 * URL-slug generation shared by every authoring surface.
 *
 * A title is the only thing a publisher should have to type. The generated slug
 * is stable, ASCII and hyphenated so it satisfies every table's check constraint,
 * and `uniqueSlug` makes a second item with the same title land on `-2` rather
 * than failing the create with a duplicate-key error.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

export function slugifyTitle(
  title: string,
  fallback: string,
  maxLength = 160,
): string {
  const slug = title
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug || fallback;
}

function withSuffix(base: string, suffix: string, maxLength: number): string {
  const trimmed = base.slice(0, Math.max(1, maxLength - suffix.length));
  return `${trimmed.replace(/-+$/g, "")}${suffix}`;
}

/**
 * Resolve a slug no existing row uses.
 *
 * `exists` is a database lookup supplied by the action, because each table owns
 * its own uniqueness rule. After the numbered attempts a short random suffix is
 * used, which also makes a simultaneous duplicate create recoverable rather than
 * a hard failure.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  maxLength = 160,
  attempts = 20,
): Promise<string> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidate = withSuffix(base, suffix, maxLength);
    if (!(await exists(candidate))) return candidate;
  }

  const random = Math.random().toString(36).slice(2, 8);
  return withSuffix(base, `-${random}`, maxLength);
}
