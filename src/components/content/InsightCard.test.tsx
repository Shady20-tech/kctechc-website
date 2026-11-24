import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-favorite-ids", () => ({
  useFavoriteIds: () => null,
  requestFavoriteSummary: vi.fn(),
}));

// `publicEnv` is read once at import time, so a test cannot set
// NEXT_PUBLIC_SUPABASE_URL late. The helper that turns a stored object path into
// a public URL is stubbed instead — it is the only thing between a fixture cover
// and a rendered <img>, and stubbing it keeps the assertion about the card's
// behaviour rather than about the Supabase project URL.
vi.mock("@/lib/uploads/media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/uploads/media")>(
    "@/lib/uploads/media",
  );
  return {
    ...actual,
    contentMediaUrl: (path: string | null | undefined) =>
      path ? `https://example.supabase.co/content-media/${path}` : null,
  };
});

import { InsightCard } from "@/components/content/InsightCard";
import type { LocalizedInsight } from "@/lib/content/types";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en").t;

function article(overrides: Partial<LocalizedInsight> = {}): LocalizedInsight {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "land-title",
    title: "How to verify a land title",
    summary: "What to check before you pay.",
    body: "Body text.",
    relatedServiceSlugs: [],
    isFeatured: false,
    publishedAt: "2026-01-05T00:00:00.000Z",
    seo: {},
    ...overrides,
  } as LocalizedInsight;
}

describe("InsightCard", () => {
  it("renders the uploaded cover as the card image", () => {
    render(
      <InsightCard
        article={article({ coverImagePath: "insight-1/cover.jpg" })}
        locale="en"
        t={t}
      />,
    );

    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    // next/image rewrites the source to an optimizer URL with the original
    // percent-encoded in `url`, so the assertion decodes before matching.
    const src = decodeURIComponent(image?.getAttribute("src") ?? "");
    expect(src).toContain("content-media/insight-1/cover.jpg");
  });

  it("renders no media box at all when the article has no cover", () => {
    render(<InsightCard article={article()} locale="en" t={t} />);

    expect(document.querySelector("img")).toBeNull();
    // The card still links the heading, so the destination stays reachable.
    expect(
      screen.getByRole("link", { name: "How to verify a land title" }),
    ).toBeTruthy();
  });

  it("keeps the cover decorative so the heading carries the accessible name", () => {
    render(
      <InsightCard
        article={article({ coverImagePath: "insight-1/cover.jpg" })}
        locale="en"
        t={t}
      />,
    );

    const image = document.querySelector("img");
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders an independent save control for a published article", () => {
    render(<InsightCard article={article()} locale="en" t={t} />);

    expect(
      screen.getByRole("button", {
        name: t("favorites.add", { title: "How to verify a land title" }),
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
