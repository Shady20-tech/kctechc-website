import { packageBySku } from "@/lib/content/solar-packages";
import { publicEnv } from "@/lib/config/env";
import type { ProductImage } from "./types";

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

/**
 * The bundled image for a seeded solar package, or null for any other product.
 *
 * The nine `KC-SOLAR-*` packages are seeded as real products with a
 * `product_media` row so they satisfy the publish-requires-media rule, but their
 * `storage_path` is a placeholder (`electrical/packages/<slug>.jpg`) that is never
 * uploaded to Storage. Their real imagery ships in `public/products/electrical/`
 * and is what the brochure pages render, so a store card, gallery or cart line for
 * a package resolves here instead of requesting a Storage object that does not
 * exist (which the image optimizer answers with a 400 and a broken-image box).
 *
 * Matched by SKU through the bundled package list, the same stable join
 * `productPath` uses, so a package whose id changes stays in step with the seed.
 */
export function seededImage(sku: string | null | undefined): string | null {
  if (!sku) return null;
  return packageBySku(sku)?.image ?? null;
}

/**
 * Resolve a product image to a `next/image` source.
 *
 * A bundled image (`publicPath`, or a seeded package matched by SKU) takes
 * precedence over Storage, because the seeded packages' `storage_path` is a
 * placeholder that was never uploaded. Returns null when nothing resolves, so a
 * caller can render a placeholder instead of a request that 404s.
 */
export function productImageSrc(
  image: Pick<ProductImage, "storagePath" | "publicPath">,
  sku?: string | null,
): string | null {
  if (image.publicPath) return image.publicPath;
  const seeded = seededImage(sku);
  if (seeded) return seeded;
  return image.storagePath ? storagePublicUrl(image.storagePath) : null;
}
