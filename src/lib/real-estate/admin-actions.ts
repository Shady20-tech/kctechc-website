"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { createClient } from "@/lib/supabase/server";

import { CsvParseError, parseCsv } from "./csv";
import { validateListingImport, type ImportReport } from "./import";
import {
  listingInputSchema,
  splitListInput,
  type ListingInput,
} from "./listing-input";
import { loadGeographyIndex } from "./loaders";
import { LISTING_STATUSES, type ListingStatus } from "./enums";

/**
 * Real-estate administration, as Server Actions.
 *
 * The division of responsibility mirrors the store's actions:
 *
 *   - Authorization is checked here AND is enforced by RLS. `getAuthState` reads
 *     the role through the session; the writes it then performs go through the
 *     session client, not the service-role client, so a bug in this file cannot
 *     escalate — the database refuses the write regardless of what this code
 *     believes.
 *   - Nothing here writes a translation index row, an audit row, a public
 *     location, or a listing reference. The database triggers do all of it in the
 *     same transaction. Assembling any of them here would mean a listing created
 *     by another path — a migration, a psql session, a future import — quietly
 *     lacked them.
 *   - The service-role client appears only where the operation genuinely needs it
 *     and no policy can express it. That is currently one place: nothing yet.
 *     Bulk import uses the session client so RLS governs it exactly as it governs
 *     a single insert.
 */

export type ListingActionResult =
  | { ok: true; listingId: string; warning?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/** Parse one cell of a FormData, tolerating a missing field. */
function cell(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Read the whole listing form. */
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

/**
 * Field errors keyed by the form's field names.
 *
 * Rebuilt from the Zod issues rather than reused from the store: that helper
 * returns `Record<string, string>` keyed by the first path segment, which is what
 * the form expects, so this is a thin adapter rather than a second
 * implementation.
 */
function fieldErrorsFrom(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Turn an optional string into null, so a blank field clears the column. */
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
 * Authorize the caller for real-estate administration.
 *
 * Returns null when authorized, or the error to hand back. A separate function
 * so every action checks the same thing the same way; a copy-pasted condition in
 * four actions is four chances to write it slightly wrong.
 */
async function authorize(): Promise<{ ok: false; error: string } | null> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") return { ok: false, error: "unauthenticated" };
  if (!auth.profile || !isRealEstateAdminRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }
  return null;
}

function revalidateListings(listingSlug?: string) {
  revalidatePath(`/en${REAL_ESTATE_PATH}`);
  revalidatePath(`/fr${REAL_ESTATE_PATH}`);
  revalidatePath("/admin/real-estate");
  // The sitemap carries each listing's `lastmod`, so publishing, editing or
  // unpublishing one changes the feed. Without this the crawler would keep the
  // timestamp it was last served and not revisit the page.
  revalidatePath("/sitemap.xml");
  if (listingSlug) {
    revalidatePath(`/en${REAL_ESTATE_PATH}/properties/${listingSlug}`);
    revalidatePath(`/fr${REAL_ESTATE_PATH}/properties/${listingSlug}`);
  }
}

/**
 * Create a listing.
 *
 * Written as a draft always. Publication is a separate action, because a listing
 * needs its private details and usually an image before it is fit to be seen, and
 * a single "save" that also published would make the draft state unreachable for
 * a listing created in one sitting.
 */
export async function createListingAction(
  formData: FormData,
): Promise<ListingActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = listingInputSchema.safeParse(readListingForm(formData));
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const input = parsed.data;
  const { data, error } = await supabase
    .from("property_listings")
    .insert({
      slug: input.slug,
      title: input.title,
      description: input.description,
      listing_type: input.listingType,
      property_kind: input.propertyKind,
      property_type: input.propertyType,
      // Always a draft. `enforce_listing_lifecycle` supplies the reference.
      status: "draft",
      source: "admin",
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
    return { ok: false, error: "write_failed" };
  }

  // The private details and the listing are two writes, and the second can fail
  // after the first succeeded. Reported as a warning rather than a failure: the
  // listing exists and the operator can save the details from the edit form. The
  // alternative — deleting the listing — would discard the work that did succeed.
  const detailWarning = await writePrivateDetails(supabase, data.id, input);

  revalidateListings(input.slug);
  return { ok: true, listingId: data.id, warning: detailWarning };
}

/**
 * Write the exact position and owner contact through the RPC.
 *
 * The RPC rather than a direct update because the column is `geometry(Point,4326)`
 * and PostgREST cannot send one; the function takes plain numbers. It is
 * `security invoker`, so the policies on `listing_private_details` still decide
 * whether this caller may write.
 */
async function writePrivateDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  input: ListingInput,
): Promise<string | undefined> {
  if (!supabase) return "unconfigured";

  const hasCoordinates =
    input.longitude !== "" &&
    input.longitude !== undefined &&
    input.latitude !== "" &&
    input.latitude !== undefined;

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

  return error ? "private_details_write_failed" : undefined;
}

/** Update an existing listing. */
export async function updateListingAction(
  listingId: string,
  formData: FormData,
): Promise<ListingActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = listingInputSchema.safeParse(readListingForm(formData));
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const input = parsed.data;
  const { error } = await supabase
    .from("property_listings")
    .update({
      slug: input.slug,
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
    })
    .eq("id", listingId);

  if (error) {
    if (error.message.includes("slug")) {
      return {
        ok: false,
        error: "duplicate",
        fields: { slug: "A listing already uses this slug." },
      };
    }
    return { ok: false, error: "write_failed" };
  }

  const detailWarning = await writePrivateDetails(supabase, listingId, input);

  revalidateListings(input.slug);
  return { ok: true, listingId, warning: detailWarning };
}

