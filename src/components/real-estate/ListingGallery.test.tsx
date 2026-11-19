import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `publicEnv` is read once at import time, so a test cannot set
// NEXT_PUBLIC_SUPABASE_URL late. The storage helper is the only thing standing
// between a fixture image and a rendered <img>, so it is stubbed instead.
vi.mock("@/lib/real-estate/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/real-estate/storage")
  >("@/lib/real-estate/storage");
  return {
    ...actual,
    propertyMediaPublicUrl: (path: string) =>
      path ? `https://example.supabase.co/property-media/${path}` : null,
  };
});

import { ListingGallery } from "@/components/real-estate/ListingGallery";
import type { ListingImage } from "@/lib/real-estate/types";

/**
 * The listing gallery.
 *
 * A landlord or agent posts several photographs, and the gallery is the surface
 * that makes them visible: one main image plus a thumbnail per photo. These tests
 * pin the parts a regression would silently remove — the thumbnail strip, the
 * swap on selection, and the single-photo case that must not render a strip of
 * one.
 */
function image(id: string, position: number, alt = ""): ListingImage {
  return {
    id,
    storagePath: `listing/${id}.jpg`,
    alt,
    caption: null,
    isPrimary: position === 0,
    position,
  };
}

const THREE = [image("one", 0, "Front"), image("two", 1), image("three", 2)];

function renderGallery(images: readonly ListingImage[]) {
  return render(
    <ListingGallery
      images={images}
      ariaLabel="Property photographs"
      fallbackAlt="Property photograph"
      emptyLabel="No photographs"
    />,
  );
}

describe("ListingGallery", () => {
  it("renders a thumbnail for every uploaded photograph", () => {
    renderGallery(THREE);
    const thumbs = screen.getAllByRole("button");
    expect(thumbs).toHaveLength(3);
  });

  it("shows the first photograph as the main image", () => {
    const { container } = renderGallery(THREE);
    const main = container.querySelector("img");
    expect(main?.getAttribute("alt")).toBe("Front");
    expect(main?.getAttribute("src")).toContain("one.jpg");
  });

  it("swaps the main image when a thumbnail is chosen", () => {
    const { container } = renderGallery(THREE);
    fireEvent.click(screen.getAllByRole("button")[2]!);
    const main = container.querySelector("img");
    expect(main?.getAttribute("src")).toContain("three.jpg");
  });

  it("marks the selected thumbnail as the current one", () => {
    renderGallery(THREE);
    const thumbs = screen.getAllByRole("button");
    expect(thumbs[0]?.getAttribute("aria-current")).toBe("true");
    expect(thumbs[1]?.getAttribute("aria-current")).toBeNull();
    fireEvent.click(thumbs[1]!);
    expect(screen.getAllByRole("button")[1]?.getAttribute("aria-current")).toBe(
      "true",
    );
  });

  it("renders no thumbnail strip for a single photograph", () => {
    renderGallery([image("only", 0)]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("states plainly that a listing has no photograph rather than inventing one", () => {
    renderGallery([]);
    expect(screen.getByText("No photographs")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("falls back to the supplied alt text when an image has none", () => {
    const { container } = renderGallery([image("bare", 0)]);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      "Property photograph",
    );
  });

  it("gives the group its accessible label", () => {
    renderGallery(THREE);
    expect(
      screen.getByRole("group", { name: "Property photographs" }),
    ).toBeInTheDocument();
  });
});
