import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquareQuote } from "lucide-react";

import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { StarRating } from "@/components/reviews/StarRating";
import { type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { loadPublicReviews } from "@/lib/reviews/loaders";
import { averageRating, ratingBreakdown } from "@/lib/reviews/types";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * Published customer reviews.
 *
 * A Server Component reading through the anonymous client, so the page prerenders
 * and every review is in the HTML. RLS admits only `status = 'approved'` to an
 * anonymous reader, so a pending review cannot appear here even if this page had a
 * bug — the `.eq("status", "approved")` in the loader is a second belt, not the
 * control.
 *
 * The aggregate rating is computed from the reviews actually rendered. It is never
 * a stored figure and never seeded: a page claiming "4.8 from 214 reviews" while
 * showing three is the kind of unverifiable claim the brief rules out. With no
 * reviews the section says so and no aggregate is shown.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

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
    pathWithoutLocale: "/reviews",
    title: t("reviews.metaTitle"),
    description: t("reviews.metaDescription"),
  });
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = createTranslator(locale).t;

  const reviews = await loadPublicReviews();
  const average = averageRating(reviews);
  const breakdown = ratingBreakdown(reviews);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "fr" ? "fr-CM" : "en-CM",
    { year: "numeric", month: "short", day: "numeric" },
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${locale}` },
    { name: t("reviews.metaTitle"), href: `/${locale}/reviews` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${locale}` },
          { name: t("reviews.metaTitle"), path: `/${locale}/reviews` },
        ])}
      />

      <PageHero
        eyebrow={t("reviews.eyebrow")}
        heading={t("reviews.heading")}
        intro={t("reviews.intro")}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel={t("a11y.breadcrumb")}
      >
        <ButtonLink href={`/${locale}/account/reviews`} variant="accentOnInk" size="lg">
          {t("reviews.writeCta")}
        </ButtonLink>
      </PageHero>

      <SectionBand tone="alt">
        <div className="container-page">
          {reviews.length === 0 ? (
            <div className="rounded-card border border-border bg-surface-alt p-10 text-center">
              <MessageSquareQuote
                size={32}
                className="mx-auto text-muted"
                aria-hidden="true"
              />
              <p className="mt-4 font-display text-lg font-semibold text-ink-900">
                {t("reviews.empty")}
              </p>
              <p className="mt-2 text-sm text-body">{t("reviews.emptyHint")}</p>
              <div className="mt-6">
                <ButtonLink href={`/${locale}/account/reviews`} variant="accent">
                  {t("reviews.writeCta")}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-card border border-border bg-surface-alt px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("reviews.averageLabel")}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-display text-3xl font-semibold text-ink-900">
                      {average === null ? "—" : average.toFixed(1)}
                    </span>
                    {average === null ? null : (
                      <StarRating rating={average} size={18} />
                    )}
                  </div>
                </div>
                <p className="text-sm text-body">
                  {t("reviews.summaryCount", { count: reviews.length })}
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {([5, 4, 3, 2, 1] as const).map((star) => (
                    <li key={star} className="font-mono">
                      {star}★ {breakdown[star]}
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <ReviewCard
                      review={review}
                      dateLabel={dateFormatter.format(new Date(review.createdAt))}
                    />
                  </li>
                ))}
              </ul>

              <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
                {t("reviews.verifiedNote")}
              </p>
            </>
          )}
        </div>
      </SectionBand>
    </>
  );
}
