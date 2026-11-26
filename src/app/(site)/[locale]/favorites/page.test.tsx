import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthState, loadFavoriteCollections, redirect } = vi.hoisted(() => ({
  getAuthState: vi.fn(),
  loadFavoriteCollections: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthState }));

vi.mock("@/lib/favorites/loaders", () => ({ loadFavoriteCollections }));

vi.mock("next/navigation", () => ({
  redirect,
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-favorite-ids", () => ({
  useFavoriteIds: () => null,
  requestFavoriteSummary: vi.fn(),
}));

vi.mock("@/lib/favorites/actions", () => ({
  toggleFavoriteAction: vi.fn(),
}));

vi.mock("@/components/auth/CustomerSignOutForm", () => ({
  CustomerSignOutForm: () => null,
}));

import FavoritesPage from "@/app/(site)/[locale]/favorites/page";
import type { LocalizedInsight } from "@/lib/content/types";
import { createTranslator } from "@/lib/i18n/translator";
import type { LocalizedProduct } from "@/lib/store/types";

const t = createTranslator("en").t;

function product(): LocalizedProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    categorySlug: "solar",
    departmentSlug: "electrical-services",
    slug: "solar-kit",
    sku: "KC-SOLAR-1",
    productReference: "KC-SOLAR-1",
    title: "Solar kit",
    shortDescription: "A solar kit.",
    description: "A solar kit.",
    specifications: [],
    priceMinor: 100000,
    currency: "XAF",
    stock: 3,
    availability: "in_stock",
    condition: "new",
    images: [],
    hasFallback: false,
    seo: {},
  };
}

const insight: LocalizedInsight = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "land-title",
  title: "How to verify a land title",
  summary: "What to check before you pay.",
  body: "Body text.",
  relatedServiceSlugs: [],
  isFeatured: false,
  publishedAt: "2026-01-05T00:00:00.000Z",
  seo: {},
};

beforeEach(() => {
  getAuthState.mockReset();
  loadFavoriteCollections.mockReset();
  redirect.mockReset();
});

describe("FavoritesPage", () => {
  it("renders the empty state when nothing is saved", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      userId: "user-1",
      email: null,
      profile: null,
    });
    loadFavoriteCollections.mockResolvedValue({
      listings: [],
      products: [],
      insights: [],
    });

    render(await FavoritesPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByText(t("favorites.emptyBody"))).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: t("favorites.emptyCta") }),
    ).toHaveAttribute("href", "/en/services");
  });

  it("renders a section for each saved entity type", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      userId: "user-1",
      email: null,
      profile: null,
    });
    loadFavoriteCollections.mockResolvedValue({
      listings: [],
      products: [product()],
      insights: [insight],
    });

    render(await FavoritesPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(
      screen.getByRole("heading", { name: t("favorites.productsHeading") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("favorites.articlesHeading") }),
    ).toBeInTheDocument();
    expect(screen.getByText("Solar kit")).toBeInTheDocument();
    expect(screen.getByText("How to verify a land title")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in with this page as the target", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated" });
    loadFavoriteCollections.mockResolvedValue({
      listings: [],
      products: [],
      insights: [],
    });

    await FavoritesPage({ params: Promise.resolve({ locale: "en" }) });

    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fen%2Ffavorites");
  });
});
