import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageUploadField } from "./ImageUploadField";

describe("ImageUploadField", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it("removes one selected image and leaves the others in the posted file list", () => {
    class FakeDataTransfer {
      files: File[] = [];
      items = {
        add: (file: File) => {
          this.files.push(file);
        },
      };
    }
    vi.stubGlobal("DataTransfer", FakeDataTransfer);

    render(
      <ImageUploadField
        name="image"
        label="Product images"
        removeLabel="Remove image"
      />,
    );

    const input = screen.getByLabelText("Product images") as HTMLInputElement;
    const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", {
      configurable: true,
      writable: true,
      value: [first, second],
    });
    fireEvent.change(input, { target: { files: [first, second] } });

    const removeButtons = screen.getAllByRole("button", {
      name: /Remove image:/i,
    });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);

    expect(screen.queryByText("first.jpg")).toBeNull();
    expect(screen.getByText("second.jpg")).toBeInTheDocument();
    expect(input.files).toHaveLength(1);
    expect(input.files?.[0]?.name).toBe("second.jpg");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first.jpg");
  });
});
