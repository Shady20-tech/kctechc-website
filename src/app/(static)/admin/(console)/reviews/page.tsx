import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { ReviewDecisionForm } from "@/components/reviews/ReviewDecisionForm";
import { StarRating } from "@/components/reviews/StarRating";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireUser } from "@/lib/auth/guards";
import type { AppRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadReviewQueue } from "@/lib/reviews/loaders";
import {
  MODERATOR_DECISIONS,
  REVIEW_MODERATOR_ROLES,
} from "@/lib/reviews/types";

/**
 * Review moderation queue.
 *
 * This route lives under the non-localized `/admin` tree, so it has no `[locale]`
 * segment. It previously read `params.locale`, found `undefined`, failed
 * `isLocale`, and returned `null` — a completely blank console page for every
 * moderator. The console is English-only (`createTranslator("en")`), the same as
 * every other admin surface.
 *
 * Guarded by `REVIEW_MODERATOR_ROLES`, which is deliberately narrower than
 * "anyone in the console": an agent is a marketplace participant and a landlord is
 * a customer, so neither may decide what is published about the company. The guard
 * here is the message; `reviews_update_moderator` and `is_review_moderator()` are
 * the control.
 *
 * `force-dynamic` because the queue is per-session and must never be prerendered
 * into a static page.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review moderation",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminReviewsPage() {
  const t = createTranslator("en").t;

  const profile = await requireUser("/admin/reviews");
  if (!REVIEW_MODERATOR_ROLES.includes(profile.role as AppRole as never)) {
    redirect("/admin/unauthorized?reason=role");
  }

  const reviews = await loadReviewQueue();
  const pending = reviews.filter(
    (review) => review.status === "pending_review",
  );
  const decided = reviews.filter(
    (review) => review.status !== "pending_review",
  );

  const dateFormatter = new Intl.DateTimeFormat("en-CM", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const decisionLabels = {
    approve: t("reviews.approve"),
    reject: t("reviews.reject"),
    requestChanges: t("reviews.requestChanges"),
    noteLabel: t("reviews.noteLabel"),
    noteHint: t("reviews.noteHint"),
    forbidden: t("reviews.errors.forbidden"),
    generic: t("reviews.errors.generic"),
    noteError: t("reviews.errors.note"),
  };

  return (
    <SectionBand tone="alt">
      <div className="container-page">
        <PageIntro
          eyebrow={t("reviews.eyebrow")}
          heading={t("reviews.moderationHeading")}
          intro={t("reviews.moderationIntro")}
        />

        {reviews.length === 0 ? (
          <p className="mt-8 text-sm text-body">
            {t("reviews.moderationEmpty")}
          </p>
        ) : (
          <div className="mt-8 space-y-10">
            {pending.length > 0 ? (
              <section>
                <h2 className="font-display text-lg font-semibold text-ink-900">
                  {t("reviews.status.pending_review")} ({pending.length})
                </h2>
                <ul className="mt-4 space-y-4">
                  {pending.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-card border border-border bg-surface p-6 shadow-soft"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StarRating rating={review.rating} size={16} />
                        <span className="font-mono text-xs text-muted">
                          {dateFormatter.format(new Date(review.createdAt))}
                        </span>
                      </div>
                      {review.title ? (
                        <h3 className="mt-3 font-display text-base font-semibold text-ink-900">
                          {review.title}
                        </h3>
                      ) : null}
                      <p className="mt-2 whitespace-pre-line text-sm text-body">
                        {review.body}
                      </p>
                      <p className="mt-3 text-sm font-medium text-ink-900">
                        {review.authorName}
                      </p>
                      <div className="mt-5 border-t border-border pt-5">
                        <ReviewDecisionForm
                          reviewId={review.id}
                          labels={decisionLabels}
                          decisions={[...MODERATOR_DECISIONS]}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {decided.length > 0 ? (
              <section>
                <h2 className="font-display text-lg font-semibold text-ink-900">
                  {t("reviews.statusLabel")} ({decided.length})
                </h2>
                <ul className="mt-4 space-y-3">
                  {decided.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-card border border-border bg-surface p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <StarRating rating={review.rating} size={14} />
                          <span className="text-sm font-medium text-ink-900">
                            {review.authorName}
                          </span>
                        </div>
                        <span className="rounded-full bg-surface-alt px-3 py-1 font-mono text-xs text-muted">
                          {t(`reviews.status.${review.status}`)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-body">
                        {review.body}
                      </p>
                      {review.reviewNotes ? (
                        <p className="mt-2 text-xs text-muted">
                          {review.reviewNotes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </SectionBand>
  );
}
