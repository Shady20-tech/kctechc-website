import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { AddToCartButton } from "@/components/store/AddToCartButton";
import { AvailabilityBadge } from "@/components/store/ProductCard";
import { ProductGallery } from "@/components/store/ProductImageFrame";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { STORE_PATH } from "@/lib/config/navigation";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/structured-data";
import {
  loadCategoryBySlug,
  loadProductBySlug,
  loadProductRecords,
  loadProductsInCategory,
} from "@/lib/store/loaders";
import { isCanonicalUrlSlug } from "@/lib/store/slug-resolution";
import { storagePublicUrl } from "@/lib/store/storage";
import {
  conditionLabelKey,
  formatPrice,
  isPurchasable,
  primaryImage,
} from "@/lib/store/types";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Product detail page.
 *
 * The URL is `/[locale]/digital-marketing/store/[category]/[slug]` where BOTH
 * segments are locale-specific. The category segment is a localized category slug
 * and the slug is the product's localized slug, so the French page lives at
 * `/fr/.../store/ordinateurs/ordinateur-thinkpad-x1` while the English one lives
 * at `/en/.../store/laptops/thinkpad-x1`.
 *
 * Both segments are resolved rather than assumed:
 *
 *   - The category segment resolves through `loadCategoryBySlug`, so a French
 *     category slug is not mistaken for a missing category.
 *   - The product resolves through `loadProductBySlug`, which matches against the
 *     locale's slug and falls back to the canonical one.
 *   - The product must actually belong to the resolved category. Without that
 *     check, `/store/laptops/some-phone` would render a phone under a laptop
 *     heading, and one product would be reachable at two different URLs — the
 *     duplicate-content problem this URL scheme exists to prevent.
 *
 * Structured data is built from the same resolved record the page renders, so the
 * price and availability in the markup are exactly the ones on screen.
 */
