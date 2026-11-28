"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { slugifyTitle, uniqueSlug } from "@/lib/content/slug";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/uploads/validation";
import { scheduleTranslationSync } from "@/lib/tolgee/schedule-sync";

import {
  type DashboardKind,
  isOwnerSettableTransition,
} from "./dashboard";
import { LISTING_STATUSES, type ListingStatus } from "./enums";
import { loadMyMembershipSummary } from "./membership-loaders";
import {
  listingInputSchema,
  splitListInput,
  type ListingInput,
} from "./listing-input";
import { PROPERTY_MEDIA_BUCKET, listingMediaPath } from "./storage";

/**
 * Landlord and agent dashboard writes.
 *
 * The authorization story, stated once because every action below depends on it:
 *
 *   - The capability check here is a *message*, not the control. It reads the
 *     caller's own approved membership so a user without one gets "apply first"
 *     rather than a raw policy violation. The control is RLS on
 *     `property_listings`: `property_listings_insert_own_owner` requires
 *     `owner_id = auth.uid() and current_user_has_membership('landlord')`, and the
 *     update policies pin the row to the owner or manager. A crafted request that
 *     skips this module still meets those.
 *   - Every write uses the cookie-bound session client, never the service-role
 *     client, so the database is what refuses a cross-tenant write. The one place
 *     the admin client appears is the storage object write, because the bucket has
 *     no browser write policy and the row policies are what scope which listing an
 *     object may be attached to.
 *   - The listing source is NOT set here. `enforce_listing_lifecycle` pins a
 *     non-administrator's listing to `owner_submission`, which is what puts it in
 *     the review workflow. Sending `source` from this module would be a second
 *     place that decides it — and the version that shipped before this phase
 *     forgot, which let a landlord publish without a review.
 */

export type DashboardActionResult =
  | {
      ok: true;
      listingId: string;
      message?: string;
      mediaCount?: number;
      mediaWarning?: "partial" | "failed";
      submitted?: boolean;
      publishWarning?: "failed";
    }
  | { ok: false; error: string; fields?: Record<string, string> };

