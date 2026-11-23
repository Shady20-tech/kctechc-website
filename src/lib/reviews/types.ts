/**
 * Review domain types and the moderation rules that are not SQL.
 *
 * The status values mirror `public.submission_status`; `reviews.test.ts` reads
 * the enum from the migrations and asserts the mirror, the same guard the
 * real-estate enums use. A drift there would mean the UI offers a transition the
 * database refuses.
 */

/** Mirrors `public.submission_status`. */
export const REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** The states a moderator may move a review into. `pending_review` is the entry state. */
export const MODERATOR_DECISIONS = [
  "approved",
  "rejected",
  "changes_requested",
] as const;

export type ModeratorDecision = (typeof MODERATOR_DECISIONS)[number];

export const REVIEW_MIN_BODY = 10;
export const REVIEW_MAX_BODY = 4000;
export const REVIEW_MAX_TITLE = 160;
export const REVIEW_MAX_NAME = 120;

/** A public review: only ever an approved row. */
export type PublicReview = {
  id: string;
  authorName: string;
  authorRoleLabel?: string;
  rating: number;
  title?: string;
  body: string;
  departmentSlug?: string;
  createdAt: string;
};

/** A review as its author sees it, whatever its state. */
export type OwnReview = PublicReview & {
  status: ReviewStatus;
  reviewNotes?: string;
};

/** A review as a moderator sees it, including the queue fields. */
export type ModeratableReview = OwnReview & {
  authorId?: string;
  reviewedAt?: string;
};

/**
 * Whether a decision needs a reason.
 *
 * An approval may be silent; a refusal or a request for changes must say why, or
 * the author is told "no" with nothing to act on. The database enforces the same
 * rule in `reviews_refusal_requires_note`.
 */
export function decisionRequiresNote(decision: ModeratorDecision): boolean {
  return decision === "rejected" || decision === "changes_requested";
}

/**
 * Whether the given role may moderate reviews.
 *
 * Mirrors `is_review_moderator()`. An allow-list, not "not an agent and not a
 * landlord": a role added later must be classified on purpose rather than
 * silently inheriting the power to publish reviews about the company.
 *
 * `real_estate_agent` is deliberately absent — an agent's own listings sit beside
 * these reviews, which is a conflict of interest — and every customer, including
 * an approved landlord, is absent because a customer is the author, not the
 * reviewer.
 */
export const REVIEW_MODERATOR_ROLES = [
  "real_estate_staff",
  "real_estate_admin",
  "digital_marketing_staff",
  "digital_marketing_admin",
  "electrical_staff",
  "electrical_admin",
  "department_staff",
  "super_admin",
] as const;

/**
 * The average rating of a set of reviews, or null when there are none.
 *
 * Null rather than 0: "no reviews yet" and "rated zero" are different facts, and
 * a 0 would render as a one-star-looking average on a page with nothing to show.
 */
export function averageRating(reviews: readonly { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

/**
 * How many reviews sit at each star level, for the distribution display.
 *
 * Always returns all five keys so a caller can render an empty bar rather than
 * having to test for a missing one.
 */
export function ratingBreakdown(
  reviews: readonly { rating: number }[],
): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const review of reviews) {
    if (review.rating >= 1 && review.rating <= 5) {
      counts[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }
  return counts;
}
