"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeSearchQuery } from "@/lib/real-estate/search";

/**
 * Registered-customer writes for the real-estate platform: favourites, saved
 * searches and their alert preferences.
 *
 * Every one of these writes with the session client, not the service-role client.
 * That is the whole point of the feature: the three tables carry policies that
 * restrict each row to `auth.uid() = user_id`, so the database refuses a write
 * that targets another customer's data even if this module were wrong about who
 * the caller is. Using the admin client here would have moved that decision into
 * TypeScript and made the policies decorative.
 *
 * A missing session is reported as `unauthenticated` rather than as an error or,
 * worse, as success. The cards are rendered for signed-out visitors too, and the
 * button turns that status into a sign-in link with the current page as the
 * return target — which is only possible because the status is distinguishable.
 *
 * `revalidatePath` is called on the surfaces that read the same rows. The
 * favourites page and the saved-searches page are both server-rendered from these
 * tables, so without it a customer could save a property and then visit the
 * favourites page to find it missing until the cache expired.
 */

export type FavoriteActionResult =
  | { status: "ok"; saved: boolean }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * Add or remove a listing from the signed-in customer's favourites.
 *
 * A toggle rather than separate add and remove actions, because the control is a
 * single button whose meaning depends on the current state. The state is read from
 * the database inside the action rather than trusted from the caller: a stale page
 * could submit "remove" for a row that is already gone, and deriving the operation
 * from what is actually stored makes the result correct regardless.
 *
 * The unique constraint on `(user_id, listing_id)` is what makes a double-submit
 * safe — the insert is a no-op rather than a duplicate — and the `on conflict` is
 * omitted deliberately so that a genuine race surfaces as an error the caller can
 * retry rather than as a silent partial write.
 */
export async function toggleListingFavoriteAction(
  listingId: string,
): Promise<FavoriteActionResult> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

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
    if (error) return { status: "error" };
    revalidateFavoriteSurfaces();
    return { status: "ok", saved: false };
  }

  const { error } = await supabase
    .from("listing_favorites")
    .insert({ listing_id: listingId, user_id: auth.userId });
  if (error) return { status: "error" };

  revalidateFavoriteSurfaces();
  return { status: "ok", saved: true };
}

function revalidateFavoriteSurfaces() {
  revalidatePath("/[locale]/real-estate/listings", "page");
  revalidatePath("/[locale]/real-estate/favorites", "page");
}

export type SavedSearchActionResult =
  | { status: "ok"; id: string }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | {
      status: "error";
      message: "labelRequired" | "labelTaken" | "writeFailed" | "limitReached";
    };

/** How many searches one customer may keep. */
const SAVED_SEARCH_LIMIT = 50;

/**
 * Save the current filter view as a named search.
 *
 * The query string is normalized before it is stored, by parsing it with the same
 * function the listings page uses and re-serializing it. Storing the raw string
 * would mean a saved search could contain `?page=3` or a stale ordering that the
 * page would then honour, so reopening it would land the customer in the middle of
 * the results rather than at the top. Normalizing is what makes the stored string
 * a description of the *filters* rather than of one visit to them.
 */
export async function saveSearchAction(
  label: string,
  queryString: string,
  locale: string,
): Promise<SavedSearchActionResult> {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return { status: "error", message: "labelRequired" };
  }

  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const { count } = await supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= SAVED_SEARCH_LIMIT) {
    return { status: "error", message: "limitReached" };
  }

  const normalized = normalizeSearchQuery(queryString);

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: auth.userId,
      label: trimmed.slice(0, 120),
      query_string: normalized,
      locale: locale === "fr" ? "fr" : "en",
    })
    .select("id")
    .single();

  // The table holds one label per customer, so a duplicate is a distinct outcome
  // rather than a generic failure: "please try again" would be advice that cannot
  // work, because the second attempt collides for the same reason as the first.
  if (error?.code === "23505") {
    return { status: "error", message: "labelTaken" };
  }
  if (error || !data) return { status: "error", message: "writeFailed" };

  revalidatePath("/[locale]/real-estate/saved-searches", "page");
  return { status: "ok", id: data.id };
}

export type AlertPreferenceActionResult =
  | { status: "ok" }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * Set whether a saved search notifies the customer, and how often.
 *
 * The preference is upserted on `saved_search_id`, because the table holds at most
 * one preference per search and the common case is turning an existing one off.
 * The `user_id` is written from the session so the row satisfies the policy that
 * keeps preferences from crossing accounts.
 *
 * This records the customer's intent. Sending the alert is a scheduled job's work,
 * not a web request's, and pretending otherwise here — by sending inline — would
 * make an unconfigured mail provider look like a broken toggle.
 */
export async function setSearchAlertPreferenceAction(
  savedSearchId: string,
  enabled: boolean,
  frequency: "instant" | "daily" | "weekly",
): Promise<AlertPreferenceActionResult> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const { error } = await supabase.from("search_alert_preferences").upsert(
    {
      user_id: auth.userId,
      saved_search_id: savedSearchId,
      enabled,
      frequency,
    },
    { onConflict: "saved_search_id" },
  );

  if (error) return { status: "error" };

  revalidatePath("/[locale]/real-estate/saved-searches", "page");
  return { status: "ok" };
}

export type DeleteSavedSearchResult =
  | { status: "ok" }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "error" };

/** Remove a saved search, and its alert preference with it. */
export async function deleteSavedSearchAction(
  savedSearchId: string,
): Promise<DeleteSavedSearchResult> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  // The preference row is removed first. The foreign key cascades, but deleting
  // the child explicitly means this does not depend on the constraint's action
  // staying `cascade` — a migration that changed it to `restrict` would otherwise
  // turn this into an error the customer cannot act on.
  await supabase
    .from("search_alert_preferences")
    .delete()
    .eq("saved_search_id", savedSearchId);

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId);

  if (error) return { status: "error" };

  revalidatePath("/[locale]/real-estate/saved-searches", "page");
  return { status: "ok" };
}