export type DashboardSimpleResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Parse one cell of a FormData, tolerating a missing field. */
function cell(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function imageFilesFrom(formData: FormData): File[] {
  return formData
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function readListingForm(formData: FormData) {
  return {
    title: cell(formData, "title"),
    slug: cell(formData, "slug"),
    description: cell(formData, "description"),
    listingType: cell(formData, "listingType"),
    propertyKind: cell(formData, "propertyKind"),
    propertyType: cell(formData, "propertyType"),
    regionId: cell(formData, "regionId"),
    divisionId: cell(formData, "divisionId"),
    subdivisionId: cell(formData, "subdivisionId"),
    locality: cell(formData, "locality"),
    highlights: cell(formData, "highlights"),
    amenities: cell(formData, "amenities"),
    price: cell(formData, "price"),
    pricePeriod: cell(formData, "pricePeriod"),
    priceOnRequest: cell(formData, "priceOnRequest") === "on" ? "on" : "",
    landAreaSqm: cell(formData, "landAreaSqm"),
    buildingAreaSqm: cell(formData, "buildingAreaSqm"),
    bedrooms: cell(formData, "bedrooms"),
    bathrooms: cell(formData, "bathrooms"),
    yearBuilt: cell(formData, "yearBuilt"),
    longitude: cell(formData, "longitude"),
    latitude: cell(formData, "latitude"),
    exactAddress: cell(formData, "exactAddress"),
    ownerName: cell(formData, "ownerName"),
    ownerPhone: cell(formData, "ownerPhone"),
    ownerEmail: cell(formData, "ownerEmail"),
    internalNotes: cell(formData, "internalNotes"),
  };
}

function fieldErrorsFrom(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return fields;
}

function nullIfBlank(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(/[\s\u00a0,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The gate every dashboard write passes.
 *
 * Returns the capability's summary so an action can also answer "which dashboard
 * is this" — the agent dashboard additionally maintains an `agent_profiles` row.
 * A caller without an approved capability is refused here; the policies would
 * refuse the write anyway, but a clear error is a better experience than a
 * generic failure, and the distinction matters because the two look identical to
 * the user otherwise.
 */
async function requireCapability(kind: DashboardKind): Promise<
  | { ok: true; userId: string; agentProfileId: string | null }
  | { ok: false; error: string }
> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }

  const memberships = await loadMyMembershipSummary();
  const summary = memberships.find((entry) => entry.type === kind);
  if (!summary?.isActive) return { ok: false, error: "capability_required" };

  if (kind !== "agent") return { ok: true, userId: auth.userId, agentProfileId: null };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data } = await supabase
    .from("agent_profiles")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  // An approved agent capability without an `agent_profiles` row cannot list: the
  // table is what the ownership trigger checks, so a listing with no `agent_id`
  // would have no poster. Reported distinctly because the fix is a staff action
  // (create the agent record), not something the agent can do.
  if (!data) return { ok: false, error: "agent_profile_missing" };

  return { ok: true, userId: auth.userId, agentProfileId: data.id };
}

/**
 * Revalidate every surface a listing write changes.
 *
 * The dashboards, the public search and detail pages, and the sitemap — whose
 * `lastmod` moves when a listing does. Both locales, because the public route is
 * localized and Next caches per path.
 */
function revalidateListingSurfaces(listingId?: string, slug?: string) {
  revalidatePath("/[locale]/account/landlord", "page");
  revalidatePath("/[locale]/account/agent", "page");
  revalidatePath(`/en${REAL_ESTATE_PATH}`);
  revalidatePath(`/fr${REAL_ESTATE_PATH}`);
  revalidatePath("/sitemap.xml");
  if (listingId) {
    revalidatePath("/[locale]/account/landlord/[id]", "page");
    revalidatePath("/[locale]/account/agent/[id]", "page");
  }
  if (slug) {
    revalidatePath(`/en${REAL_ESTATE_PATH}/listings/${slug}`);
    revalidatePath(`/fr${REAL_ESTATE_PATH}/listings/${slug}`);
  }
}

/** The listing fields both create and update write. */
function listingColumns(input: ListingInput) {
  return {
    title: input.title,
    description: input.description,
    listing_type: input.listingType,
    property_kind: input.propertyKind,
    property_type: input.propertyType,
    region_id: input.regionId,
    division_id: nullIfBlank(input.divisionId),
    subdivision_id: nullIfBlank(input.subdivisionId),
    locality: nullIfBlank(input.locality),
    highlights: splitListInput(input.highlights),
    amenities: splitListInput(input.amenities),
    price_minor: input.price === "" ? null : Number(input.price),
    price_period: input.pricePeriod,
    price_on_request: input.priceOnRequest,
    land_area_sqm: numberOrNull(input.landAreaSqm),
    building_area_sqm: numberOrNull(input.buildingAreaSqm),
    bedrooms: numberOrNull(input.bedrooms),
    bathrooms: numberOrNull(input.bathrooms),
    year_built: numberOrNull(input.yearBuilt),
  };
}

/**
 * Write a listing's private details.
 *
 * Coordinates and the owner's contact live in `listing_private_details`, a
 * separate table with its own policies, and the coordinate columns are a geometry
 * PostgREST cannot accept — so the write goes through `set_listing_private_details`,
 * which is `security invoker` on purpose so those policies remain the control.
 *
 * A failure here is reported as a warning rather than undoing the listing: the row
 * exists and the user can save the details from the edit form. Deleting a listing
 * because its optional coordinates failed would discard work that succeeded.
 */
async function writePrivateDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  input: ListingInput,
): Promise<boolean> {
  if (!supabase) return false;

  const hasCoordinates =
    input.longitude !== "" && input.latitude !== "";
  const hasAnyDetail =
    hasCoordinates ||
    input.exactAddress !== "" ||
    input.ownerName !== "" ||
    input.ownerPhone !== "" ||
    input.ownerEmail !== "" ||
    input.internalNotes !== "";

  if (!hasAnyDetail) return true;

  const { error } = await supabase.rpc("set_listing_private_details", {
    p_listing_id: listingId,
    p_longitude: hasCoordinates ? Number(input.longitude) : undefined,
    p_latitude: hasCoordinates ? Number(input.latitude) : undefined,
    p_exact_address: nullIfBlank(input.exactAddress) ?? undefined,
    p_owner_name: nullIfBlank(input.ownerName) ?? undefined,
    p_owner_phone: nullIfBlank(input.ownerPhone) ?? undefined,
    p_owner_email: nullIfBlank(input.ownerEmail) ?? undefined,
    p_internal_notes: nullIfBlank(input.internalNotes) ?? undefined,
  });

  return !error;
}

/**
 * Create a listing, then either leave it as a draft or submit it for review.
 *
 * The row is inserted as a draft first because the private details and media need
 * it to exist. A landlord or agent cannot publish directly — the lifecycle trigger
 * requires an approved submission — so the "publish" choice here is "submit for
 * review", the furthest step their capability allows.
 */
export async function createDashboardListingAction(
  kind: DashboardKind,
  formData: FormData,
): Promise<DashboardActionResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const raw = readListingForm(formData);
  raw.slug = slugifyTitle(raw.title, "property");
  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const input = parsed.data;
  const slugClient = createAdminClient() ?? supabase;
  const slug = await uniqueSlug(input.slug, async (candidate) => {
    const { data } = await slugClient
      .from("property_listings")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    return Boolean(data);
  });

  const { data, error } = await supabase
    .from("property_listings")
    .insert({
      ...listingColumns(input),
      slug,
      status: "draft",
      // A landlord owns what they create; an agent is the manager and the poster.
      // Both columns are pinned again by `enforce_listing_ownership`, so this is
      // the correct value rather than the only guard on it.
      owner_id: kind === "landlord" ? gate.userId : null,
      managed_by: kind === "agent" ? gate.userId : null,
      agent_id: kind === "agent" ? gate.agentProfileId : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if ((error?.message ?? "").includes("slug")) {
      return {
        ok: false,
        error: "duplicate",
        fields: { slug: "A listing already uses this slug." },
      };
    }
    if ((error?.message ?? "").includes("agent")) {
      return { ok: false, error: "agent_profile_required" };
    }
    return { ok: false, error: "write_failed" };
  }

  const detailsWritten = await writePrivateDetails(supabase, data.id, input);

  await recordAudit({
    actorId: gate.userId,
    action: "listing_created",
    entityType: "property_listing",
    entityId: data.id,
    metadata: { via: `${kind}_dashboard`, source: "owner_submission" },
  });

  const media = await attachDashboardListingImages(
    kind,
    data.id,
    input.title,
    formData,
  );

  const requestedReview = cell(formData, "publishState") === "review";
  let submitted = false;
  let publishWarning: "failed" | undefined;
  if (requestedReview) {
    const result = await submitListingForReviewAction(kind, data.id, "");
    if (result.ok) submitted = true;
    else publishWarning = "failed";
  }

  scheduleTranslationSync();

  revalidateListingSurfaces(data.id, slug);

  return {
    ok: true,
    listingId: data.id,
    message: detailsWritten ? undefined : "details_warning",
    mediaCount: media.count,
    mediaWarning: media.warning,
    submitted,
    publishWarning,
  };
}

/**
 * Attach the photographs chosen on the create form through the same uploader the
 * listing gallery uses. A failure leaves the draft or submission in place and is
 * reported as a warning, so the owner can retry from the listing page.
 */
async function attachDashboardListingImages(
  kind: DashboardKind,
  listingId: string,
  title: string,
  formData: FormData,
): Promise<{ count: number; warning?: "partial" | "failed" }> {
  const files = imageFilesFrom(formData);
  if (files.length === 0) return { count: 0 };

  const media = new FormData();
  media.set("listingId", listingId);
  media.set("altText", title.slice(0, 300));
  for (const file of files) media.append("image", file);

  const result = await uploadDashboardListingImageAction(kind, media);
  if (!result.ok) return { count: 0, warning: "failed" };
  if (result.message === "image_added_partial") {
    return { count: 0, warning: "partial" };
  }
  return { count: files.length };
}

/**
 * Update a listing the caller may edit.
 *
 * No ownership predicate is added to the query: the update policies already scope
 * the row to the owner or manager, so a guessed id for another account's listing
 * matches zero rows and the action reports `not_found` rather than editing it. That
 * is also why a failed update is not distinguished from a missing listing — telling
 * the two apart would confirm the row exists.
 */
export async function updateDashboardListingAction(
  kind: DashboardKind,
  listingId: string,
  formData: FormData,
): Promise<DashboardActionResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const parsed = listingInputSchema.safeParse(readListingForm(formData));
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const input = parsed.data;

  const { data, error } = await supabase
    .from("property_listings")
    .update({ ...listingColumns(input), slug: input.slug })
    .eq("id", listingId)
    .select("id")
    .maybeSingle();

  if (error) {
    if ((error.message ?? "").includes("slug")) {
      return {
        ok: false,
        error: "duplicate",
        fields: { slug: "A listing already uses this slug." },
      };
    }
    return { ok: false, error: "write_failed" };
  }
  if (!data) return { ok: false, error: "not_found" };

  const detailsWritten = await writePrivateDetails(supabase, listingId, input);

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { via: `${kind}_dashboard` },
  });

  scheduleTranslationSync();

  revalidateListingSurfaces(listingId, input.slug);

  return {
    ok: true,
    listingId,
    message: detailsWritten ? undefined : "details_warning",
  };
}

