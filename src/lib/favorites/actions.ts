"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  isFavoriteEntityType,
  type FavoriteActionResult,
} from "@/lib/favorites/types";

type SessionClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Add or remove one saved item from the signed-in customer's favourites.
 *
 * One action for all three entity types, because the control is the same heart
 * and the client should not have to know which table backs the card. The type is
 * validated against the closed list before any query runs.
 *
 * Every write uses the **session** client. The three tables restrict each row to
 * `auth.uid() = user_id`, so the database refuses a write aimed at another
 * account even if this module were wrong about the caller. Using the service-role
 * client here would make those policies decorative.
 *
 * The current state is read from the database rather than trusted from the
 * caller: a stale page could submit "remove" for a row that is already gone, and
 * deriving the operation from what is stored makes the result correct either way.
 * The unique constraint makes a double-submit a no-op rather than a duplicate.
 */
export async function toggleFavoriteAction(
  entityType: string,
  entityId: string,
): Promise<FavoriteActionResult> {
  if (!isFavoriteEntityType(entityType)) return { status: "error" };

  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const result =
    entityType === "listing"
      ? await toggleListing(supabase, entityId, auth.userId)
      : entityType === "product"
        ? await toggleProduct(supabase, entityId, auth.userId)
        : await toggleInsight(supabase, entityId, auth.userId);

  if (result.status === "ok") revalidateFavoriteSurfaces();
  return result;
}

async function toggleListing(
  supabase: SessionClient,
  listingId: string,
  userId: string,
): Promise<FavoriteActionResult> {
  const { data: existing } = await supabase
    .from("listing_favorites")
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("listing_favorites")
      .delete()
      .eq("id", existing.id);
    return error ? { status: "error" } : { status: "ok", saved: false };
  }

  const { error } = await supabase
    .from("listing_favorites")
    .insert({ listing_id: listingId, user_id: userId });
  return error ? { status: "error" } : { status: "ok", saved: true };
}

async function toggleProduct(
  supabase: SessionClient,
  productId: string,
  userId: string,
): Promise<FavoriteActionResult> {
  const { data: existing } = await supabase
    .from("product_favorites")
    .select("id")
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("product_favorites")
      .delete()
      .eq("id", existing.id);
    return error ? { status: "error" } : { status: "ok", saved: false };
  }

  const { error } = await supabase
    .from("product_favorites")
    .insert({ product_id: productId, user_id: userId });
  return error ? { status: "error" } : { status: "ok", saved: true };
}

async function toggleInsight(
  supabase: SessionClient,
  insightId: string,
  userId: string,
): Promise<FavoriteActionResult> {
  const { data: existing } = await supabase
    .from("insight_favorites")
    .select("id")
    .eq("insight_id", insightId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("insight_favorites")
      .delete()
      .eq("id", existing.id);
    return error ? { status: "error" } : { status: "ok", saved: false };
  }

  const { error } = await supabase
    .from("insight_favorites")
    .insert({ insight_id: insightId, user_id: userId });
  return error ? { status: "error" } : { status: "ok", saved: true };
}

/**
 * The surfaces that render saved state from the database.
 *
 * The heart itself is optimistic and the client store refreshes from
 * `/api/favorites/summary`, so this is about the server-rendered favourites page
 * and the lists that pass an initial saved set. Revalidating all five is cheaper
 * than trying to know which surface the caller came from.
 */
function revalidateFavoriteSurfaces() {
  revalidatePath("/[locale]/favorites", "page");
  revalidatePath("/[locale]/real-estate/listings", "page");
  revalidatePath("/[locale]/real-estate/favorites", "page");
  revalidatePath("/[locale]/[department]/store", "page");
  revalidatePath("/[locale]/insights", "page");
}
