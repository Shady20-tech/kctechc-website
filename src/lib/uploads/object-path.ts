/**
 * Storage object-path validation.
 *
 * Public media URLs are derived from a Storage object path, never from an
 * absolute URL stored in the database. An absolute URL (for example
 * `https://imgur.com/undefined`) is not an object in any bucket, so building a
 * URL from it produces a request that can only fail. This module is the single
 * predicate every public URL builder uses, so a bad value becomes a placeholder
 * instead of a broken image on an admin dashboard or a public page.
 *
 * It intentionally matches the database's object-path shape: a leading
 * alphanumeric, then only letters, digits, `/`, `_`, `.` and `-`. A scheme,
 * authority or leading slash is therefore rejected.
 */

const OBJECT_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

/** True when `value` can name an object inside a public Storage bucket. */
export function isStorageObjectPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (path.length === 0 || path.length > 1024) return false;
  if (path.includes("..")) return false;
  return OBJECT_PATH_PATTERN.test(path);
}

/**
 * True for a bundled `public/` asset path such as
 * `/products/electrical/sako-solar-system.jpg`.
 *
 * Root-relative and free of a scheme, so a database value cannot turn a
 * product card into a request to an unrelated host.
 */
export function isBundledPublicPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("..") &&
    value.length > 1
  );
}
