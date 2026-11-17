import { describe, expect, it } from "vitest";

import {
  accessibleDashboards,
  capabilityIsWithReviewer,
  capabilityNeedsApplicantAction,
  dashboardPath,
  dashboardTitleKey,
  hasApprovedCapability,
  hasCapabilityRecord,
  isDashboardKind,
  isOwnerSettableTransition,
  moderationState,
  OWNER_SETTABLE_TRANSITIONS,
  summariseListings,
  type OverviewListing,
} from "./dashboard";
import type { MembershipSummary } from "./memberships";

/**
 * The dashboard model's rules, proven without a database.
 *
 * These are the predicates the pages and the Server Actions both call, so a
 * regression here would change what a user can reach and what they are offered —
 * not merely how something looks. The two that matter most are
 * `accessibleDashboards` (which decides whether the account page links to a
 * dashboard at all) and `isOwnerSettableTransition` (which decides which
 * publication controls the dashboard offers).
 */

function summary(
  overrides: Partial<MembershipSummary> & { type: MembershipSummary["type"] },
): MembershipSummary {
  return {
    status: null,
    canApply: true,
    canReapply: false,
    isActive: false,
    reviewNotes: null,
    suspendedAt: null,
    suspensionReason: null,
    ...overrides,
  };
}

describe("dashboard kind guards", () => {
  it("accepts only the known kinds", () => {
    expect(isDashboardKind("landlord")).toBe(true);
    expect(isDashboardKind("agent")).toBe(true);
    expect(isDashboardKind("admin")).toBe(false);
    expect(isDashboardKind("")).toBe(false);
  });

  it("builds a path and a title key per kind", () => {
    expect(dashboardPath("landlord")).toBe("/account/landlord");
    expect(dashboardPath("agent")).toBe("/account/agent");
    expect(dashboardTitleKey("landlord")).toBe(
      "account.dashboards.landlord.title",
    );
  });
});

describe("capability predicates", () => {
  it("treats only an approved membership as a capability", () => {
    const pending = [summary({ type: "landlord", status: "pending_review" })];
    const approved = [
      summary({ type: "landlord", status: "approved", isActive: true, canApply: false }),
    ];

    expect(hasApprovedCapability(pending, "landlord")).toBe(false);
    expect(hasApprovedCapability(approved, "landlord")).toBe(true);
    expect(hasApprovedCapability(pending, "agent")).toBe(false);
  });

  it("distinguishes a row in any state from no row at all", () => {
    const pending = [summary({ type: "landlord", status: "pending_kyc" })];
    const none = [summary({ type: "landlord", status: null })];

    expect(hasCapabilityRecord(pending, "landlord")).toBe(true);
    expect(hasCapabilityRecord(none, "landlord")).toBe(false);
  });

  it("offers only the approved dashboards", () => {
    const memberships = [
      summary({ type: "landlord", status: "approved", isActive: true, canApply: false }),
      summary({ type: "agent", status: "pending_review" }),
    ];

    expect(accessibleDashboards(memberships)).toEqual(["landlord"]);
  });

  it("returns no dashboards for a user with neither capability", () => {
    expect(
      accessibleDashboards([
        summary({ type: "landlord" }),
        summary({ type: "agent" }),
      ]),
    ).toEqual([]);
  });

  it("separates the applicant's turn from the reviewer's", () => {
    expect(capabilityNeedsApplicantAction("rejected")).toBe(true);
    expect(capabilityNeedsApplicantAction("changes_requested")).toBe(true);
    expect(capabilityNeedsApplicantAction("pending_review")).toBe(false);
    expect(capabilityNeedsApplicantAction(null)).toBe(false);

    expect(capabilityIsWithReviewer("pending_kyc")).toBe(true);
    expect(capabilityIsWithReviewer("pending_review")).toBe(true);
    expect(capabilityIsWithReviewer("approved")).toBe(false);
  });
});

describe("summariseListings", () => {
  it("counts each state, and a submission awaiting review as a wait", () => {
    const listings: OverviewListing[] = [
      { status: "draft", submission: null },
      { status: "draft", submission: { status: "rejected" } },
      { status: "pending_review", submission: { status: "pending_review" } },
      // The listing itself is a draft again after being sent back, but its
      // submission is still open — that is a wait, and the count must see it.
      { status: "draft", submission: { status: "pending_review" } },
      { status: "published", submission: { status: "approved" } },
      { status: "under_offer", submission: null },
      { status: "sold", submission: null },
      { status: "archived", submission: null },
    ];

    expect(summariseListings(listings)).toEqual({
      total: 8,
      drafts: 3,
      pendingReview: 2,
      published: 2,
      closed: 2,
    });
  });

  it("returns zeroes for an empty portfolio", () => {
    expect(summariseListings([])).toEqual({
      total: 0,
      drafts: 0,
      pendingReview: 0,
      published: 0,
      closed: 0,
    });
  });
});

describe("moderationState", () => {
  it("reports a pending listing even before a submission exists", () => {
    expect(moderationState("pending_review", null)).toEqual({ kind: "pending" });
  });

  it("reports none for a draft with no submission", () => {
    expect(moderationState("draft", null)).toEqual({ kind: "none" });
  });

  it("carries the reviewer's note on a refusal", () => {
    expect(
      moderationState("draft", {
        status: "rejected",
        reviewNotes: "The photographs do not show the property.",
      }),
    ).toEqual({
      kind: "rejected",
      notes: "The photographs do not show the property.",
    });
  });

  it("reports approval and a request for changes", () => {
    expect(
      moderationState("published", { status: "approved", reviewNotes: null }),
    ).toEqual({ kind: "approved" });
    expect(
      moderationState("draft", {
        status: "changes_requested",
        reviewNotes: "Add the land area.",
      }),
    ).toEqual({ kind: "changes_requested", notes: "Add the land area." });
  });

  it("reports pending when the submission is still open", () => {
    expect(
      moderationState("draft", { status: "pending_review", reviewNotes: null }),
    ).toEqual({ kind: "pending" });
  });
});

describe("owner-settable transitions", () => {
  it("lets an owner withdraw and restore, but never publish", () => {
    expect(isOwnerSettableTransition("published", "archived")).toBe(true);
    expect(isOwnerSettableTransition("under_offer", "archived")).toBe(true);
    expect(isOwnerSettableTransition("archived", "draft")).toBe(true);
  });

  it("refuses publication and cross-state jumps", () => {
    expect(isOwnerSettableTransition("draft", "published")).toBe(false);
    expect(isOwnerSettableTransition("archived", "published")).toBe(false);
    expect(isOwnerSettableTransition("published", "draft")).toBe(false);
    expect(isOwnerSettableTransition("sold", "archived")).toBe(false);
    expect(isOwnerSettableTransition("nonsense", "draft")).toBe(false);
  });

  it("never offers a transition into a public state", () => {
    // The review gate is the whole point of the workflow: if any owner-settable
    // transition reached `published`, the dashboard would offer a control whose
    // submit the lifecycle trigger refuses.
    for (const targets of Object.values(OWNER_SETTABLE_TRANSITIONS)) {
      expect(targets).not.toContain("published");
      expect(targets).not.toContain("under_offer");
    }
  });
});