/**
 * Submit a draft for review.
 *
 * The listing moves to `pending_review` and a submission row records the wait.
 * The row is what the reviewer decides on, and what the dashboard reads to show
 * the decision — a listing status alone could not carry the reviewer's reason.
 *
 * The submitter's name and email are taken from the session profile rather than
 * from the form, so a submission cannot claim to come from someone else.
 */
export async function submitListingForReviewAction(
  kind: DashboardKind,
  listingId: string,
  notes: string,
): Promise<DashboardSimpleResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const fullName = auth.profile.fullName?.trim() || auth.email || "Applicant";

  // One open submission per listing.
  //
  // There is no unique index to enforce this, so a double submit — a slow
  // connection and an impatient second click — would otherwise queue two
  // decisions for one listing and the reviewer would decide it twice. Checked
  // before the insert rather than relying on a constraint that does not exist.
  const { data: openSubmission } = await supabase
    .from("listing_submissions")
    .select("id")
    .eq("listing_id", listingId)
    .eq("status", "pending_review")
    .maybeSingle();

  if (openSubmission) return { ok: false, error: "already_submitted" };

  const { error: submissionError } = await supabase
    .from("listing_submissions")
    .insert({
      listing_id: listingId,
      status: "pending_review",
      submitted_by: gate.userId,
      submitter_name: fullName.slice(0, 200),
      submitter_email: auth.email,
      submitter_phone: auth.profile.phone,
      notes: notes.trim() ? notes.trim().slice(0, 4000) : null,
    });

  if (submissionError) return { ok: false, error: "write_failed" };

  const { error: statusError } = await supabase
    .from("property_listings")
    .update({ status: "pending_review" })
    .eq("id", listingId);

  if (statusError) return { ok: false, error: "write_failed" };

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { via: `${kind}_dashboard`, field: "submitted_for_review" },
  });

  revalidateListingSurfaces(listingId);
  return { ok: true, message: "submitted" };
}

