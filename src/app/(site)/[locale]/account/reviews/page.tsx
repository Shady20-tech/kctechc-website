import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { DeleteReviewForm } from "@/components/reviews/DeleteReviewForm";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { StarRating } from "@/components/reviews/StarRating";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { loadOwnReviews } from "@/lib/reviews/loaders";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The signed-in customer's own reviews, and the form to write one.
 *
 * `force-dynamic` because both the form's identity and the list read the session
 * cookie; prerendering it would bake in the signed-out redirect and serve it to
 * everyone.
 *
 * The list shows a review in whatever state it is in, including the moderator's
 * reason for a rejection — that is the author's own record and they are entitled
 * to it. A pending review is visible here and nowhere else, which is what makes
 * "submitted" mean something.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: "/account/reviews",
    title: t("reviews.myReviewsHeading"),
    description: t("reviews.myReviewsIntro"),
    noindex: true,
  });
}

export default async function AccountReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = createTranslator(locale).t;

  const returnTo = encodeURIComponent(`/${locale}/account/reviews`);
  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/login?next=${returnTo}`);
  }

  const reviews = await loadOwnReviews();

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "fr" ? "fr-CM" : "en-CM",
    { year: "numeric", month: "short", day: "numeric" },
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${locale}` },
    { name: t("nav.account"), href: `/${locale}/account` },
    { name: t("reviews.myReviewsHeading"), href: `/${locale}/account/reviews` },
  ];

  const departments = DEPARTMENTS.map((department) => ({
    slug: department.slug,
    name: t(`departments.${department.slug}.name`),
  }));

  return (
    <>
      <SectionBand tone="alt">
        <div className="container-page">
          <Breadcrumbs items={breadcrumbs} ariaLabel={t("a11y.breadcrumb")} />
          <PageIntro
            eyebrow={t("reviews.eyebrow")}
            heading={t("reviews.myReviewsHeading")}
            intro={t("reviews.myReviewsIntro")}
          />

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="rounded-card border border-border bg-surface p-6 shadow-soft">
              <h2 className="font-display text-lg font-semibold text-ink-900">
                {t("reviews.writeCta")}
              </h2>
              <div className="mt-6">
                <ReviewForm
                  labels={{
                    ratingLabel: t("reviews.ratingLabel"),
                    ratingHint: t("reviews.ratingHint"),
                    nameLabel: t("reviews.nameLabel"),
                    nameHint: t("reviews.nameHint"),
                    titleLabel: t("reviews.titleLabel"),
                    titleHint: t("reviews.titleHint"),
                    bodyLabel: t("reviews.bodyLabel"),
                    bodyHint: t("reviews.bodyHint"),
                    departmentLabel: t("reviews.departmentLabel"),
                    departmentHint: t("reviews.departmentHint"),
                    departmentNone: t("reviews.departmentNone"),
                    consentLabel: t("reviews.consentLabel"),
                    consentHint: t("reviews.consentHint"),
                    submit: t("reviews.submit"),
                    submitting: t("reviews.submitting"),
                    submittedTitle: t("reviews.submittedTitle"),
                    submittedBody: t("reviews.submittedBody"),
                    errors: {
                      rating: t("reviews.errors.rating"),
                      authorName: t("reviews.errors.authorName"),
                      body: t("reviews.errors.body"),
                      publishConsent: t("reviews.errors.publishConsent"),
                      unauthenticated: t("reviews.errors.unauthenticated"),
                      generic: t("reviews.errors.generic"),
                    },
                  }}
                  departments={departments}
                  defaultName={state.profile?.fullName ?? undefined}
                />
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900">
                {t("reviews.myReviewsHeading")}
              </h2>

              {reviews.length === 0 ? (
                <p className="mt-4 text-sm text-body">{t("reviews.myReviewsEmpty")}</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-card border border-border bg-surface p-5 shadow-soft"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StarRating rating={review.rating} size={16} />
                        <span className="rounded-full bg-surface-alt px-3 py-1 font-mono text-xs text-muted">
                          {t(`reviews.status.${review.status}`)}
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

                      <p className="mt-3 font-mono text-xs text-muted">
                        {dateFormatter.format(new Date(review.createdAt))}
                      </p>

                      {review.reviewNotes ? (
                        <div className="mt-3 rounded-field border border-border bg-surface-alt px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {t("reviews.noteLabel")}
                          </p>
                          <p className="mt-1 text-sm text-body">{review.reviewNotes}</p>
                        </div>
                      ) : null}

                      <div className="mt-4">
                        <DeleteReviewForm
                          reviewId={review.id}
                          label={t("reviews.deleteMine")}
                          confirmMessage={t("reviews.deleteConfirm")}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </SectionBand>
    </>
  );
}
