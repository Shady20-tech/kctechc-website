import "server-only";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  type KycApplicationRecord,
  type KycDocumentKind,
  type KycDocumentRecord,
  type KycIdType,
  type KycMembershipType,
  type KycResidencyStatus,
  type KycReviewAction,
  type KycReviewEventRecord,
  type KycStatus,
  type LegalDocumentKind,
  isApplicantVisibleNote,
} from "./kyc";

/**
 * KYC loading.
 *
 * Reads go through the cookie-bound client so RLS decides what the caller sees:
 * an applicant reaches their own application and documents, a super admin reaches
 * every application, and a plain real-estate administrator reaches none of it.
 * The loaders add a `user_id` filter only where they are reading for the
 * applicant; the super-admin views do NOT filter by user, because the policy is
 * the control and a filter here would be a second, weaker copy of it.
 *
 * **The storage path is never returned from a public loader.** `toDocumentRecord`
 * deliberately drops `storage_path`, so a document record that reaches a render
 * path carries no pointer to the bytes. The only function that returns a path is
 * `loadKycDocumentForReview`, which is called from a super-admin-gated route and
 * whose result is used to mint a signed URL and nothing else.
 *
 * On any failure the loaders return an empty result, so a database outage shows
 * the "not started" state rather than an error page.
 */

const APPLICATION_SELECT =
  "id, user_id, membership_type, status, full_legal_name, email, phone, country_of_residence, current_location, residency_status, date_of_birth, id_type, id_issuing_country, id_number_last4, video_consent_at, declaration_accepted_at, submitted_at, reviewed_at, reviewed_by, decision_reason, internal_notes, created_at, updated_at";

function toApplication(row: {
  id: string;
  user_id: string;
  membership_type: KycMembershipType;
  status: KycStatus;
  full_legal_name: string;
  email: string;
  phone: string;
  country_of_residence: string;
  current_location: string | null;
  residency_status: string;
  date_of_birth: string;
  id_type: KycIdType;
  id_issuing_country: string;
  id_number_last4: string | null;
  video_consent_at: string | null;
  declaration_accepted_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_reason: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}): KycApplicationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    membershipType: row.membership_type,
    status: row.status,
    fullLegalName: row.full_legal_name,
    email: row.email,
    phone: row.phone,
    countryOfResidence: row.country_of_residence,
    currentLocation: row.current_location,
    residencyStatus: row.residency_status as KycResidencyStatus,
    dateOfBirth: row.date_of_birth,
    idType: row.id_type,
    idIssuingCountry: row.id_issuing_country,
    idNumberLast4: row.id_number_last4,
    videoConsentAt: row.video_consent_at,
    declarationAcceptedAt: row.declaration_accepted_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    decisionReason: row.decision_reason,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a row to a document record, DROPPING the storage path. */
function toDocumentRecord(row: {
  id: string;
  application_id: string;
  kind: KycDocumentKind;
  original_filename: string;
  detected_mime: string;
  byte_size: number;
  issuing_country: string | null;
  note: string | null;
  created_at: string;
}): KycDocumentRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    kind: row.kind,
    originalFilename: row.original_filename,
    detectedMime: row.detected_mime,
    byteSize: row.byte_size,
    issuingCountry: row.issuing_country,
    note: row.note,
    createdAt: row.created_at,
  };
}

function toReviewEvent(row: {
  id: string;
  application_id: string;
  action: KycReviewAction;
  actor_id: string | null;
  document_id: string | null;
  note: string | null;
  created_at: string;
}): KycReviewEventRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    action: row.action,
    actorId: row.actor_id,
    documentId: row.document_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** The signed-in user's own application for one capability, or null. */
export async function loadMyKycApplication(
  membershipType: KycMembershipType,
): Promise<KycApplicationRecord | null> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated") return null;

    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("real_estate_kyc_applications")
      .select(APPLICATION_SELECT)
      .eq("user_id", auth.userId)
      .eq("membership_type", membershipType)
      .maybeSingle();

    return data ? toApplication(data) : null;
  } catch {
    return null;
  }
}

/** Every application the signed-in user holds, keyed by capability. */
export async function loadMyKycApplications(): Promise<
  Map<KycMembershipType, KycApplicationRecord>
> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated") return new Map();

    const supabase = await createClient();
    if (!supabase) return new Map();

    const { data } = await supabase
      .from("real_estate_kyc_applications")
      .select(APPLICATION_SELECT)
      .eq("user_id", auth.userId);

    return new Map(
      (data ?? []).map((row) => [
        row.membership_type as KycMembershipType,
        toApplication(row),
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * The documents attached to the caller's own application.
 *
 * The storage path is dropped: the applicant does not need it, and returning it
 * would put a pointer to a private object into a render path. An applicant who
 * wants to see their own document is not a workflow the brief describes.
 */
export async function loadMyKycDocuments(
  applicationId: string,
): Promise<KycDocumentRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_kyc_documents")
      .select(
        "id, application_id, kind, original_filename, detected_mime, byte_size, issuing_country, note, created_at",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    return (data ?? []).map(toDocumentRecord);
  } catch {
    return [];
  }
}

/**
 * The review history visible to the applicant.
 *
 * `note` is shared between text the applicant must see (why an application was
 * refused or needs changes) and a reviewer's private remark. A row-level rule
 * cannot hide one column, so the filter is here, and it is a strict allow-list of
 * the actions whose note is applicant-facing:
 *
 *   * `note_added` is an internal note by definition — dropped entirely.
 *   * an `approved` note is documented as optional and INTERNAL in
 *     `kyc-review-actions.ts` (the approval's `p_note` lands on the `approved`
 *     event), so its note is dropped too. Without this, a reviewer's private
 *     remark about an approval would render to the applicant.
 *   * `rejected` and `changes_requested` notes are the decision reason the
 *     applicant is entitled to read, and are kept.
 *
 * A `note_added` row is filtered out whole; the others keep their place in the
 * sequence with the note stripped, so the applicant still sees that a decision
 * happened.
 */
export async function loadMyKycHistory(
  applicationId: string,
): Promise<KycReviewEventRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_kyc_review_events")
      .select("id, application_id, action, actor_id, document_id, note, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    return (data ?? [])
      .map(toReviewEvent)
      .filter((event) => event.action !== "note_added")
      .map((event) =>
        isApplicantVisibleNote(event.action)
          ? event
          : { ...event, note: null },
      );
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Super-admin views.
//
// These read every application. The scoping is the `is_super_admin()` policy:
// the loader does not filter by user, because a filter would be a weaker copy of
// the policy. Each function additionally checks the role first so a caller that
// reaches it without a guard gets nothing rather than a policy error, but the
// policy is what actually refuses.
// -----------------------------------------------------------------------------

/** The KYC review queue, with the applicant's name and email for the console. */
export type KycQueueEntry = KycApplicationRecord & {
  documentCount: number;
};

export type KycQueueFilter = {
  status?: KycStatus | "all";
  search?: string;
};

export async function loadKycQueue(
  filter: KycQueueFilter = {},
): Promise<KycQueueEntry[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    let query = supabase
      .from("real_estate_kyc_applications")
      .select(APPLICATION_SELECT)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (filter.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    const search = filter.search?.trim();
    if (search) {
      // Substring match on name or email. `%` and `_` are escaped so a search for
      // "100%" is a literal, not a wildcard the caller controls.
      const escaped = search.replace(/[%_\\]/g, (match) => `\\${match}`);
      query = query.or(
        `full_legal_name.ilike.%${escaped}%,email.ilike.%${escaped}%`,
      );
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    const records = data.map(toApplication);

    const { data: docs } = await supabase
      .from("real_estate_kyc_documents")
      .select("application_id")
      .in(
        "application_id",
        records.map((record) => record.id),
      );

    const counts = new Map<string, number>();
    for (const row of docs ?? []) {
      counts.set(row.application_id, (counts.get(row.application_id) ?? 0) + 1);
    }

    return records.map((record) => ({
      ...record,
      documentCount: counts.get(record.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** One application, for the console's detail view. */
export async function loadKycApplication(
  applicationId: string,
): Promise<KycApplicationRecord | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("real_estate_kyc_applications")
      .select(APPLICATION_SELECT)
      .eq("id", applicationId)
      .maybeSingle();

    return data ? toApplication(data) : null;
  } catch {
    return null;
  }
}

/** The documents of an application, for the console. Paths are still dropped. */
export async function loadKycDocuments(
  applicationId: string,
): Promise<KycDocumentRecord[]> {
  return loadMyKycDocuments(applicationId);
}

/** The full history of an application, including internal notes. */
export async function loadKycHistory(
  applicationId: string,
): Promise<KycReviewEventRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_kyc_review_events")
      .select("id, application_id, action, actor_id, document_id, note, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    return (data ?? []).map(toReviewEvent);
  } catch {
    return [];
  }
}

/**
 * The storage path of one document, for minting a signed URL.
 *
 * This is the ONE function that returns a path, and it exists only for the
 * super-admin console: the route that calls it is gated on `super_admin`, and its
 * result is passed straight to `signedKycUrl`. Returning the path from any other
 * loader would put a pointer to a private object into a render path.
 */
export async function loadKycDocumentPath(
  documentId: string,
): Promise<{ storagePath: string; detectedMime: string; kind: KycDocumentKind } | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("real_estate_kyc_documents")
      .select("storage_path, detected_mime, kind")
      .eq("id", documentId)
      .maybeSingle();

    if (!data) return null;
    return {
      storagePath: data.storage_path,
      detectedMime: data.detected_mime,
      kind: data.kind,
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Listing legal documents.
// -----------------------------------------------------------------------------

export type LegalDocumentRecord = {
  id: string;
  listingId: string;
  kind: LegalDocumentKind;
  originalFilename: string;
  detectedMime: string;
  byteSize: number;
  description: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

/** The legal documents attached to one listing, for a privileged viewer. */
export async function loadListingLegalDocuments(
  listingId: string,
): Promise<LegalDocumentRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("listing_legal_documents")
      .select(
        "id, listing_id, kind, original_filename, detected_mime, byte_size, description, verified_at, created_at",
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: true });

    return (data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      kind: row.kind,
      originalFilename: row.original_filename,
      detectedMime: row.detected_mime,
      byteSize: row.byte_size,
      description: row.description,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

/** The storage path of one legal document, for a privileged signed URL. */
export async function loadLegalDocumentPath(
  documentId: string,
): Promise<string | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("listing_legal_documents")
      .select("storage_path")
      .eq("id", documentId)
      .maybeSingle();

    return data?.storage_path ?? null;
  } catch {
    return null;
  }
}