export async function generateStaticParams() {
  // Products and categories are read from the database at request time, so no
  // pairs are enumerated here; the route renders on demand and is cached.
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, category: categorySegment, slug } = await params;
  if (!isLocale(locale)) return {};

  const product = await loadProductBySlug(slug, locale);
  if (!product) return {};

  const category = await loadCategoryBySlug(categorySegment, locale);
  if (!category || category.slug !== product.categorySlug) return {};

  return buildMetadata({
    locale,
    // The canonical path uses the product's own locale slug, so the metadata
    // canonical matches the URL actually served.
    pathWithoutLocale: `${STORE_PATH}/${category.slug}/${product.slug}`,
    title: product.seo.title ?? product.title,
    description:
      product.seo.description ??
      product.shortDescription ??
      product.description.slice(0, 160),
    noindex: product.seo.noindex ?? false,
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category: categorySegment, slug } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const product = await loadProductBySlug(slug, resolved);
  if (!product) notFound();

  const category = await loadCategoryBySlug(categorySegment, resolved);
  if (!category) notFound();

  // The product must belong to the category in the URL. A mismatch is a 404: the
  // canonical URL for this product is the one under its own category, and serving
  // it under another would create a second address for the same content.
  if (category.slug !== product.categorySlug) notFound();

  // The canonical slug answers under a target locale so an inbound English link
  // does not break, but it is not the URL to index. A request that arrived by the
  // canonical slug is redirected to the locale's own slug, which is why
  // `slugsForLocale` still lists both as prerenderable: one is the page, the other
  // is the redirect.
  const record = (await loadProductRecords()).find(
    (entry) => entry.id === product.id,
  );
  if (record && !isCanonicalUrlSlug(record, slug, resolved)) {
    const categorySlugForLocale = category.slug;
    permanentRedirect(
      `/${resolved}${STORE_PATH}/${categorySlugForLocale}/${product.slug}`,
    );
  }

  const productPath = `/${resolved}${STORE_PATH}/${category.slug}/${product.slug}`;

  const related = (await loadProductsInCategory(product.categorySlug, resolved))
    .filter((entry) => entry.id !== product.id)
    .slice(0, 3);

  const image = primaryImage(product.images);
  const imageUrl = image ? storagePublicUrl(image.storagePath) : null;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${STORE_PATH}` },
    { name: category.name, href: `/${resolved}${STORE_PATH}/${category.slug}` },
    { name: product.title, href: productPath },
  ];

  const purchasable = isPurchasable(product.availability) && product.stock > 0;

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.store"), path: `/${resolved}${STORE_PATH}` },
          {
            name: category.name,
            path: `/${resolved}${STORE_PATH}/${category.slug}`,
          },
          { name: product.title, path: productPath },
        ])}
      />
      <JsonLdScript
        data={productJsonLd({
          name: product.title,
          description: product.shortDescription || product.description,
          path: productPath,
          locale: resolved,
          sku: product.sku,
          brand: product.brand,
          gtin: product.gtin,
          priceMinor: product.priceMinor,
          currency: product.currency,
          availability: product.availability,
          condition: product.condition,
          imagePath: imageUrl ?? undefined,
        })}
      />

      <SectionBand
        labelledBy="product-heading"
        {...departmentScopeProps("digital-marketing")}
      >
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ProductGallery
            images={product.images}
            locale={resolved}
            ariaLabel={t("a11y.productImages")}
          />

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <AvailabilityBadge availability={product.availability} t={t} />
              <Badge tone="neutral">
                {t(conditionLabelKey(product.condition))}
              </Badge>
            </div>

            <h1
              id="product-heading"
              className="display-tight mt-4 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
            >
              {product.title}
            </h1>

            {product.brand ? (
              <p className="mt-2 text-sm text-muted">{product.brand}</p>
            ) : null}

            <p className="mt-5 text-base leading-relaxed text-body">
              {product.shortDescription}
            </p>

            <p className="mt-6 font-display text-3xl font-bold text-ink-900">
              {formatPrice(product.priceMinor, product.currency, resolved)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("store.product.priceNote")}
            </p>

            {/* Stock is shown as the number of units actually on hand. */}
            <p className="mt-4 text-sm font-medium text-body">
              {product.stock > 0
                ? t("store.product.stockInStock", { count: product.stock })
                : t("store.product.stockNone")}
            </p>

            {/* A product whose details fell back to English tells the reader so,
                rather than silently mixing languages. */}
            {product.hasFallback ? (
              <p className="mt-4 rounded-card border border-teal-300 bg-teal-50 p-4 text-sm text-teal-700">
                {t("store.translationNotice")}
              </p>
            ) : null}

            <div className="mt-8">
              <AddToCartButton
                productId={product.id}
                locale={resolved}
                t={t}
                disabled={!purchasable}
              />
            </div>
          </div>
        </div>
      </SectionBand>

      {product.description ? (
        <SectionBand tone="alt" labelledBy="product-description-heading">
          <div className="max-w-3xl">
            <h2
              id="product-description-heading"
              className="text-xl font-semibold text-ink-900 sm:text-2xl"
            >
              {t("store.product.overviewHeading")}
            </h2>
            {/* Plain text, rendered as paragraphs. The column is plain text in
                the database, so rendering it as markup would be an injection
                surface; whitespace is preserved without interpreting HTML. */}
            <div className="mt-4 space-y-4 text-base leading-relaxed text-body">
              {product.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </SectionBand>
      ) : null}

      {product.specifications.length > 0 ? (
        <SectionBand labelledBy="product-specs-heading">
          <div className="max-w-3xl">
            <h2
              id="product-specs-heading"
              className="text-xl font-semibold text-ink-900 sm:text-2xl"
            >
              {t("store.product.specificationsHeading")}
            </h2>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {product.specifications.map((spec, index) => (
                <div
                  key={`${spec.label}-${index}`}
                  className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt className="text-sm font-medium text-ink-900">
                    {spec.label}
                  </dt>
                  <dd className="text-sm text-body sm:col-span-2">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </SectionBand>
      ) : null}

      <SectionBand tone="alt" labelledBy="product-details-heading">
        <div className="max-w-3xl">
          <h2
            id="product-details-heading"
            className="text-xl font-semibold text-ink-900 sm:text-2xl"
          >
            {t("store.product.detailsHeading")}
          </h2>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-ink-900">
                {t("store.product.skuLabel")}
              </dt>
              <dd className="text-sm text-body sm:col-span-2">{product.sku}</dd>
            </div>
            {product.brand ? (
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-ink-900">
                  {t("store.product.brandLabel")}
                </dt>
                <dd className="text-sm text-body sm:col-span-2">
                  {product.brand}
                </dd>
              </div>
            ) : null}
            {product.gtin ? (
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-ink-900">
                  {t("store.product.gtinLabel")}
                </dt>
                <dd className="text-sm text-body sm:col-span-2">
                  {product.gtin}
                </dd>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-ink-900">
                {t("store.product.conditionLabel")}
              </dt>
              <dd className="text-sm text-body sm:col-span-2">
                {t(conditionLabelKey(product.condition))}
              </dd>
            </div>
          </dl>
        </div>
      </SectionBand>

      {related.length > 0 ? (
        <SectionBand labelledBy="product-related-heading">
          <h2
            id="product-related-heading"
            className="text-xl font-semibold text-ink-900 sm:text-2xl"
          >
            {t("store.product.relatedHeading")}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {related.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/${resolved}${STORE_PATH}/${category.slug}/${entry.slug}`}
                  className="text-sm font-medium text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
                >
                  {entry.title}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {formatPrice(entry.priceMinor, entry.currency, resolved)}
                </p>
              </li>
            ))}
          </ul>
        </SectionBand>
      ) : null}

      <div className="container-page section">
        <p>
          <Link
            href={`/${resolved}${STORE_PATH}/${category.slug}`}
            className="text-sm font-semibold text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
          >
            {t("store.backToCategory")}
          </Link>
        </p>
      </div>
    </>
  );
}
