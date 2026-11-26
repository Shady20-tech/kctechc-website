import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { InsightCard } from "@/components/content/InsightCard";
import { SectionBand } from "@/components/layout/PageShell";
import { ListingGrid } from "@/components/real-estate/ListingCard";
import { ProductGrid } from "@/components/store/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { loadFavoriteCollections } from "@/lib/favorites/loaders";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { qualifyListings } from "@/lib/real-estate/listings";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The signed-in customer's saved properties, products and articles.
 *
 * One page rather than one per department: the heart means the same thing
 * everywhere, so "where did the thing I saved go" should have one answer. The
 * three tables are read with the session client and their own-row policies, and
 * the entity loaders are the public ones, so a saved item that has since been
 * unpublished drops out instead of exposing a draft through its saved id.
 *
 * `noindex` because the page is per-customer and renders empty to a crawler.
 * The redirect is for the experience — a signed-out visitor is sent to sign in
 * with this page as the return target, rather than shown an empty list that looks
 * like data loss. The security is the policy, not the guard.
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
    pathWithoutLocale: "/favorites",
    title: t("favorites.metaTitle"),
    description: t("favorites.metaDescription"),
    noindex: true,
  });
}

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/favorites`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/login?next=${returnTo}`);
  }

  const {
    listings: savedListings,
    products,
    insights,
  } = await loadFavoriteCollections(resolved);
  const listings = qualifyListings(savedListings, resolved).map(
    (entry) => entry.record,
  );
  const total = listings.length + products.length + insights.length;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("favorites.heading"), href: `/${resolved}/favorites` },
  ];

  return (
    <SectionBand labelledBy="favorites-heading">
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        eyebrow={t("favorites.eyebrow")}
        heading={t("favorites.heading")}
        intro={t("favorites.intro")}
      />
      <div className="mt-4">
        <CustomerSignOutForm locale={resolved} label={t("actions.signOut")} />
      </div>
      <h2 id="favorites-heading" className="visually-hidden">
        {t("favorites.heading")}
      </h2>

      {total === 0 ? (
        <div className="mt-10 max-w-2xl">
          <p className="text-base text-body">{t("favorites.emptyBody")}</p>
          <p className="mt-6">
            <ButtonLink href={`/${resolved}/services`} variant="secondary">
              {t("favorites.emptyCta")}
            </ButtonLink>
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {listings.length > 0 ? (
            <section aria-labelledby="favorites-properties-heading">
              <h2
                id="favorites-properties-heading"
                className="text-xl font-semibold text-ink-900 sm:text-2xl"
              >
                {t("favorites.propertiesHeading")}
              </h2>
              <div className="mt-6">
                <ListingGrid
                  listings={listings}
                  locale={resolved}
                  t={t}
                  favoriteIds={new Set(listings.map((listing) => listing.id))}
                />
              </div>
            </section>
          ) : null}

          {products.length > 0 ? (
            <section aria-labelledby="favorites-products-heading">
              <h2
                id="favorites-products-heading"
                className="text-xl font-semibold text-ink-900 sm:text-2xl"
              >
                {t("favorites.productsHeading")}
              </h2>
              <div className="mt-6">
                <ProductGrid
                  products={products}
                  locale={resolved}
                  t={t}
                  favoriteProductIds={
                    new Set(products.map((product) => product.id))
                  }
                />
              </div>
            </section>
          ) : null}

          {insights.length > 0 ? (
            <section aria-labelledby="favorites-articles-heading">
              <h2
                id="favorites-articles-heading"
                className="text-xl font-semibold text-ink-900 sm:text-2xl"
              >
                {t("favorites.articlesHeading")}
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((article) => (
                  <li key={article.slug} className="h-full">
                    <InsightCard
                      article={article}
                      locale={resolved}
                      t={t}
                      isFavorite
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </SectionBand>
  );
}
