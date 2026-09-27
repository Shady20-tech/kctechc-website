"use client";

import Image from "next/image";
import { useState } from "react";

import { propertyMediaPublicUrl } from "@/lib/real-estate/storage";
import type { ListingImage } from "@/lib/real-estate/types";

/**
 * The listing gallery.
 *
 * A Client Component because selecting an image is interaction, but the first
 * image is rendered on the server as the page's LCP candidate — `next/image`
 * with `priority` on the largest one — so the gallery does not delay the first
 * paint. The rest are lazy.
 *
 * The main image is a single `<Image>` that swaps source rather than a stack of
 * all images, so at most two are ever requested up front and a listing with
 * twelve photographs does not download twelve on a phone.
 */
export function ListingGallery({
  images,
  ariaLabel,
  fallbackAlt,
  emptyLabel,
}: {
  images: readonly ListingImage[];
  ariaLabel: string;
  fallbackAlt: string;
  emptyLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-border bg-surface-alt">
        <span className="mono-label text-muted">{emptyLabel}</span>
      </div>
    );
  }

  const active = images[Math.min(activeIndex, images.length - 1)]!;
  const activeUrl = propertyMediaPublicUrl(active.storagePath);

  return (
    <div aria-label={ariaLabel} role="group">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-border bg-surface-alt">
        {activeUrl ? (
          <Image
            src={activeUrl}
            alt={active.alt || fallbackAlt}
            fill
            priority={activeIndex === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>

      {active.caption ? (
        <p className="mt-2 text-sm text-muted">{active.caption}</p>
      ) : null}

      {images.length > 1 ? (
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => {
            const url = propertyMediaPublicUrl(image.storagePath);
            const isActive = index === activeIndex;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-current={isActive ? "true" : undefined}
                  className={`relative block aspect-square w-full overflow-hidden rounded-card border transition-soft ${
                    isActive ? "border-dept-accent" : "border-border"
                  }`}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={image.alt || fallbackAlt}
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
