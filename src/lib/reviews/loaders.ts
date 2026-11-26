import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

import type { ModeratableReview, OwnReview, PublicReview, ReviewStatus } from "./types";

/**
 * Review reads.
 *
 * Two clients, on purpose, and the split matters:
 *
 *   * `loadPublicReviews` reads through `createPublicClient()`, which is
 *     stateless and anonymous. The reviews page must stay statically renderable,
 *     and a cookie-bound client would make it dynamic — the same trap the store
 *     and listing loaders hit. RLS already limits an anonymous reader to
 *     `status = 'approved'`, so the filter here is a second belt rather than the
 *     control.
 *
 *   * The queue and the author's own reviews read through the cookie-bound
 *     client, because they are per-user and RLS scopes them to the caller. The
 *     service-role client is never used here: that would make the policies
 *     decorative, which is the exact mistake the review moderation is designed to
 *     avoid.
 *
 * Every loader returns an empty result on failure rather than throwing. A review
 * section that cannot reach the database should render nothing, not take the
 * whole page down.
 */

type ReviewRow = {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role_label: string | null;
  rating: number;
  title: string | null;
  body: string;
  department_slug: string | null;
  status: ReviewStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const PUBLIC_COLUMNS =
  "id, author_name, author_role_label, rating, title, body, department_slug, created_at";

const OWN_COLUMNS =
  "id, author_name, author_role_label, rating, title, body, department_slug, created_at, status, review_notes";

const QUEUE_COLUMNS =
  "id, author_id, author_name, author_role_label, rating, title, body, department_slug, created_at, status, review_notes, reviewed_at";

function toPublicReview(row: ReviewRow): PublicReview {
  return {
    id: row.id,
    authorName: row.author_name,
    authorRoleLabel: row.author_role_label ?? undefined,
    rating: row.rating,
    title: row.title ?? undefined,
    body: row.body,
    departmentSlug: row.department_slug ?? undefined,
    createdAt: row.created_at,
  };
}

function toOwnReview(row: ReviewRow): OwnReview {
  return {
    ...toPublicReview(row),
    status: row.status,
    reviewNotes: row.review_notes ?? undefined,
  };
}

function toModeratableReview(row: ReviewRow): ModeratableReview {
  return {
    ...toOwnReview(row),
    authorId: row.author_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

/**
 * Approved reviews for the public page, newest first.
 *
 * `limit` is bounded so a caller cannot ask for the whole table; the page shows a
 * first page of reviews and the section is not a feed.
 */
export async function loadPublicReviews(limit = 24): Promise<PublicReview[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("reviews")
    .select(PUBLIC_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error || !data) return [];
  return (data as unknown as ReviewRow[]).map(toPublicReview);
}

/** The signed-in author's own reviews, newest first, whatever their state. */
export async function loadOwnReviews(): Promise<OwnReview[]> {
  const client = await createClient();
  if (!client) return [];

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from("reviews")
    .select(OWN_COLUMNS)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as ReviewRow[]).map(toOwnReview);
}

/**
 * The moderation queue, oldest first.
 *
 * Oldest first is deliberate: a queue that shows the newest submission first
 * starves the ones that have waited longest, and a customer waiting on a review
 * has no way to know their submission is simply behind newer ones.
 */
export async function loadReviewQueue(): Promise<ModeratableReview[]> {
  const client = await createClient();
  if (!client) return [];

  const { data, error } = await client
    .from("reviews")
    .select(QUEUE_COLUMNS)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as unknown as ReviewRow[]).map(toModeratableReview);
}
