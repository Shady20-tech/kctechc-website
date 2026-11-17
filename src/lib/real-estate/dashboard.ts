import type { MembershipStatus, MembershipSummary } from "./memberships";

/**
 * The landlord and agent dashboard model.
 *
 * Pure functions only: no database access, no React. The predicates and the
 * overview arithmetic live here so they can be unit-tested without a Supabase
 * project, which is how the access rules get proven — the pages and the Server
 * Actions all call these rather than each re-deriving them.
 *
 * The distinction this module keeps: a *capability* (an approved
 * `real_estate_memberships` row) is what grants a dashboard. It is not a role, and
 * it is not the account-type declaration the user made at signup. A user who
 * declared "landlord" but has no approved membership has nothing to manage yet;
 * a user with an approved membership but no declaration still gets the dashboard.
 * The declaration only decides whether we *offer* the verification journey.
 */

/** The dashboards a signed-in account can reach. */
export const DASHBOARD_KINDS = ["landlord", "agent"] as const;
export type DashboardKind = (typeof DASHBOARD_KINDS)[number];

/** True when the value is a dashboard kind. */
export function isDashboardKind(value: string): value is DashboardKind {
  return (DASHBOARD_KINDS as readonly string[]).includes(value);
}

/**
 * The message key for a dashboard's title, under `account.dashboards.*`.
 *
 * A function rather than a map, so a new kind is a type error here rather than a
 * missing label that renders a raw dotted key.
 */
export function dashboardTitleKey(kind: DashboardKind): string {
  return `account.dashboards.${kind}.title`;
}

/** Where a dashboard lives, relative to the locale segment. */
export function dashboardPath(kind: DashboardKind): string {
  return `/account/${kind}`;
}

/**
 * True when the user holds an approved capability of this kind.
 *
 * `summariseMemberships` always returns one entry per capability, so the lookup
 * is total; the fallback is defensive rather than reachable.
 */
export function hasApprovedCapability(
  memberships: readonly MembershipSummary[],
  kind: DashboardKind,
): boolean {
  const summary = memberships.find((entry) => entry.type === kind);
  return summary?.isActive === true;
}

/**
 * True when a capability row exists in any state.
 *
 * The distinction from `hasApprovedCapability` is what separates "you may use
 * this dashboard" from "your application is with us". A user with no row is
 * offered the apply journey; a user with a pending row is offered the status.
 */
export function hasCapabilityRecord(
  memberships: readonly MembershipSummary[],
  kind: DashboardKind,
): boolean {
  return memberships.some(
    (entry) => entry.type === kind && entry.status !== null,
  );
}

/**
 * Which dashboards a user may actually open, from their capabilities alone.
 *
 * Returns the approved ones in a stable order. This is the function the account
 * page and the dashboard pages both call, so "reachable from the account page
 * where their approved membership permits access" and the page's own guard cannot
 * disagree.
 */
export function accessibleDashboards(
  memberships: readonly MembershipSummary[],
): DashboardKind[] {
  return DASHBOARD_KINDS.filter((kind) =>
    hasApprovedCapability(memberships, kind),
  );
}

/**
 * Whether to offer a dashboard entry that is not yet usable.
 *
 * A capability that is applied for but not approved gets a "continue" link into
 * the verification journey rather than the dashboard, so a user mid-application
 * is not left with a dead end — and a user who has never applied sees the apply
 * affordance on the account page's capability cards.
 */
export function pendingCapabilities(
  memberships: readonly MembershipSummary[],
): DashboardKind[] {
  return DASHBOARD_KINDS.filter((kind) => {
    const summary = memberships.find((entry) => entry.type === kind);
    if (!summary || summary.isActive) return false;
    return summary.status !== null;
  });
}

/** The statuses that mean "we are waiting on the user", not on us. */
const APPLICANT_ACTION_STATUSES: readonly MembershipStatus[] = [
  "rejected",
  "changes_requested",
];

