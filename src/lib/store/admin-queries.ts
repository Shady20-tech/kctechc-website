import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductImage } from "./types";

/**
 * Admin reads for the store that the public loaders cannot serve.
 *
 * `loadProductRecords` deliberately reads through the anonymous, RLS-bound client
 * so that "a draft is not public" is enforced by the database. That makes it
 * useless to the console, which must show drafts — the very records an editor is
 * working on. These queries use the service-role client instead, and are only
 * ever called from a page or action that has already authorized an elevated role.
 */

export type AdminProduct = {
  id: string;
  slug: string;
  sku: string;
  title: string;
  shortDescription: string;
  description: string;
  priceMinor: number;
  currency: string;
  stock: number;
  publishState: string;
  publishedAt: string | null;
  updatedAt: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  departmentSlug: string;
  brand: string;
  productReference: string;
  seoTitle: string;
  seoDescription: string;
  images: ProductImage[];
};

/**
 * Every product the caller may manage, newest first.
 *
 * `loadProductRecords` cannot serve the console: it reads through the anonymous
 * client and filters to `publish_state = 'published'`, so a draft the editor has
 * just created would be invisible and the "add an image, then publish" flow could
 * never be completed. This reads through the service-role client, but the
 * department boundary still applies — `departmentSlugs` is what the caller may
 * author, so a department editor sees only their own department's products and a
 * super admin (whose list is every department) sees all of them.
 */
export async function listProductsForAdmin(
  departmentSlugs: readonly string[],
): Promise<readonly AdminProduct[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  if (departmentSlugs.length === 0) return [];

  const { data: departmentRows } = await admin
    .from("departments")
    .select("id")
    .in("slug", [...departmentSlugs]);
  if (!departmentRows || departmentRows.length === 0) return [];

  const { data: categories } = await admin
    .from("product_categories")
    .select("id, slug, name, departments(slug)")
    .in(
      "department_id",
      departmentRows.map((row) => row.id),
    );
  if (!categories || categories.length === 0) return [];

  const categoryById = new Map(
    categories.map((row) => [
      row.id,
      {
        slug: row.slug,
        name: row.name,
        departmentSlug:
          (row.departments as { slug: string } | null)?.slug ?? "",
      },
    ]),
  );

  const { data: rows } = await admin
    .from("products")
    .select(
      "id, category_id, slug, sku, product_reference, title, short_description, description, brand, price_minor, currency, stock, publish_state, published_at, updated_at",
    )
    .in(
      "category_id",
      categories.map((row) => row.id),
    )
    .order("updated_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  const { data: media } = await admin
    .from("product_media")
    .select("id, product_id, storage_path, alt_text, is_primary, position")
    .in(
      "product_id",
      rows.map((row) => row.id),
    )
    .order("position", { ascending: true });

  const mediaByProduct = new Map<string, ProductImage[]>();
  for (const row of media ?? []) {
    const list = mediaByProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      storagePath: row.storage_path,
      alt: row.alt_text,
      isPrimary: row.is_primary,
      position: row.position,
    });
    mediaByProduct.set(row.product_id, list);
  }

  return rows.map((row) => {
    const category = categoryById.get(row.category_id);
    return {
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      title: row.title,
      shortDescription: row.short_description,
      description: row.description,
      priceMinor: row.price_minor,
      currency: row.currency,
      stock: row.stock,
      publishState: row.publish_state,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      categoryId: row.category_id,
      categoryName: category?.name ?? "—",
      categorySlug: category?.slug ?? "",
      departmentSlug: category?.departmentSlug ?? "",
      brand: row.brand ?? "",
      productReference: row.product_reference,
      seoTitle: "",
      seoDescription: "",
      images: mediaByProduct.get(row.id) ?? [],
    };
  });
}

export async function loadProductForAdmin(
  id: string,
  departmentSlugs: readonly string[],
): Promise<AdminProduct | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  if (departmentSlugs.length === 0) return null;

  const { data: row, error } = await admin
    .from("products")
    .select(
      "id, category_id, slug, sku, product_reference, title, short_description, description, brand, price_minor, currency, stock, publish_state, published_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;

  const [{ data: category }, { data: media }, { data: seo }] = await Promise.all([
    admin
      .from("product_categories")
      .select("id, slug, name, departments(slug)")
      .eq("id", row.category_id)
      .maybeSingle(),
    admin
      .from("product_media")
      .select("id, storage_path, alt_text, is_primary, position")
      .eq("product_id", id)
      .order("position", { ascending: true }),
    admin
      .from("entity_seo")
      .select("title, description")
      .eq("entity_type", "product")
      .eq("entity_id", id)
      .eq("locale", "en")
      .maybeSingle(),
  ]);

  // Scoped, not just the list: a published product in another department is
  // world-readable through the public policy, so a guessed id would otherwise
  // open an edit form whose save the department write policy then refuses. This
  // makes the page and the database agree — a cross-department id is a 404.
  const departmentSlug =
    (category?.departments as { slug: string } | null)?.slug ?? "";
  if (!departmentSlug || !departmentSlugs.includes(departmentSlug)) return null;

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    priceMinor: row.price_minor,
    currency: row.currency,
    stock: row.stock,
    publishState: row.publish_state,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    categoryId: row.category_id,
    categoryName: category?.name ?? "—",
    categorySlug: category?.slug ?? "",
    departmentSlug,
    brand: row.brand ?? "",
    productReference: row.product_reference,
    seoTitle: seo?.title ?? "",
    seoDescription: seo?.description ?? "",
    images: (media ?? []).map((m) => ({
      id: m.id,
      storagePath: m.storage_path,
      alt: m.alt_text,
      isPrimary: m.is_primary,
      position: m.position,
    })),
  };
}
