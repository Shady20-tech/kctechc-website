import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignUpForm } from "@/components/auth/SignUpForm";

/**
 * The sign-up privacy acknowledgement.
 *
 * The checkbox is only meaningful if the notice it acknowledges is reachable, so
 * the link target is asserted directly. It previously pointed at `#privacy` on the
 * contact page because no privacy route existed; with the policy published, the
 * acknowledgement must lead to the policy itself.
 */
describe("SignUpForm privacy link", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`links the privacy acknowledgement to the policy for ${locale}`, () => {
      render(<SignUpForm locale={locale} disabled={false} />);

      const link = screen
        .getAllByRole("link")
        .find((node) => node.getAttribute("href")?.includes("privacy"));

      expect(link).toBeDefined();
      expect(link).toHaveAttribute("href", `/${locale}/privacy`);
      expect(link!.getAttribute("href")).not.toContain("#");
      expect(link!.getAttribute("href")).not.toContain("contact");
    });
  }

  it("keeps the acknowledgement checkbox required", () => {
    render(<SignUpForm locale="en" disabled={false} />);
    // `required` is what the browser enforces; the server re-validates the same
    // condition, so the two cannot disagree about a missing acknowledgement.
    expect(screen.getByRole("checkbox")).toBeRequired();
  });
});

/**
 * The role and residency questions are dropdowns, not radio groups.
 *
 * Both are single required choices, so a select keeps the form short and stays
 * touch-friendly on a phone. The assertions pin the shape the Server Action
 * depends on: the option `value`s are the exact strings `signUpSchema` accepts
 * (`ACCOUNT_TYPES`, and the `"true"`/`"false"` pair), so a future edit to the
 * option list cannot silently submit a value the schema refuses.
 */
describe("SignUpForm role and residency dropdowns", () => {
  it("offers the account types as a required select", () => {
    render(<SignUpForm locale="en" disabled={false} />);

    const role = screen.getByRole("combobox", {
      name: /signing up as/i,
    }) as HTMLSelectElement;

    expect(role).toBeRequired();
    expect(Array.from(role.options).map((option) => option.value)).toEqual([
      "buyer",
      "landlord",
      "agent",
    ]);
    expect(role.value).toBe("buyer");
  });

  it("offers residency as a required select with an unanswered default", () => {
    render(<SignUpForm locale="en" disabled={false} />);

    const residency = screen.getByRole("combobox", {
      name: /permanent resident/i,
    }) as HTMLSelectElement;

    expect(residency).toBeRequired();
    // The blank option is the initial state, so a visitor who never answers
    // submits nothing rather than a fabricated "yes".
    expect(residency.value).toBe("");
    expect(Array.from(residency.options).map((option) => option.value)).toEqual([
      "",
      "true",
      "false",
    ]);
  });

  it("renders no radio controls", () => {
    render(<SignUpForm locale="en" disabled={false} />);
    expect(screen.queryAllByRole("radio")).toEqual([]);
  });

  it("switches the age hint when a capability role is chosen", () => {
    render(<SignUpForm locale="en" disabled={false} />);
    const role = screen.getByRole("combobox", { name: /signing up as/i });

    // Buyer is the default, so the age rule does not apply yet.
    expect(screen.getByText(/keep your account details accurate/i)).toBeDefined();
    expect(screen.queryByText(/18 or older/i)).toBeNull();

    fireEvent.change(role, { target: { value: "landlord" } });

    // The adult hint replaces the buyer hint, which proves the select is still
    // controlled and the hint follows the selection.
    expect(screen.getByText(/18 or older/i)).toBeDefined();
    expect(screen.queryByText(/keep your account details accurate/i)).toBeNull();
  });
});
