import { publicEnv } from "@/lib/config/env";

/**
 * Property media URLs.
 *
 * Property media lives in its own Storage bucket, separate from product media
 * and from the private inquiry attachments. The brief requires that separation,
 * and the practical reason is a lifecycle one: a bucket's public/private setting
 * and its retention policy are per bucket, and mixing a property photograph with
 * an owner's scanned title deed in one bucket means the two can never have
 * different rules.
 *
 * The URL is derived from the object path rather than stored, for the same reason
 * as product media: an absolute URL would bake the project ref into the database,
 * so a project migration or a custom domain would break every image.
 */

/** The bucket property images are uploaded to. */
export const PROPERTY_MEDIA_BUCKET = "property-media";

/**
 * Build the public URL for a property image.
 *
 * Returns null when Supabase is unconfigured rather than a broken relative URL,
 * so a card renders its placeholder instead of issuing a request that 404s.
 */
export function propertyMediaPublicUrl(objectPath: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  const clean = objectPath.replace(/^\/+/, "");
  if (clean.length === 0) return null;
  return `${base}/storage/v1/object/public/${PROPERTY_MEDIA_BUCKET}/${clean}`;
}

/**
 * The storage path for a listing image.
 *
 * Namespaced by listing id so two listings cannot collide on a filename, and so
 * removing a listing's media is a single prefix delete. The extension is taken
 * from the supplied name and validated by the caller; this function does not
 * trust it beyond lowercasing it.
 */
export function listingMediaPath(
  listingId: string,
  fileName: string,
  ordinal = 0,
): string {
  const extension = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase()
    : "jpg";
  const safeExtension = /^[a-z0-9]{1,5}$/.test(extension) ? extension : "jpg";
  return `${listingId}/${String(ordinal).padStart(3, "0")}.${safeExtension}`;
}
