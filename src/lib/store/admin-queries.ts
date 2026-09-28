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
  images: ProductImage[];
};

export async function loadProductForAdmin(
  id: string,
): Promise<AdminProduct | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("products")
    .select(
      "id, category_id, slug, sku, title, short_description, description, price_minor, currency, stock, publish_state, published_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;

  const [{ data: category }, { data: media }] = await Promise.all([
    admin
      .from("product_categories")
      .select("id, slug, name")
      .eq("id", row.category_id)
      .maybeSingle(),
    admin
      .from("product_media")
      .select("storage_path, alt_text, is_primary, position")
      .eq("product_id", id)
      .order("position", { ascending: true }),
  ]);

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
    images: (media ?? []).map((m) => ({
      storagePath: m.storage_path,
      alt: m.alt_text,
      isPrimary: m.is_primary,
      position: m.position,
    })),
  };
}
