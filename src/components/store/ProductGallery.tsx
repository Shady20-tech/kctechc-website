"use client";

import Image from "next/image";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/locales";
import { productImageSrc } from "@/lib/store/storage";
import type { ProductImage } from "@/lib/store/types";

/**
 * The product gallery.
 *
 * A Client Component because selecting a thumbnail is interaction, while the
 * first image is still rendered on the server with `priority` so it stays the
 * page's LCP candidate. Only the active image is mounted, so a product with six
 * photographs requests one up front rather than six.
 *
 * Kept separate from `ProductImageFrame` so that module stays a Server Component
 * — the card and every other surface import it directly.
 */
export function ProductGallery({
  images,
  sku,
  ariaLabel,
}: {
  images: readonly ProductImage[];
  sku?: string | null;
  locale: Locale;
  ariaLabel: string;
}) {
  const ordered = [...images].sort((a, b) => a.position - b.position);
  const [activeIndex, setActiveIndex] = useState(0);

  if (ordered.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card border border-border bg-surface-sunken">
        <span className="mono-label text-muted">{ariaLabel}</span>
      </div>
    );
  }

  const active = ordered[Math.min(activeIndex, ordered.length - 1)]!;
  const activeSrc = productImageSrc(active, sku);

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-card border border-border bg-surface">
        {activeSrc ? (
          <Image
            src={activeSrc}
            alt={active.alt ?? ""}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>

      {ordered.length > 1 ? (
        <ul
          aria-label={ariaLabel}
          className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5"
        >
          {ordered.slice(0, 5).map((image, index) => {
            const src = productImageSrc(image, sku);
            const isActive = index === activeIndex;
            return (
              <li key={image.publicPath ?? image.storagePath ?? index}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={image.alt ?? undefined}
                  className={`relative block aspect-square w-full overflow-hidden rounded-card border transition-soft ${
                    isActive ? "border-dept-accent" : "border-border"
                  }`}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="20vw"
                      className="object-cover"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
