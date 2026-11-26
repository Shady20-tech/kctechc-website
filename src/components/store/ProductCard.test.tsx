import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-favorite-ids", () => ({
  useFavoriteIds: () => null,
  requestFavoriteSummary: vi.fn(),
}));

import { ProductCard } from "@/components/store/ProductCard";
import { createTranslator } from "@/lib/i18n/translator";
import type { LocalizedProduct } from "@/lib/store/types";

const t = createTranslator("en").t;

function product(overrides: Partial<LocalizedProduct> = {}): LocalizedProduct {
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
    ...overrides,
  };
}

describe("ProductCard", () => {
  it("renders one product link and an independent save button", () => {
    render(
      <ul>
        <li>
          <ProductCard product={product()} locale="en" t={t} />
        </li>
      </ul>,
    );

    expect(screen.getByRole("link", { name: /Solar kit/ })).toHaveAttribute(
      "href",
      "/en/electrical-services/store/solar/solar-kit",
    );
    expect(
      screen.getByRole("button", {
        name: t("favorites.add", { title: "Solar kit" }),
      }),
    ).toBeInTheDocument();
  });

  it("shows the saved heart when the caller supplies a favourite state", () => {
    render(
      <ul>
        <li>
          <ProductCard product={product()} locale="en" t={t} isFavorite />
        </li>
      </ul>,
    );
    expect(
      screen.getByRole("button", {
        name: t("favorites.remove", { title: "Solar kit" }),
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