/** True when the user must act for this capability to progress. */
export function capabilityNeedsApplicantAction(
  status: MembershipStatus | null,
): boolean {
  return status !== null && APPLICANT_ACTION_STATUSES.includes(status);
}

/** The statuses that mean a reviewer is working on it. */
export function capabilityIsWithReviewer(
  status: MembershipStatus | null,
): boolean {
  return status === "pending_kyc" || status === "pending_review";
}

/** The listing states that are live to the public. */
const PUBLIC_LISTING_STATUSES = ["published", "under_offer"] as const;

/** The listing states that are finished with. */
const CLOSED_LISTING_STATUSES = ["sold", "rented", "archived"] as const;

/** The subset of a listing the overview arithmetic needs. */
export type OverviewListing = {
  status: string;
  /** The moderation state of the owner's submission, when one exists. */
  submission?: { status: string } | null;
};

/**
 * The counts a dashboard header shows.
 *
 * Derived from the rows the page already loaded rather than from a second set of
 * `count` queries, so the number in the header cannot disagree with the list
 * beneath it. `pendingReview` counts a listing whose own status is
 * `pending_review` *or* whose submission is still awaiting a decision — those are
 * two different rows in two tables describing the same wait, and a dashboard that
 * counted only one would under-report what the user is waiting on.
 */
export type DashboardOverview = {
  total: number;
  drafts: number;
  pendingReview: number;
  published: number;
  closed: number;
};

export function summariseListings(
  listings: readonly OverviewListing[],
): DashboardOverview {
  let drafts = 0;
  let pendingReview = 0;
  let published = 0;
  let closed = 0;

  for (const listing of listings) {
    if (listing.status === "draft") drafts += 1;
    if (listing.status === "pending_review") pendingReview += 1;
    else if (listing.submission?.status === "pending_review") pendingReview += 1;
    if ((PUBLIC_LISTING_STATUSES as readonly string[]).includes(listing.status)) {
      published += 1;
    }
    if ((CLOSED_LISTING_STATUSES as readonly string[]).includes(listing.status)) {
      closed += 1;
    }
  }

  return { total: listings.length, drafts, pendingReview, published, closed };
}

/**
 * The moderation state to show beside a listing.
 *
 * A listing's own status and its submission's status are separate: a landlord
 * submits a draft, the listing moves to `pending_review` and a submission row
 * records the decision. When the reviewer sends it back, the listing returns to
 * `draft` and the submission carries the reason — which is the state the user
 * most needs to see and the one a status column alone would hide.
 */
export type ModerationState =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "approved" }
  | { kind: "rejected"; notes: string | null }
  | { kind: "changes_requested"; notes: string | null };

export function moderationState(
  listingStatus: string,
  submission: { status: string; reviewNotes: string | null } | null,
): ModerationState {
  if (listingStatus === "pending_review") return { kind: "pending" };
  if (!submission) return { kind: "none" };

  switch (submission.status) {
    case "pending_review":
      return { kind: "pending" };
    case "approved":
      return { kind: "approved" };
    case "rejected":
      return { kind: "rejected", notes: submission.reviewNotes };
    case "changes_requested":
      return { kind: "changes_requested", notes: submission.reviewNotes };
    default:
      return { kind: "none" };
  }
}

/**
 * The statuses a user may set on their own listing.
 *
 * Deliberately narrow. A user withdraws a listing from the market
 * (`published` → `archived`) or restores an archived one to a draft to work on
 * it again (`archived` → `draft`); everything else about publication is the
 * reviewer's decision. Offering "publish" here would be a control whose submit
 * the database refuses, which is worse than not offering it.
 */
export const OWNER_SETTABLE_TRANSITIONS: Record<string, readonly string[]> = {
  published: ["archived"],
  under_offer: ["archived"],
  archived: ["draft"],
};

/** True when a user may move their own listing from one state to another. */
export function isOwnerSettableTransition(from: string, to: string): boolean {
  return (OWNER_SETTABLE_TRANSITIONS[from] ?? []).includes(to);
}