/**
 * Change a listing's status within what the owner is allowed to do.
 *
 * Only the transitions in `OWNER_SETTABLE_TRANSITIONS` are accepted — withdraw
 * from the market, and restore an archived listing to a draft. Publication is not
 * offered: `enforce_listing_lifecycle` refuses it without an approved submission,
 * so a control that submitted it would be one the database always rejects.
 *
 * The transition is validated here *and* by the trigger, because the trigger is
 * the control and this is the message.
 */
export async function setListingStatusAction(
  kind: DashboardKind,
  listingId: string,
  to: string,
): Promise<DashboardSimpleResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data: current } = await supabase
    .from("property_listings")
    .select("id, status, slug")
    .eq("id", listingId)
    .maybeSingle();

  if (!current) return { ok: false, error: "not_found" };

  if (!isOwnerSettableTransition(current.status, to)) {
    return { ok: false, error: "transition_not_allowed" };
  }

  // Narrowed against the mirrored enum rather than cast, so a value the database
  // does not accept is refused here with a clear error instead of failing at the
  // write with an opaque one.
  if (!(LISTING_STATUSES as readonly string[]).includes(to)) {
    return { ok: false, error: "transition_not_allowed" };
  }

  const { error } = await supabase
    .from("property_listings")
    .update({ status: to as ListingStatus })
    .eq("id", listingId);

  if (error) return { ok: false, error: "write_failed" };

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { via: `${kind}_dashboard`, from: current.status, to },
  });

  revalidateListingSurfaces(listingId, current.slug);
  return { ok: true, message: "status_changed" };
}

