import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageUploadField } from "./ImageUploadField";

describe("ImageUploadField", () => {
  it("posts multiple image files under the requested field name", () => {
    render(
      <ImageUploadField
        name="image"
        label="Product images"
        hint="Up to 5 MB each."
        maxBytes={5 * 1024 * 1024}
      />,
    );

    const input = screen.getByLabelText("Product images");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "image");
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/avif",
    );
  });

  it("accepts a single file for a cover slot", () => {
    render(
      <ImageUploadField
        name="cover"
        label="Cover image"
        multiple={false}
        maxBytes={5 * 1024 * 1024}
      />,
    );

    const input = screen.getByLabelText("Cover image");
    expect(input).toHaveAttribute("name", "cover");
    expect(input).not.toHaveAttribute("multiple");
  });

  it("reports an oversized selection before submit", () => {
    render(
      <ImageUploadField
        name="image"
        label="Product images"
        maxBytes={10}
        tooLargeMessage="That image is too large."
      />,
    );

    const file = new File(["more than ten bytes"], "photo.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("Product images"), {
      target: { files: [file] },
    });

    expect(screen.getByText("That image is too large.")).toBeInTheDocument();
  });
});
