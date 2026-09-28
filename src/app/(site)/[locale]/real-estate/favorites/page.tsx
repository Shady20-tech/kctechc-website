import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { SectionBand } from "@/components/layout/PageShell";
import { ListingGrid } from "@/components/real-estate/ListingCard";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { loadFavoriteListings } from "@/lib/real-estate/loaders";
import { qualifyListings } from "@/lib/real-estate/listings";
import { buildMetadata } from "@/lib/seo/metadata";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * The signed-in customer's saved properties.
 *
 * This page is the reason the save control on a card is worth having: without it
 * a favourite would be a toggle with no destination. It is deliberately the only
 * place favourites are listed, so a customer has one answer to "where did the
 * property I saved go".
 *
 * The page reads the saved listings through the session client, and the table's
 * policy restricts every row to `auth.uid() = user_id`. The guard below is for the
 * *experience* — a signed-out visitor is sent to sign-in with this page as the
 * return target, rather than being shown an empty list that looks like data loss.
 * The security is the policy, not the guard.
 *
 * `noindex` because the page is per-customer: it is reachable only when signed in,
 * it would render empty to a crawler, and indexing it would put a private-looking
 * URL in the index for no benefit.
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
    pathWithoutLocale: "/real-estate/favorites",
    title: t("realEstate.favorites.metaTitle"),
    description: t("realEstate.favorites.metaDescription"),
    noindex: true,
  });
}

export default async function FavoriteListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/real-estate/favorites`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/admin/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/admin/login?next=${returnTo}`);
  }

  const saved = await loadFavoriteListings();
  const qualified = qualifyListings(saved, resolved);
  const listings = qualified.map((entry) => entry.record);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("realEstate.eyebrow"), href: `/${resolved}${REAL_ESTATE_PATH}` },
    {
      name: t("realEstate.favorites.heading"),
      href: `/${resolved}/real-estate/favorites`,
    },
  ];

  return (
    <SectionBand
      labelledBy="saved-properties-heading"
      {...departmentScopeProps("real-estate")}
    >
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.favorites.heading")}
        intro={t("realEstate.favorites.intro")}
      />
      <div className="mt-4">
        <CustomerSignOutForm locale={resolved} label={t("actions.signOut")} />
      </div>
      <h2 id="saved-properties-heading" className="visually-hidden">
        {t("realEstate.favorites.heading")}
      </h2>

      <div className="mt-10">
        {listings.length === 0 ? (
          <div className="max-w-2xl">
            <p className="text-base text-body">
              {t("realEstate.favorites.empty")}
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
          <>
            <p className="mb-6 text-sm text-muted" aria-live="polite">
              {listings.length === 1
                ? t("realEstate.favorites.resultsCountOne")
                : t("realEstate.favorites.resultsCount", {
                    count: listings.length,
                  })}
            </p>
            {/* Every listing here is saved by definition, so the save control is
                shown filled rather than being omitted: it is how the customer
                removes one from the page they are looking at. */}
            <ListingGrid
              listings={listings}
              locale={resolved}
              t={t}
              favoriteIds={new Set(listings.map((listing) => listing.id))}
            />
          </>
        )}
      </div>
    </SectionBand>
  );
}
