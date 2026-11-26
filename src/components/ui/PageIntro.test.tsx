import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageIntro } from "./PageIntro";

describe("PageIntro", () => {
  it("renders a back link to the parent list when one is supplied", () => {
    render(
      <PageIntro
        heading="HP Laptop"
        back={{ href: "/admin/store", label: "Back to Store & Products" }}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Back to Store & Products",
    });
    expect(link).toHaveAttribute("href", "/admin/store");
    expect(screen.getByRole("heading", { name: "HP Laptop" })).toBeVisible();
  });

  it("renders no back link when the page is a top-level destination", () => {
    render(<PageIntro heading="Store & Products" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
