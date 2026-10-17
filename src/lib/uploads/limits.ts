/**
 * Upload size limits.
 *
 * These live in a module with no imports of its own so the numbers can be shared
 * by three callers that must agree but cannot share code:
 *
 *   - `validation.ts`, which enforces them server-side against the real bytes;
 *   - the admin media forms, which warn a user before a doomed upload starts; and
 *   - `next.config.ts`, which is transpiled standalone before the `@/` alias
 *     exists and so can only reach a leaf module (the same constraint that keeps
 *     the redirect table a leaf — see `src/lib/config/redirects.ts`).
 *
 * Keeping the numbers here rather than in `validation.ts` also keeps that module
 * free of a client-side `node:crypto` import: an editor form that only needs a
 * limit should not drag a Node built-in toward the browser bundle.
 */

/** The largest attachment accepted, matching the private bucket's limit. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** The largest project image accepted, matching the public bucket's limit. */
export const MAX_PROJECT_IMAGE_BYTES = 5 * 1024 * 1024;

/** The largest editorial image (article cover) accepted. */
export const MAX_CONTENT_IMAGE_BYTES = 5 * 1024 * 1024;

/** The largest profile picture accepted, matching the `avatars` bucket. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** The largest product image accepted, matching the `product-media` bucket. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

/** The largest property image accepted, matching the `property-media` bucket. */
export const MAX_PROPERTY_IMAGE_BYTES = 10 * 1024 * 1024;

/** How many files one quote request may attach. */
export const MAX_ATTACHMENT_COUNT = 5;

/**
 * The largest image an editor may upload through any authoring form.
 *
 * Property photography sets the ceiling (10 MiB), so this is the figure the
 * Server Action body limit has to clear. It is derived rather than written twice
 * so raising a bucket's limit and forgetting this one is not possible.
 */
export const MAX_EDITOR_IMAGE_BYTES = Math.max(
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_CONTENT_IMAGE_BYTES,
  MAX_PROJECT_IMAGE_BYTES,
  MAX_PROPERTY_IMAGE_BYTES,
);

/**
 * The Next.js Server Action request-body limit, in bytes.
 *
 * A file the editor picks from their device travels to a Server Action as a
 * `multipart/form-data` body, and Next.js refuses a body over
 * `experimental.serverActions.bodySizeLimit` — **1 MB by default** — before the
 * action's code ever runs. Every media form in this app posts that way, so with
 * the default a phone photograph of 2-8 MB was rejected with no message the
 * editor could act on, and the feature looked like it silently did nothing.
 *
 * The limit is the largest accepted image plus a margin for the multipart
 * boundaries, part headers and field metadata that ride alongside the bytes
 * (Next's own guidance is 10-20 KB of overhead for a typical upload). The
 * per-kind checks in `validation.ts` remain the real control on what is stored;
 * this only lets a legitimate file reach them.
 */
export const SERVER_ACTION_BODY_SIZE_LIMIT =
  MAX_EDITOR_IMAGE_BYTES + 2 * 1024 * 1024;

/**
 * True when a chosen file is over `maxBytes`.
 *
 * The admin forms call this from the file input's `onChange` so an obviously
 * oversized file is reported before the upload starts, rather than after the
 * bytes have crossed the network and been refused. It is a courtesy, not a
 * control: the server re-checks the real bytes in `validation.ts`.
 */
export function exceedsSizeLimit(
  file: { size: number } | null | undefined,
  maxBytes: number,
): boolean {
  return Boolean(file && file.size > maxBytes);
}

/** A byte count as a whole number of megabytes, for user-facing copy. */
export function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
