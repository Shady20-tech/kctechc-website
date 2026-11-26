import { loadInsightsByIds } from "@/lib/content/loaders";
import type { LocalizedInsight } from "@/lib/content/types";
import type { Locale } from "@/lib/i18n/locales";
import { loadFavoriteListings } from "@/lib/real-estate/loaders";
import type { PropertyListingRecord } from "@/lib/real-estate/types";
import { localizeProduct } from "@/lib/store/defaults";
import { loadProductRecordsByIds } from "@/lib/store/loaders";
import type { LocalizedProduct } from "@/lib/store/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the general customer favourites page.
 *
 * The three saved-entity tables are read with the **session** client, so their
 * own-row policies scope every row to `auth.uid()`. The entity loaders below are
 * the public ones, which means a saved product or article that has since been
 * unpublished drops out of the list instead of exposing a draft through a saved
 * id.
 *
 * Every loader returns an empty list on failure. The page then renders its honest
 * empty state rather than a 500, which is the same degradation the rest of the
 * catalogue uses when Supabase is unreachable.
 */

export type FavoriteCollections = {
  listings: PropertyListingRecord[];
  products: LocalizedProduct[];
  insights: LocalizedInsight[];
};

export async function loadFavoriteProducts(
  locale: Locale,
): Promise<LocalizedProduct[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data: favorites } = await supabase
      .from("product_favorites")
      .select("product_id, created_at")
      .order("created_at", { ascending: false });

    if (!favorites || favorites.length === 0) return [];

    const ids = favorites.map((row) => row.product_id).filter(Boolean);
    const records = await loadProductRecordsByIds(ids);
    return records.map((record) => localizeProduct(record, locale));
  } catch {
    return [];
  }
}

export async function loadFavoriteInsights(
  locale: Locale,
): Promise<LocalizedInsight[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data: favorites } = await supabase
      .from("insight_favorites")
      .select("insight_id, created_at")
      .order("created_at", { ascending: false });

    if (!favorites || favorites.length === 0) return [];

    const ids = favorites.map((row) => row.insight_id).filter(Boolean);
    return loadInsightsByIds(ids, locale);
  } catch {
    return [];
  }
}

/** The saved items across all three types, in each type's saved order. */
export async function loadFavoriteCollections(
  locale: Locale,
): Promise<FavoriteCollections> {
  const [listings, products, insights] = await Promise.all([
    loadFavoriteListings(),
    loadFavoriteProducts(locale),
    loadFavoriteInsights(locale),
  ]);

  return { listings, products, insights };
}

/** How many items the account has saved, for the account-hub tile. */
export async function loadFavoriteTotal(): Promise<number> {
  try {
    const supabase = await createClient();
    if (!supabase) return 0;

    const [listings, products, insights] = await Promise.all([
      supabase
        .from("listing_favorites")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("product_favorites")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("insight_favorites")
        .select("id", { count: "exact", head: true }),
    ]);

    return (
      (listings.count ?? 0) + (products.count ?? 0) + (insights.count ?? 0)
    );
  } catch {
    return 0;
  }
}