/**
 * Append photographs to a listing's gallery.
 *
 * The form accepts several files at once, so a whole set of property photographs
 * is one submit rather than one submit per image. The files are stored in the
 * order the editor chose them, and the gallery's positions follow the existing
 * count so an append never renumbers what is already there. The first upload in a
 * batch becomes primary only when the gallery was empty.
 *
 * The row insert uses the session client so the `listing_media_write_own_owner`
 * policy is the control, and the object write uses the admin client because the
 * bucket has no browser policy. The order matters: the row is inserted first so a
 * failed insert leaves no orphan object to clean up, and the object is removed if
 * the row write fails after the upload.
 */
export async function uploadDashboardListingImageAction(
  kind: DashboardKind,
  formData: FormData,
): Promise<DashboardSimpleResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const listingId = cell(formData, "listingId").trim();
  if (!listingId) return { ok: false, error: "not_found" };

  const altText = cell(formData, "altText").trim();
  if (altText.length === 0) return { ok: false, error: "alt_required" };

  const files = formData
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return { ok: false, error: "no_file" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Confirm the caller may reach this listing before touching the bucket. The
  // session read is scoped by the ownership policies, so a listing belonging to
  // another account simply is not there.
  const { data: listing } = await supabase
    .from("property_listings")
    .select("id, slug")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "not_found" };

  const { count } = await supabase
    .from("listing_media")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  let position = count ?? 0;
  let stored = 0;
  // The first upload in this batch is primary only when the gallery was empty.
  let primaryTaken = position > 0;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = validateUpload(bytes, file.type, { kind: "property-image" });
    if (!verdict.ok) {
      // A partly-invalid batch keeps what already landed rather than discarding a
      // completed upload, so the editor can retry only the file the message names.
      if (stored > 0) scheduleTranslationSync();
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : { ok: false, error: verdict.reason };
    }

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
    if (uploadError) {
      if (stored > 0) scheduleTranslationSync();
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : { ok: false, error: "upload_failed" };
    }

    const { error: insertError } = await supabase.from("listing_media").insert({
      listing_id: listingId,
      storage_path: objectPath,
      alt_text: altText.slice(0, 300),
      is_primary: !primaryTaken,
      position,
    });

    if (insertError) {
      await admin.storage.from(PROPERTY_MEDIA_BUCKET).remove([objectPath]);
      if (stored > 0) scheduleTranslationSync();
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : { ok: false, error: "write_failed" };
    }

    primaryTaken = true;
    position += 1;
    stored += 1;
  }

  await recordAudit({
    actorId: gate.userId,
    action: "listing_updated",
    entityType: "property_listing",
    entityId: listingId,
    metadata: { via: `${kind}_dashboard`, field: "media_added", count: stored },
  });

  scheduleTranslationSync();

  revalidateListingSurfaces(listingId, listing.slug);
  return { ok: true, message: "image_added" };
}

