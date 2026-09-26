import { publicEnv } from "@/lib/config/env";

/**
 * Supabase Storage URL construction.
 *
 * Product images live in a public Storage bucket, so a URL is derived from the
 * object path rather than stored. Storing an absolute URL would bake the project
 * ref into the database, so a project migration or a custom domain would break
 * every image; deriving it means the bucket path is the only durable fact.
 *
 * `next.config.ts` whitelists exactly this host and path prefix in
 * `images.remotePatterns`, so a URL this module produces is the only kind
 * `next/image` will accept.
 */

/** The bucket product media is uploaded to. */
export const PRODUCT_MEDIA_BUCKET = "product-media";

/**
 * Build the public URL for a Storage object.
 *
 * Returns null when Supabase is unconfigured rather than a broken relative URL,
 * so callers can render a placeholder instead of a request that 404s.
 */
export function storagePublicUrl(objectPath: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  const clean = objectPath.replace(/^\/+/, "");
  if (clean.length === 0) return null;
  return `${base}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${clean}`;
}

/**
 * The storage path for a product image.
 *
 * Namespaced by product id so two products cannot collide on a filename, and so
 * deleting a product's media is a single prefix delete.
 */
export function productMediaPath(
  productId: string,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `products/${productId}/${safeName}`;
}
