"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import {
  PROPERTY_MEDIA_BUCKET,
  listingMediaPath,
} from "@/lib/real-estate/storage";
import { REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUpload } from "@/lib/uploads/validation";

/**
 * Listing gallery and publish controls.
 *
 * A listing is created as a draft, then its photographs are added, then it is
 * published. The listing's `images` field is populated from `listing_media`, so
 * without this module a listing is created and can be published with an empty
 * gallery — the card and the detail page then render their placeholders forever.
 *
 * The same authorization rule the page and the listing actions use is applied
 * here (`isRealEstateAdminRole`), so an agent cannot reach this surface through a
 * crafted request when the page refuses to render for them. Agents manage their
 * own listings through the department surface, which uploads through a different
 * path; keeping this one to administrators means there is exactly one place that
 * decides the rule for the console.
 *
 * Every write goes through the service-role client after that check. The rows are
 * gated by RLS too, but the storage object is not, so a caller who passed the role
 * check is the only thing standing between a request and a bucket write.
 */

export type ListingMediaState =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function requireRealEstateAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "unconfigured" }
> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isRealEstateAdminRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: auth.userId };
}

function revalidateGallery(listingId: string, listingSlug?: string) {
  revalidatePath("/admin/real-estate");
  revalidatePath(`/admin/real-estate/listings/${listingId}`);
  // The gallery appears on the public detail page and the card on every results
  // page, and each listing's `lastmod` in the sitemap moves when its media does.
  revalidatePath("/sitemap.xml");
  revalidatePath(`/en${REAL_ESTATE_PATH}`);
  revalidatePath(`/fr${REAL_ESTATE_PATH}`);
  if (listingSlug) {
    revalidatePath(`/en${REAL_ESTATE_PATH}/properties/${listingSlug}`);
    revalidatePath(`/fr${REAL_ESTATE_PATH}/properties/${listingSlug}`);
  }
}

/**
 * Append an image to a listing's gallery.
 *
 * Unlike the product form, this appends rather than replaces: a property is sold
 * on its gallery, so the editor uploading a second photograph means "show both".
 * The first image becomes primary, later ones are appended. Alt text is required
 * by the table's own check constraint, so it is required here too rather than
 * letting a database rejection surface as an opaque write failure.
 */
export async function uploadListingImageAction(
  formData: FormData,
): Promise<ListingMediaState> {
  const gate = await requireRealEstateAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return { ok: false, error: "not_found" };

  const altText = String(formData.get("altText") ?? "").trim();
  if (altText.length === 0) return { ok: false, error: "alt_required" };

  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateUpload(bytes, file.type, { kind: "property-image" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const { data: listing } = await admin
    .from("property_listings")
    .select("id, slug")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "not_found" };

  const { count } = await admin
    .from("listing_media")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  const existingCount = count ?? 0;

  // A UUID name so two uploads in the same second cannot collide. The extension
  // comes from the detected type, not the filename the browser supplied.
  const objectPath = listingMediaPath(
    listingId,
    `${randomUUID()}.${verdict.extension}`,
  );

  const { error: uploadError } = await admin.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      contentType: verdict.mime,
      upsert: false,
    });
  if (uploadError) return { ok: false, error: "upload_failed" };

  const { error: insertError } = await admin.from("listing_media").insert({
    listing_id: listingId,
    storage_path: objectPath,
    alt_text: altText.slice(0, 300),
    // The first photograph is the card image; later ones are gallery only. A
    // partial unique index permits at most one primary per listing.
    is_primary: existingCount === 0,
    position: existingCount,
  });
  if (insertError) {
    await admin.storage.from(PROPERTY_MEDIA_BUCKET).remove([objectPath]);
    return { ok: false, error: "write_failed" };
  }

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { field: "media_added", bytes: bytes.byteLength },
  });

  revalidateGallery(listingId, String(listing.slug ?? ""));
  return { ok: true, message: "image_added" };
}

/**
 * Remove one image from a listing.
 *
 * The row is deleted first, then the object. If the object removal fails the
 * orphan costs a few kilobytes in the bucket; the reverse order would delete the
 * bytes behind a row that still renders, producing a broken image.
 *
 * When the removed image was the primary one, the next image is promoted so the
 * gallery always has a card image for as long as it has any image at all.
 */
export async function removeListingImageAction(
  formData: FormData,
): Promise<ListingMediaState> {
  const gate = await requireRealEstateAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const listingId = String(formData.get("listingId") ?? "").trim();
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!listingId || !mediaId) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const { data: media } = await admin
    .from("listing_media")
    .select("id, listing_id, storage_path, is_primary")
    .eq("id", mediaId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!media) return { ok: false, error: "not_found" };

  const { error: deleteError } = await admin
    .from("listing_media")
    .delete()
    .eq("id", mediaId);
  if (deleteError) return { ok: false, error: "write_failed" };

  await admin.storage.from(PROPERTY_MEDIA_BUCKET).remove([media.storage_path]);

  if (media.is_primary) {
    const { data: next } = await admin
      .from("listing_media")
      .select("id")
      .eq("listing_id", listingId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin
        .from("listing_media")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { field: "media_removed" },
  });

  revalidateGallery(listingId);
  return { ok: true, message: "image_removed" };
}
