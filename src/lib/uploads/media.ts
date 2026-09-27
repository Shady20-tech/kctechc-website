import { publicEnv } from "@/lib/config/env";

/**
 * Public media URL construction for the admin-managed buckets.
 *
 * Product and property media each had a small module of their own, written before
 * there was more than one of them. This module is the single implementation they
 * and the newer avatar/media surfaces share, so the URL shape is defined once.
 * The rule it encodes is the same one those modules followed: a public URL is
 * derived from the object path, never stored, because an absolute URL bakes the
 * Supabase project ref into the database and breaks on a migration or a custom
 * domain.
 */

/** Public bucket for profile pictures. */
export const AVATAR_BUCKET = "avatars";

/** Public bucket for article cover images and other editorial media. */
export const CONTENT_MEDIA_BUCKET = "content-media";

/** Public bucket for product photographs. */
export const PRODUCT_MEDIA_BUCKET = "product-media";

/** Public bucket for property photographs. */
export const PROPERTY_MEDIA_BUCKET = "property-media";

/** Public bucket for electrical project photographs. */
export const PROJECT_MEDIA_BUCKET = "project-media";

/**
 * Build the public URL for an object in a public bucket.
 *
 * Returns null when Supabase is unconfigured, or when the path is empty, rather
 * than producing a relative URL that would 404 against the app's own origin.
 */
export function publicBucketUrl(
  bucket: string,
  objectPath: string | null | undefined,
): string | null {
  if (!publicEnv.supabaseUrl) return null;
  if (!objectPath) return null;
  const clean = objectPath.replace(/^\/+/, "");
  if (clean.length === 0) return null;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}

/** Public URL for a profile picture. */
export function avatarPublicUrl(objectPath: string | null | undefined): string | null {
  return publicBucketUrl(AVATAR_BUCKET, objectPath);
}

/** Public URL for an editorial (article cover) image. */
export function contentMediaUrl(objectPath: string | null | undefined): string | null {
  return publicBucketUrl(CONTENT_MEDIA_BUCKET, objectPath);
}

/** Public URL for a product image. */
export function productMediaUrl(objectPath: string | null | undefined): string | null {
  return publicBucketUrl(PRODUCT_MEDIA_BUCKET, objectPath);
}

/** Public URL for a property image. */
export function propertyMediaUrl(objectPath: string | null | undefined): string | null {
  return publicBucketUrl(PROPERTY_MEDIA_BUCKET, objectPath);
}
