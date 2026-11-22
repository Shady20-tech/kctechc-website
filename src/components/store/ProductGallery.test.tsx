import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `publicEnv` is read once at import time, so a test cannot set
// NEXT_PUBLIC_SUPABASE_URL late. The storage helper is the only thing standing
// between a fixture image and a rendered <img>, so it is stubbed instead.
vi.mock("@/lib/store/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/store/storage")>(
    "@/lib/store/storage",
  );
  return {
    ...actual,
    productImageSrc: (image: { storagePath?: string | null }) =>
      image.storagePath
        ? `https://example.supabase.co/product-media/${image.storagePath}`
        : null,
  };
});

import { ProductGallery } from "@/components/store/ProductGallery";
import type { ProductImage } from "@/lib/store/types";

/**
 * The product gallery.
 *
 * An editor uploads several photographs of one product and the storefront must
 * let a shopper look at all of them. The gallery previously rendered the
 * thumbnails but never swapped the main image, so every photograph past the
 * first was unreachable — the upload was accepted and had no visible effect.
 * These tests pin the swap and the single-image case that must not render a
 * strip of one.
 */
function image(id: string, position: number, alt = ""): ProductImage {
  return {
    id,
    storagePath: `products/${id}.jpg`,
    alt,
    isPrimary: position === 0,
    position,
  };
}

const THREE = [image("one", 0, "Front"), image("two", 1), image("three", 2)];

function renderGallery(images: readonly ProductImage[]) {
  return render(
    <ProductGallery
      images={images}
      ariaLabel="Product photographs"
      locale="en"
    />,
  );
}

describe("ProductGallery", () => {
  it("renders a thumbnail for every uploaded photograph", () => {
    renderGallery(THREE);
    expect(screen.getAllByRole("button")).toHaveLength(3);
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

  it("orders by position rather than array order", () => {
    const { container } = renderGallery([THREE[2]!, THREE[0]!, THREE[1]!]);
    const main = container.querySelector("img");
    expect(main?.getAttribute("src")).toContain("one.jpg");
  });

  it("renders no thumbnail strip for a single photograph", () => {
    renderGallery([image("only", 0)]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a labelled placeholder when nothing resolves", () => {
    render(
      <ProductGallery images={[]} ariaLabel="No photographs" locale="en" />,
    );
    expect(screen.getByText("No photographs")).toBeTruthy();
  });
});
