import { StarRating } from "./StarRating";
import type { PublicReview } from "@/lib/reviews/types";

/**
 * One published review.
 *
 * A Server Component: no state, no handlers. The whole review — rating, byline,
 * body — is in the HTML, so it is crawlable and readable without JavaScript.
 *
 * The date is rendered as a machine-readable `<time>` with a human label, which is
 * what lets a crawler place the review in time without parsing a locale string.
 */
export function ReviewCard({
  review,
  dateLabel,
}: {
  review: PublicReview;
  /** Pre-formatted by the page, which owns the locale. */
  dateLabel: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <StarRating rating={review.rating} size={16} />
        <time
          dateTime={review.createdAt}
          className="font-mono text-xs text-muted"
        >
          {dateLabel}
        </time>
      </div>

      {review.title ? (
        <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">
          {review.title}
        </h3>
      ) : null}

      <p className="mt-3 flex-1 whitespace-pre-line text-sm leading-relaxed text-body">
        {review.body}
      </p>

      <footer className="mt-5 border-t border-border pt-4">
        <p className="text-sm font-medium text-ink-900">{review.authorName}</p>
        {review.authorRoleLabel ? (
          <p className="text-xs text-muted">{review.authorRoleLabel}</p>
        ) : null}
      </footer>
    </article>
  );
}
