import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

/**
 * Resolve the seeded solar-package products to their product-row ids.
 *
 * The public package pages are driven by the bundled brochure data
 * (`src/lib/content/solar-packages.ts`), but adding a package to the cart needs
 * the database product id — the cart is database-backed and the price is re-read
 * server-side from the product row.
 *
 * This returns a `{ [sku]: productId }` map for the Electrical Services
 * department's published `KC-SOLAR-*` products. It reads through the anonymous,
 * RLS-bound client, so "draft products are not public" is enforced by the
 * database rather than by a filter this code could forget. On any failure it
 * returns an empty map, and the UI degrades to request-info only rather than
 * offering a cart action that cannot succeed.
 */
export async function loadSolarPackageProductIds(): Promise<
  Record<string, string>
> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return {};

    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", "electrical-services")
      .maybeSingle();
    if (!department) return {};

    const { data: categories } = await supabase
      .from("product_categories")
      .select("id")
      .eq("department_id", department.id)
      .eq("publish_state", "published");
    if (!categories || categories.length === 0) return {};

    const { data: products, error } = await supabase
      .from("products")
      .select("id, sku")
      .in(
        "category_id",
        categories.map((category) => category.id),
      )
      .like("sku", "KC-SOLAR-%")
      .eq("publish_state", "published");

    if (error || !products) return {};

    return Object.fromEntries(
      products.map((product) => [product.sku, product.id]),
    );
  } catch {
    return {};
  }
}
