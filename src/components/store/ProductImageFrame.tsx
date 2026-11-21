import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { productImageSrc } from "@/lib/store/storage";
import type { ProductImage } from "@/lib/store/types";

/**
 * Product imagery.
 *
 * Images are served through `next/image` from either the Supabase Storage public
 * URL or the bundled `public/` catalogue (the seeded solar packages), resized,
 * converted to AVIF/WebP and cached at the edge rather than shipped at upload
 * resolution.
 *
 * Every image carries `alt` text from the database, which is why `alt_text` is
 * NOT NULL: an image without a description is inaccessible, and the schema does
 * not permit one to be stored by omission.
 *
 * When nothing resolves — Storage unconfigured, or a path that yields no URL — a
 * labelled placeholder is rendered instead of an `<img>` with a broken source: a
 * broken image request is both a worse experience and a console error on a
 * production page.
 */
export function ProductImageFrame({
  image,
  sku,
  sizes,
  priority = false,
  className,
}: {
  image: ProductImage | undefined;
  /** The product's SKU, so a seeded package resolves to its bundled image. */
  sku?: string | null;
  locale: Locale;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = image ? productImageSrc(image, sku) : null;

  if (!src || !image) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-surface-sunken ${className ?? ""}`}
      >
        <ImageOff className="h-8 w-8 text-muted" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={image.alt}
      // Dimensions come from the database when known; the fallback ratio keeps
      // the layout stable for an image whose dimensions were not recorded.
      width={800}
      height={800}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
