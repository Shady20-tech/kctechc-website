import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { SavedSearchCard } from "@/components/real-estate/SavedSearchCard";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { loadSavedSearches } from "@/lib/real-estate/loaders";
import { buildMetadata } from "@/lib/seo/metadata";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * The signed-in customer's saved searches, with their alert preferences.
 *
 * This page is what makes the save control on the listings page worth having: a
 * saved search is a query string, and without somewhere to list them the customer
 * would have no way back to one except their browser history.
 *
 * The alert preference is shown and edited here rather than at save time, because
 * deciding to be notified is a different decision from deciding the search is
 * worth keeping — and a customer who has just saved a search is usually still
 * looking at the results, not choosing an email cadence.
 *
 * `noindex` for the same reason as the favourites page: per-customer, empty for a
 * crawler, and nothing an index should hold.
 */

// Per-customer data behind a session: rendering this at build time would bake in
// the signed-out redirect and serve it to everyone.
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
    pathWithoutLocale: "/real-estate/saved-searches",
    title: t("realEstate.savedSearches.metaTitle"),
    description: t("realEstate.savedSearches.metaDescription"),
    noindex: true,
  });
}

export default async function SavedSearchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/real-estate/saved-searches`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/admin/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/admin/login?next=${returnTo}`);
  }

  const searches = await loadSavedSearches();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("realEstate.eyebrow"), href: `/${resolved}${REAL_ESTATE_PATH}` },
    {
      name: t("realEstate.savedSearches.heading"),
      href: `/${resolved}/real-estate/saved-searches`,
    },
  ];

  return (
    <SectionBand
      labelledBy="saved-searches-heading"
      {...departmentScopeProps("real-estate")}
    >
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.savedSearches.heading")}
        intro={t("realEstate.savedSearches.intro")}
      />
      <h2 id="saved-searches-heading" className="visually-hidden">
        {t("realEstate.savedSearches.heading")}
      </h2>

      <div className="mt-10">
        {searches.length === 0 ? (
          <div className="max-w-2xl">
            <p className="text-base text-body">
              {t("realEstate.savedSearches.empty")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}/real-estate/listings`}
                variant="secondary"
              >
                {t("realEstate.savedSearches.backToListings")}
              </ButtonLink>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {searches.map((search) => (
              <SavedSearchCard
                key={search.id}
                locale={resolved}
                search={search}
              />
            ))}
          </ul>
        )}
      </div>
    </SectionBand>
  );
}
