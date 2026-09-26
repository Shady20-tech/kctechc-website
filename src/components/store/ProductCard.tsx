import Link from "next/link";
import { ProductImageFrame } from "./ProductImageFrame";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { STORE_PATH } from "@/lib/config/navigation";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { primaryImage } from "@/lib/store/types";
import {
  availabilityLabelKey,
  formatPrice,
  type LocalizedProduct,
  type ProductAvailability,
} from "@/lib/store/types";

/**
 * Product card, used by the store and category indexes.
 *
 * The whole card is one link, and the image is decorative within it: the product
 * name is the accessible link text, so a screen reader announces the product
 * rather than "image, image". The image keeps its own `alt` because it is
 * meaningful content in the card's visual design.
 */

/** Availability badge tone. Colour reinforces the label, never replaces it. */
const AVAILABILITY_TONE: Record<ProductAvailability, BadgeTone> = {
  in_stock: "success",
  out_of_stock: "danger",
  preorder: "warning",
  backorder: "warning",
  discontinued: "neutral",
};

export function AvailabilityBadge({
  availability,
  t,
}: {
  availability: ProductAvailability;
  t: Translator["t"];
}) {
  return (
    <Badge tone={AVAILABILITY_TONE[availability]}>
      {t(availabilityLabelKey(availability))}
    </Badge>
  );
}

export function ProductCard({
  product,
  locale,
  t,
}: {
  product: LocalizedProduct;
  locale: Locale;
  t: Translator["t"];
}) {
  const image = primaryImage(product.images);
  const href = `/${locale}${STORE_PATH}/${product.categorySlug}/${product.slug}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-soft hover:border-border-strong">
      <Link
        href={href}
        className="flex h-full flex-col focus-visible:outline-none"
      >
        <div className="overflow-hidden border-b border-border bg-surface-sunken">
          <ProductImageFrame
            image={image}
            locale={locale}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="aspect-square w-full object-cover transition-soft group-hover:scale-[1.02]"
          />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-ink-900 transition-soft group-hover:text-dept-accent">
              {product.title}
            </h3>
            <AvailabilityBadge availability={product.availability} t={t} />
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-body">
            {product.shortDescription}
          </p>

          <p className="mt-4 font-display text-lg font-bold text-ink-900">
            {formatPrice(product.priceMinor, product.currency, locale)}
          </p>

          {/* A product whose details fell back to English says so on the card, so
              the notice is visible before the visitor opens the page. */}
          {product.hasFallback ? (
            <p className="mt-2 text-xs text-muted">
              {t("store.translationNotice")}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

/**
 * Product grid.
 *
 * A plain list: the cards are peers with no inherent order, so a `<ul>` of
 * `<li>` is the honest structure and it gives assistive technology the item
 * count for free.
 */
export function ProductGrid({
  products,
  locale,
  t,
}: {
  products: readonly LocalizedProduct[];
  locale: Locale;
  t: Translator["t"];
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id} className="h-full">
          <ProductCard product={product} locale={locale} t={t} />
        </li>
      ))}
    </ul>
  );
}