/**
 * Change a listing's status.
 *
 * Deliberately thin: the permitted transitions live in
 * `listing_status_transition_allowed` and are enforced by the lifecycle trigger,
 * so this action does not attempt to re-implement them. A refused transition
 * comes back as a database error and is reported as such, rather than being
 * pre-empted by a check here that could disagree with the table.
 */
export async function setListingStatusAction(
  listingId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied.error };

  // The status arrives from the client, so it is validated against the enum
  // before it reaches the database. The lifecycle trigger would refuse a
  // nonsensical transition anyway, but it cannot refuse a status that is not a
  // member of the type at all without raising a cast error the operator cannot
  // read.
  if (!(LISTING_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "unknown_status" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase
    .from("property_listings")
    .update({ status: status as ListingStatus })
    .eq("id", listingId);

  if (error) {
    // An illegal transition is the expected failure — a "publish" on a sold
    // listing, say — and deserves to be distinguished from an unavailable
    // database so the operator knows the request was understood and refused.
    if (error.message.includes("Illegal listing status transition")) {
      return { ok: false, error: "illegal_transition" };
    }
    if (error.message.includes("cannot be published until")) {
      return { ok: false, error: "submission_not_approved" };
    }
    return { ok: false, error: "write_failed" };
  }

  revalidateListings();
  return { ok: true };
}

/**
 * Record a decision on an owner submission.
 *
 * Delegates to `review_listing_submission`, which writes the decision and, when
 * asked to publish and the decision is approval, publishes in the same
 * transaction. Doing the two updates here instead would leave a window in which
 * an approval exists but the listing is still in the queue.
 */
export async function reviewListingSubmissionAction(
  submissionId: string,
  decision: "approved" | "rejected" | "changes_requested",
  notes: string,
  publish: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied.error };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase.rpc("review_listing_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    // A refusal must carry a reason the owner can act on; the table enforces the
    // same rule, and sending an empty string rather than null keeps the two in
    // agreement.
    p_review_notes: notes.trim() || undefined,
    p_publish: publish,
  });

  if (error) {
    if (error.message.includes("already been decided")) {
      return { ok: false, error: "already_decided" };
    }
    return { ok: false, error: "write_failed" };
  }

  revalidateListings();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CSV import.
// ---------------------------------------------------------------------------

export type ImportPreviewResult =
  | {
      ok: true;
      report: {
        validRows: number;
        rejectedRows: number;
        totalRows: number;
        hasErrors: boolean;
        issues: ImportReport["issues"];
      };
    }
  | { ok: false; error: string };

/**
 * Validate a CSV file without writing anything.
 *
 * The preview and the commit run the SAME validator, so what the preview shows
 * and what the commit does cannot disagree. That is the whole reason this is a
 * two-step operation: an import that both reported and wrote would have to be
 * trusted before its report was read.
 *
 * Geography is loaded to check region, division and subdivision codes against the
 * real rows. Without it the validator can only check a code's shape, and an
 * import would fail on the database's foreign key one row at a time instead of
 * reporting every bad code at once.
 */
export async function previewListingImportAction(
  csvText: string,
): Promise<ImportPreviewResult> {
  const denied = await authorize();
  if (denied) return denied;

  let report: ImportReport;
  try {
    const parsed = parseCsv(csvText);
    const geography = (await loadGeographyIndex()) ?? undefined;
    report = validateListingImport(parsed, geography);
  } catch (error) {
    if (error instanceof CsvParseError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "parse_failed" };
  }

  return {
    ok: true,
    report: {
      validRows: report.rows.length,
      rejectedRows: report.rejectedCount,
      totalRows: report.rows.length + report.rejectedCount,
      hasErrors: report.hasErrors,
      // Capped so a badly formed file does not produce a response larger than the
      // one that was uploaded; the operator fixes the first errors and re-runs.
      issues: report.issues.slice(0, 200),
    },
  };
}

