import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The article page reads its record from the database. Stubbing the loader is
// what lets this test assert the page's own behaviour — that an uploaded cover
// becomes the hero — without a live Supabase instance.
vi.mock("@/lib/content/loaders", () => ({
  loadInsight: vi.fn(),
  loadServices: vi.fn(async () => []),
}));

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

import { loadInsight } from "@/lib/content/loaders";
import InsightArticlePage from "@/app/(site)/[locale]/insights/[slug]/page";

function article(coverImagePath?: string) {
  return {
    slug: "land-title",
    title: "How to verify a land title",
    summary: "What to check before you pay.",
    body: "Body text.",
    relatedServiceSlugs: [],
    isFeatured: false,
    publishedAt: "2026-01-05T00:00:00.000Z",
    seo: {},
    coverImagePath,
  };
}

async function renderPage(coverImagePath?: string) {
  vi.mocked(loadInsight).mockResolvedValue(article(coverImagePath) as never);
  const ui = await InsightArticlePage({
    params: Promise.resolve({ locale: "en", slug: "land-title" }),
  });
  return render(ui);
}

describe("insight article hero", () => {
  it("uses the uploaded cover as the hero image", async () => {
    await renderPage("insight-1/cover.jpg");

    const hero = document.querySelector("section.on-ink");
    expect(hero).not.toBeNull();

    const image = hero?.querySelector("img");
    expect(image).not.toBeNull();
    const src = decodeURIComponent(image?.getAttribute("src") ?? "");
    expect(src).toContain("content-media/insight-1/cover.jpg");
  });

  it("keeps the ink band and renders no photo when there is no cover", async () => {
    await renderPage(undefined);

    const hero = document.querySelector("section.on-ink");
    expect(hero).not.toBeNull();
    expect(hero?.querySelector("img")).toBeNull();
  });

  it("keeps the cover decorative and the heading as the accessible name", async () => {
    await renderPage("insight-1/cover.jpg");

    const image = document.querySelector("section.on-ink img");
    expect(image?.getAttribute("alt")).toBe("");
    expect(document.querySelector("section.on-ink h1")?.textContent).toContain(
      "How to verify a land title",
    );
  });
});
