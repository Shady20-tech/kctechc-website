import "server-only";

import { getAuthState } from "@/lib/auth/session";
import { isKycReviewerRole, isRealEstateAdminRole } from "@/lib/auth/roles";
import type { Locale } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";

import { localizeGeographyName } from "./geography";
import {
  summariseMemberships,
  type MembershipRecord,
  type MembershipStatus,
  type MembershipSummary,
  type MembershipType,
} from "./memberships";

/**
 * Membership loading.
 *
 * Reads go through the cookie-bound client so RLS decides what the caller sees:
 * a user reaches their own rows, real-estate staff reach every row. The loader
 * does not add a `user_id` filter of its own for the staff view, because that
 * would be a second, weaker copy of the policy — and the one place it must filter
 * (the applicant's own summary) is written so a missing session yields "no
 * memberships" rather than another account's.
 *
 * On any failure the loaders return an empty result, so a database outage shows
 * the "not applied" state rather than an error page.
 */

/** Map a row to the application's record shape. */
function toRecord(row: {
  id: string;
  user_id: string;
  membership_type: MembershipType;
  status: MembershipStatus;
  kyc_reference: string | null;
  approved_at: string | null;
  review_notes: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}): MembershipRecord {
  return {
    id: row.id,
    userId: row.user_id,
    membershipType: row.membership_type,
    status: row.status,
    kycReference: row.kyc_reference,
    approvedAt: row.approved_at,
    reviewNotes: row.review_notes,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MEMBERSHIP_SELECT =
  "id, user_id, membership_type, status, kyc_reference, approved_at, review_notes, suspended_at, suspension_reason, verified_at, created_at, updated_at";

/** The signed-in user's own membership rows. */
export async function loadMyMemberships(): Promise<MembershipRecord[]> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated") return [];

    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_memberships")
      .select(MEMBERSHIP_SELECT)
      .eq("user_id", auth.userId);

    return (data ?? []).map(toRecord);
  } catch {
    return [];
  }
}

/**
 * The signed-in user's capabilities, one entry per capability.
 *
 * Always returns both entries — including the ones with no row — so a surface can
 * render the "apply" affordance without reasoning about which capabilities are
 * absent. This is what the account page and the capability cards consume.
 */
export async function loadMyMembershipSummary(): Promise<MembershipSummary[]> {
  return summariseMemberships(await loadMyMemberships());
}

/**
 * The ten Cameroon regions, for the residency form's region selector.
 *
 * These are the seeded administrative rows, not invented data: the brief's rule is
 * that geographic data comes from a vetted dataset, and `regions` is where the
 * vetted rows live (seeded by migration, per the migration-time seeding note in
 * AGENTS.md). The loader reads them rather than hardcoding a list, so a corrected
 * or renamed region reaches the form without a code change.
 *
 * Divisions and subdivisions are deliberately not offered here. A residency
 * profile needs the region, and loading the whole tree for a country of residence
 * would be far more data than the field justifies.
 */
export type RegionOption = { id: string; name: string };

/**
 * Map region rows to the selector's options in the visitor's language.
 *
 * Split from the loader so the localization is testable without a database, the
 * same way `buildGeographyTree` is. The stored `name` is the English name and
 * `name_fr` the French one, so a French page that read `name` alone would offer
 * "Far North" where the rest of the page is French.
 */
export function regionOptions(
  rows: readonly {
    id: string;
    slug: string;
    name: string;
    name_fr: string | null;
  }[],
  locale: Locale,
): RegionOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: localizeGeographyName(row, locale),
  }));
}

export async function loadCameroonRegions(
  locale: Locale,
): Promise<RegionOption[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("regions")
      .select("id, slug, name, name_fr")
      .order("sort_order", { ascending: true });

    return regionOptions(data ?? [], locale);
  } catch {
    return [];
  }
}

/**
 * The approved memberships, for the super admin's verification console.
 *
 * A verification badge is a public trust mark, so the console lists the
 * capabilities that could carry one — the approved rows — rather than the pending
 * queue. A super admin grants the badge to a member they have decided on, not to
 * an application.
 *
 * Returns an empty list for a caller who is not a super admin, rather than
 * relying on the page guard alone, so the loader is safe to call from anywhere.
 */
export async function loadVerifiedMembershipCandidates(): Promise<
  MembershipQueueEntry[]
> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated" || !auth.profile) return [];
    if (!isKycReviewerRole(auth.profile.role)) return [];

    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_memberships")
      .select(MEMBERSHIP_SELECT)
      .eq("status", "approved")
      .order("approved_at", { ascending: false });

    if (!data || data.length === 0) return [];

    const records = data.map(toRecord);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in(
        "id",
        records.map((record) => record.userId),
      );

    const byId = new Map(
      (profiles ?? []).map((row) => [
        row.id,
        { email: row.email ?? null, fullName: row.full_name ?? null },
      ]),
    );

    return records.map((record) => ({
      ...record,
      email: byId.get(record.userId)?.email ?? null,
      fullName: byId.get(record.userId)?.fullName ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * The review queue, for real-estate staff.
 *
 * Returns an empty list for a caller who is not staff, rather than relying on the
 * page guard alone: a loader that trusted its caller would disclose the queue the
 * first time it was called from a surface that forgot to guard.
 */
export type MembershipQueueEntry = MembershipRecord & {
  email: string | null;
  fullName: string | null;
};

export async function loadMembershipQueue(): Promise<MembershipQueueEntry[]> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated" || !auth.profile) return [];
    if (!isRealEstateAdminRole(auth.profile.role)) return [];

    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("real_estate_memberships")
      .select(MEMBERSHIP_SELECT)
      .in("status", ["pending_kyc", "pending_review"])
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) return [];

    const records = data.map(toRecord);

    // The applicant's name and email, so the queue is actionable. Read in one
    // query rather than one per row; a missing profile degrades to null rather
    // than dropping the application.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in(
        "id",
        records.map((record) => record.userId),
      );

    const byId = new Map(
      (profiles ?? []).map((row) => [
        row.id,
        { email: row.email ?? null, fullName: row.full_name ?? null },
      ]),
    );

    return records.map((record) => ({
      ...record,
      email: byId.get(record.userId)?.email ?? null,
      fullName: byId.get(record.userId)?.fullName ?? null,
    }));
  } catch {
    return [];
  }
}
