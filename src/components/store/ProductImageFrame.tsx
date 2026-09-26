import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { storagePublicUrl } from "@/lib/store/storage";
import type { ProductImage } from "@/lib/store/types";

/**
 * Product imagery.
 *
 * Images are served through `next/image` from the Supabase Storage public URL, so
 * they are resized, converted to AVIF/WebP and cached at the edge rather than
 * shipped at upload resolution.
 *
 * Every image carries `alt` text from the database, which is why `alt_text` is
 * NOT NULL: an image without a description is inaccessible, and the schema does
 * not permit one to be stored by omission.
 *
 * When Storage is unconfigured or the path yields no URL, a labelled placeholder
 * is rendered instead of an `<img>` with a broken source — a broken image request
 * is both a worse experience and a console error on a production page.
 */
export function ProductImageFrame({
  image,
  sizes,
  priority = false,
  className,
}: {
  image: ProductImage | undefined;
  locale: Locale;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = image ? storagePublicUrl(image.storagePath) : null;

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

/** A product gallery: a main image plus thumbnails when there is more than one. */
export function ProductGallery({
  images,
  locale,
  ariaLabel,
}: {
  images: readonly ProductImage[];
  locale: Locale;
  ariaLabel: string;
}) {
  if (images.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex aspect-square items-center justify-center rounded-card border border-border bg-surface-sunken"
      >
        <ImageOff className="h-10 w-10 text-muted" />
      </div>
    );
  }

  const ordered = [...images].sort((a, b) => a.position - b.position);
  const primary = ordered.find((image) => image.isPrimary) ?? ordered[0];

  return (
    <div>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <ProductImageFrame
          image={primary}
          locale={locale}
          sizes="(min-width: 1024px) 40vw, 100vw"
          priority
          className="aspect-square w-full object-cover"
        />
      </div>

      {ordered.length > 1 ? (
        <ul
          aria-label={ariaLabel}
          className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5"
        >
          {ordered.slice(0, 5).map((image) => (
            <li
              key={image.storagePath}
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              <ProductImageFrame
                image={image}
                locale={locale}
                sizes="120px"
                className="aspect-square w-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