export type ImportCommitResult =
  | {
      ok: true;
      inserted: number;
      failed: number;
      issues: ImportIssueList;
    }
  | { ok: false; error: string };

type ImportIssueList = ImportReport["issues"];

/**
 * Commit a CSV import.
 *
 * The file is re-parsed and re-validated rather than trusting the preview's
 * result, because the two requests are independent and the file could have
 * changed between them — or the second request could be made without a preview.
 * Revalidating is the only way this action's writes are governed by the same
 * rules the preview displayed.
 *
 * Rows are inserted one at a time, not in a single bulk insert. A bulk insert
 * fails as a whole on the first bad row, and the operator would then have to
 * bisect the file; inserting individually means the good rows land and the
 * failures are reported with their line numbers. The trade is that a partial
 * import is possible, which is why the result states how many succeeded and how
 * many did not rather than reporting a bare success.
 */
export async function commitListingImportAction(
  csvText: string,
): Promise<ImportCommitResult> {
  const denied = await authorize();
  if (denied) return denied;

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  let report: ImportReport;
  try {
    const parsed = parseCsv(csvText);
    const geography = (await loadGeographyIndex()) ?? undefined;
    report = validateListingImport(parsed, geography);
  } catch (error) {
    if (error instanceof CsvParseError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "parse_failed" };
  }

  if (report.rows.length === 0) {
    return {
      ok: true,
      inserted: 0,
      failed: 0,
      issues: report.issues.slice(0, 200),
    };
  }

  // Agent slugs are resolved once for the whole file rather than per row.
  const agentSlugs = [
    ...new Set(
      report.rows
        .map((row) => row.agentSlug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];
  const agentIds = new Map<string, string>();
  if (agentSlugs.length > 0) {
    const { data: agents } = await supabase
      .from("agent_profiles")
      .select("id, slug")
      .in("slug", agentSlugs);
    for (const agent of agents ?? []) agentIds.set(agent.slug, agent.id);
  }

  const issues: ImportIssueList = [...report.issues];
  let inserted = 0;
  let failed = 0;

  for (const row of report.rows) {
    const { error } = await supabase
      .from("property_listings")
      .insert({
        slug: row.slug,
        title: row.title,
        description: row.description,
        listing_type: row.listingType,
        property_kind: row.propertyKind,
        property_type: row.propertyType,
        // An imported listing is always a draft. Publishing a portfolio in one
        // step is not what an import is for, and an unreviewed batch going live
        // is the failure this avoids.
        status: "draft",
        source: "import",
        region_id: row.regionId,
        division_id: row.divisionId,
        subdivision_id: row.subdivisionId,
        locality: row.locality,
        highlights: row.highlights,
        amenities: row.amenities,
        price_minor: row.priceMinor,
        currency: row.currency,
        price_period: row.pricePeriod,
        price_on_request: row.priceOnRequest,
        land_area_sqm: row.landAreaSqm,
        building_area_sqm: row.buildingAreaSqm,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        year_built: row.yearBuilt,
        agent_id: row.agentSlug ? agentIds.get(row.agentSlug) ?? null : null,
      })
      .select("id")
      .single();

    if (error) {
      failed += 1;
      issues.push({
        line: row.line,
        column: null,
        message: error.message.includes("slug")
          ? "A listing already uses this slug."
          : "Rejected by the database.",
      });
      continue;
    }

    inserted += 1;
  }

  revalidateListings();
  return { ok: true, inserted, failed, issues: issues.slice(0, 200) };
}

/**
 * Return the CSV template header and one example row.
 *
 * Served from the action rather than a static file so the columns and the
 * validator cannot drift: the template is generated from the same
 * `IMPORT_COLUMNS` the validator reads.
 */
export async function loadImportTemplateAction(): Promise<
  { ok: true; header: string; example: string } | { ok: false; error: string }
> {
  const denied = await authorize();
  if (denied) return denied;

  const { IMPORT_TEMPLATE_HEADER } = await import("./import");
  return {
    ok: true,
    header: IMPORT_TEMPLATE_HEADER,
    example: [
      "villa-limbe-sea-view",
      "Villa with sea view in Limbe",
      "A four-bedroom villa overlooking the bay, with a mature garden and a borehole.",
      "sale",
      "villa",
      "residential",
      "SW",
      "Fako",
      "Limbe",
      "Mile 4",
      "Sea view|Borehole|Solar",
      "pool|borehole|solar|gated",
      "45000000",
      "XAF",
      "total",
      "no",
      "800",
      "310",
      "4",
      "3",
      "2019",
      "",
      "9.29123",
      "4.01567",
    ].join(","),
  };
}
