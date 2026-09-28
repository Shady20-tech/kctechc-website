import { render, screen } from "@testing-library/react";
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
