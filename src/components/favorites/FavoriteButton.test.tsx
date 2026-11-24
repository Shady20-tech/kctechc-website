import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  push,
  refresh,
  requestFavoriteSummary,
  favoriteIds,
  toggleFavoriteAction,
} = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  requestFavoriteSummary: vi.fn(),
  favoriteIds: { current: null as ReadonlySet<string> | null },
  toggleFavoriteAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/hooks/use-favorite-ids", () => ({
  useFavoriteIds: () => favoriteIds.current,
  requestFavoriteSummary,
}));

vi.mock("@/lib/favorites/actions", () => ({ toggleFavoriteAction }));

import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en").t;

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  requestFavoriteSummary.mockReset();
  toggleFavoriteAction.mockReset();
  favoriteIds.current = null;
});

describe("FavoriteButton", () => {
  it("fills the heart after a successful toggle", async () => {
    toggleFavoriteAction.mockResolvedValue({ status: "ok", saved: true });
    render(
      <FavoriteButton
        locale="en"
        entityType="product"
        entityId="product-1"
        returnPath="/en/electrical-services/store/solar/solar-kit"
        title="Solar kit"
      />,
    );

    const button = screen.getByRole("button", {
      name: t("favorites.add", { title: "Solar kit" }),
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.submit(button.closest("form")!);

    await waitFor(() =>
      expect(toggleFavoriteAction).toHaveBeenCalledWith("product", "product-1"),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: t("favorites.remove", { title: "Solar kit" }),
        }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(requestFavoriteSummary).toHaveBeenCalledWith(true);
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the saved state supplied by the server", () => {
    render(
      <FavoriteButton
        locale="en"
        entityType="listing"
        entityId="listing-1"
        defaultSaved
        returnPath="/en/real-estate/listings/listing-1"
        title="Villa"
      />,
    );
    expect(
      screen.getByRole("button", {
        name: t("favorites.remove", { title: "Villa" }),
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("uses the browser summary when no server default is supplied", () => {
    favoriteIds.current = new Set(["product-1"]);
    render(
      <FavoriteButton
        locale="en"
        entityType="product"
        entityId="product-1"
        returnPath="/en/electrical-services/store/solar/solar-kit"
        title="Solar kit"
      />,
    );
    expect(
      screen.getByRole("button", {
        name: t("favorites.remove", { title: "Solar kit" }),
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sends a signed-out visitor to sign in with the current page", async () => {
    toggleFavoriteAction.mockResolvedValue({ status: "unauthenticated" });
    render(
      <FavoriteButton
        locale="en"
        entityType="insight"
        entityId="insight-1"
        returnPath="/en/insights/article"
        title="Article"
      />,
    );

    fireEvent.submit(
      screen
        .getByRole("button", {
          name: t("favorites.add", { title: "Article" }),
        })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/login?next=%2Fen%2Finsights%2Farticle",
      ),
    );
  });

  it("rolls back and announces a failure", async () => {
    toggleFavoriteAction.mockResolvedValue({ status: "error" });
    render(
      <FavoriteButton
        locale="en"
        entityType="product"
        entityId="product-1"
        returnPath="/en/electrical-services/store/solar/solar-kit"
        title="Solar kit"
      />,
    );

    fireEvent.submit(
      screen
        .getByRole("button", {
          name: t("favorites.add", { title: "Solar kit" }),
        })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        t("favorites.errors.error"),
      ),
    );
    expect(
      screen.getByRole("button", {
        name: t("favorites.add", { title: "Solar kit" }),
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
