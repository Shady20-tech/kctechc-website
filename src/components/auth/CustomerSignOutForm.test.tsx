import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";

/**
 * The customer sign-out control.
 *
 * It used to render as an underlined text button, which read as one more link
 * beside a page of cards rather than an action. The assertion is about that
 * property: the control carries a button treatment (a border or a fill, a control
 * radius) and no underline.
 */
describe("CustomerSignOutForm", () => {
  it("renders a submit button that posts the locale", () => {
    render(<CustomerSignOutForm locale="fr" label="Se déconnecter" />);

    const button = screen.getByRole("button", { name: "Se déconnecter" });
    expect(button).toHaveAttribute("type", "submit");

    const form = button.closest("form");
    expect(form).toBeTruthy();
    expect(form!.querySelector('input[name="locale"]')).toHaveValue("fr");
  });

  it("looks like a button, not a text link", () => {
    render(<CustomerSignOutForm locale="en" label="Sign out" />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.className).not.toContain("underline");
    expect(button.className).toContain("rounded-control");
    expect(button.className).toMatch(/border|bg-/);
  });
});
