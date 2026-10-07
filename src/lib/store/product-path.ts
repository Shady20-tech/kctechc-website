import { SOLAR_PACKAGES_PATH, STORE_PATH } from "@/lib/config/redirects";
import { packageBySku } from "@/lib/content/solar-packages";

/**
 * Where a product line should link back to.
 *
 * Most products live in the Digital Marketing store, but the Electrical
 * Services solar packages are seeded as real products too and have their own
 * public surface under `/electrical-services/packages`. Linking a solar line to
 * the store would 404 (the store is scoped to Digital Marketing), so the SKU
 * decides: a known `KC-SOLAR-*` package links to its package page, everything
 * else to its store product page.
 *
 * `sku` is matched against the bundled package list rather than a hardcoded
 * prefix, so a package id that ever changes stays in step with the seed (which
 * uses the same SKUs).
 */
export function productPath(
  locale: string,
  product: { slug: string; sku?: string | null },
): string {
  const pkg = product.sku ? packageBySku(product.sku) : undefined;
  if (pkg) return `/${locale}${SOLAR_PACKAGES_PATH}/${pkg.id}`;
  return `/${locale}${STORE_PATH}/${product.slug}`;
}
