import { SOLAR_PACKAGES_PATH, storePathFor } from "@/lib/config/redirects";
import { packageBySku } from "@/lib/content/solar-packages";

/**
 * The cart path for a department.
 *
 * The cart lives at `/{locale}/{department}/store/cart`, so a link to it has to
 * name the department. Kept here beside `productPath` because both are pure,
 * client-safe link builders shared by the server (which resolves the department
 * from the cart's lines) and the header island (which falls back to the default
 * store before the summary has loaded).
 */
export function cartPathFor(
  locale: string,
  departmentSlug?: string | null,
): string {
  return `/${locale}${storePathFor(departmentSlug || "digital-marketing")}/cart`;
}

/**
 * Where a product line should link back to.
 *
 * A produced link has to name the *department* store and the *category*, not just
 * the slug: the product detail route is
 * `/{locale}/{department}/store/{category}/{slug}`, so a link missing either
 * segment 404s. The category and department therefore travel with the line, which
 * is why `CartLine` and `OrderLine` carry them.
 *
 * The Electrical Services solar packages are the one exception. They are seeded
 * as real products, but their public surface is the brochure page under
 * `/electrical-services/packages`, so a known `KC-SOLAR-*` SKU links there. `sku`
 * is matched against the bundled package list rather than a hardcoded prefix, so
 * a package id that ever changes stays in step with the seed (which uses the same
 * SKUs).
 *
 * When the category is unknown — a line written before the column existed — the
 * link falls back to the department store index rather than to a URL that cannot
 * resolve.
 */
export function productPath(
  locale: string,
  product: {
    slug: string;
    sku?: string | null;
    categorySlug?: string | null;
    departmentSlug?: string | null;
  },
): string {
  const pkg = product.sku ? packageBySku(product.sku) : undefined;
  if (pkg) return `/${locale}${SOLAR_PACKAGES_PATH}/${pkg.id}`;

  const department = product.departmentSlug || "digital-marketing";
  const store = storePathFor(department);
  if (!product.categorySlug) return `/${locale}${store}`;
  return `/${locale}${store}/${product.categorySlug}/${product.slug}`;
}
