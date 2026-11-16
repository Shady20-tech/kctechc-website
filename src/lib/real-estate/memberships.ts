/**
 * The real-estate capability model, mirrored from the database.
 *
 * These are the values `real_estate_memberships` accepts, declared here so a form
 * can offer them synchronously. They are asserted against
 * `20260101000057_real_estate_memberships.sql` by `memberships.test.ts`, so the
 * mirror cannot drift from the enum the way a hand-copied list would.
 *
 * The distinction this module exists to keep legible:
 *
 *   - `profiles.role` is AUTHORIZATION. It decides whether a caller reaches the
 *     internal console, and it is never self-assigned.
 *   - A membership is a CAPABILITY. It decides whether a customer may act as a
 *     landlord or an agent on the marketplace.
 *
 * They are separate columns in separate tables, and `capability` never implies
 * `role`. A landlord is a customer with a capability, not a member of staff.
 */

/** The capabilities a user may hold. A user may hold both. */
export const MEMBERSHIP_TYPES = ["landlord", "agent"] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

/**
 * Where an application has reached.
 *
 * `not_applied` is deliberately absent: it is the absence of a row, not a state
 * of one, so "has this user applied" is a question about existence rather than a
 * fifth value to keep in step with the four real ones.
 */
export const MEMBERSHIP_STATUSES = [
  "pending_kyc",
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** The statuses an applicant may set for themselves, mirroring the RLS policy. */
export const APPLICANT_SETTABLE_STATUSES = [
  "pending_kyc",
  "pending_review",
] as const satisfies readonly MembershipStatus[];

/**
 * The statuses an applicant may reset by submitting again.
 *
 * A refused application and one sent back for more information are both the
 * applicant's to answer, which is why `applyForMembershipAction` accepts a
 * re-application for either. `approved` and `suspended` are excluded: an approved
 * row is a live capability its holder may not reset, and a staff suspension is not
 * something a member clears by re-applying — offering that would let them undo a
 * decision made about them.
 */
export const REAPPLICABLE_MEMBERSHIP_STATUSES = [
  "rejected",
  "changes_requested",
] as const satisfies readonly MembershipStatus[];

/**
 * The statuses that constitute a live capability.
 *
 * Only `approved`. A pending or suspended membership is not a capability, which
 * is the whole point of the review lifecycle and mirrors the `status = 'approved'`
 * predicate in `user_has_membership()`.
 */
export const ACTIVE_MEMBERSHIP_STATUSES = [
  "approved",
] as const satisfies readonly MembershipStatus[];

/** A membership row as the application reads it. */
export type MembershipRecord = {
  id: string;
  userId: string;
  membershipType: MembershipType;
  status: MembershipStatus;
  kycReference: string | null;
  approvedAt: string | null;
  reviewNotes: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/** True when the status is a live capability. */
export function isActiveMembershipStatus(status: MembershipStatus): boolean {
  return (ACTIVE_MEMBERSHIP_STATUSES as readonly MembershipStatus[]).includes(
    status,
  );
}

/** True when the applicant may submit again to answer a decision. */
export function isReapplicableMembershipStatus(
  status: MembershipStatus | null,
): boolean {
  return (
    status !== null &&
    (REAPPLICABLE_MEMBERSHIP_STATUSES as readonly MembershipStatus[]).includes(
      status,
    )
  );
}

/**
 * The message key for a status label, under `account.membership.status.*`.
 *
 * A function rather than a lookup map so a new enum member is a type error here
 * rather than a missing label that renders a raw key — the failure mode AGENTS.md
 * records for `listingStatusLabelKey`.
 */
export function membershipStatusLabelKey(status: MembershipStatus): string {
  return `account.membership.status.${status}`;
}

/**
 * The message keys for a capability's label and description.
 *
 * `typeLabel` and `typeBody` are separate namespaces rather than a nested
 * `type.landlord.body`, because the i18n parity test splits keys on dots: a
 * literal `"landlord.body"` key is read as a nested path and the comparison
 * throws. The capability name and its enum value are also allowed to differ
 * ("Landlord" vs `landlord`), so the label is looked up rather than capitalised.
 */
export function membershipTypeLabelKey(type: MembershipType): string {
  return `account.membership.typeLabel.${type}`;
}

export function membershipTypeBodyKey(type: MembershipType): string {
  return `account.membership.typeBody.${type}`;
}

/**
 * A capability the user holds, reduced to what a card needs.
 *
 * `canApply` is false when a row exists in any state, because the unique
 * constraint means a second application is an update of the existing row rather
 * than a new one — offering an "Apply" button beside a pending application would
 * promise something the schema forbids.
 */
export type MembershipSummary = {
  type: MembershipType;
  status: MembershipStatus | null;
  canApply: boolean;
  /**
   * True when a row exists in a state the applicant may answer by submitting
   * again — a refusal or a request for more information. Distinct from
   * `canApply`, which is only ever true with no row at all: an approved or
   * suspended membership offers neither.
   */
  canReapply: boolean;
  isActive: boolean;
  reviewNotes: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
};

/**
 * Build the summary for each capability from the rows the user holds.
 *
 * Always returns one entry per capability — including the ones with no row — so a
 * surface can render "you are not a landlord yet, apply here" without first
 * having to reason about which capabilities are missing.
 */
export function summariseMemberships(
  records: readonly MembershipRecord[],
): MembershipSummary[] {
  return MEMBERSHIP_TYPES.map((type) => {
    const record = records.find((entry) => entry.membershipType === type);
    return {
      type,
      status: record?.status ?? null,
      canApply: record === undefined,
      canReapply: isReapplicableMembershipStatus(record?.status ?? null),
      isActive: record ? isActiveMembershipStatus(record.status) : false,
      reviewNotes: record?.reviewNotes ?? null,
      suspendedAt: record?.suspendedAt ?? null,
      suspensionReason: record?.suspensionReason ?? null,
    };
  });
}