/**
 * Remove one photograph from a listing's gallery.
 *
 * The row is deleted first, then the object: the reverse order would delete the
 * bytes behind a row that still renders, producing a broken image. When the
 * removed photograph was the primary one, the next is promoted so the card always
 * has an image for as long as the gallery has any.
 */
export async function removeDashboardListingImageAction(
  kind: DashboardKind,
  listingId: string,
  mediaId: string,
): Promise<DashboardSimpleResult> {
  const gate = await requireCapability(kind);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data: media } = await supabase
    .from("listing_media")
    .select("id, listing_id, storage_path, is_primary")
    .eq("id", mediaId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (!media) return { ok: false, error: "not_found" };

  const { error: deleteError } = await supabase
    .from("listing_media")
    .delete()
    .eq("id", mediaId);
  if (deleteError) return { ok: false, error: "write_failed" };

  const admin = createAdminClient();
  if (admin) {
    await admin.storage.from(PROPERTY_MEDIA_BUCKET).remove([media.storage_path]);
  }

  if (media.is_primary) {
    const { data: next } = await supabase
      .from("listing_media")
      .select("id")
      .eq("listing_id", listingId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
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
    metadata: { via: `${kind}_dashboard`, field: "media_removed" },
  });

  revalidateListingSurfaces(listingId);
  return { ok: true, message: "image_removed" };
}

/**
 * Update the signed-in agent's own business record.
 *
 * `agent_profiles_update_own` restricts the write to `user_id = auth.uid()`, and
 * the query repeats that predicate so a missing row is a clear error rather than a
 * silent no-op. An agent may maintain their record but not create one — creating an
 * agent is what grants listing access, so it stays an administrative act, and a
 * missing row here means a staff member has not set the agent up yet.
 *
 * `is_active` is deliberately not writable: deactivating an agent is a staff
 * decision, and the policy would not stop a user from setting it back.
 */
export async function updateAgentProfileAction(
  formData: FormData,
): Promise<DashboardSimpleResult> {
  const gate = await requireCapability("agent");
  if (!gate.ok) return gate;

  const displayName = cell(formData, "displayName").trim();
  if (displayName.length < 2 || displayName.length > 120) {
    return { ok: false, error: "invalid_name" };
  }

  const title = cell(formData, "title").trim();
  const bio = cell(formData, "bio").trim();
  const publicPhone = cell(formData, "publicPhone").trim();
  const licenseNumber = cell(formData, "licenseNumber").trim();
  const regionId = cell(formData, "regionId").trim();

  if (bio.length > 4000) return { ok: false, error: "invalid_bio" };
  if (title.length > 120) return { ok: false, error: "invalid_title" };
  if (licenseNumber.length > 64) return { ok: false, error: "invalid_license" };
  if (publicPhone && (publicPhone.length < 5 || publicPhone.length > 40)) {
    return { ok: false, error: "invalid_phone" };
  }

  // Service areas arrive as a newline-separated textarea. Split, trimmed,
  // deduplicated and bounded so a crafted form cannot store thousands of entries;
  // the column is a plain text array with no length limit of its own.
  const serviceAreas = [
    ...new Set(
      formData
        .getAll("serviceAreas")
        .flatMap((value) =>
          typeof value === "string" ? value.split(/\r?\n/) : [],
        )
        .map((value) => value.trim())
        .filter((value) => value !== "" && value.length <= 80),
    ),
  ].slice(0, 60);

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data, error } = await supabase
    .from("agent_profiles")
    .update({
      display_name: displayName,
      title: title || null,
      bio: bio || null,
      public_phone: publicPhone || null,
      license_number: licenseNumber || null,
      region_id: regionId || null,
      service_areas: serviceAreas,
    })
    .eq("user_id", gate.userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "write_failed" };
  if (!data) return { ok: false, error: "agent_profile_missing" };

  await recordAudit({
    actorId: gate.userId,
    action: "profile_updated",
    entityType: "agent_profile",
    entityId: data.id,
    metadata: { via: "agent_dashboard" },
  });

  revalidatePath("/[locale]/account/agent", "page");
  return { ok: true, message: "saved" };
}
