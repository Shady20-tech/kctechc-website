import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "@/components/layout/Logo";
import { SITE } from "@/lib/config/site";

/**
 * Corporate lockup.
 *
 * The lockup is on every page, so a broken accessible name reaches the whole
 * site. The invariant worth pinning is the one Lighthouse enforces: the accessible
 * name must contain every visible run of text inside the link, or a speech-input
 * user cannot refer to the control by what they can see.
 *
 * The name is deliberately derived from the content rather than an `aria-label`.
 * The title renders `shortName` below `sm` and `legalName` at `sm` and up, and an
 * explicit label can only match one of them — the DOM carries both, so the audit
 * sees the mismatch regardless of the painted layout. Deriving the name from the
 * content is what makes every visible variant a substring of it.
 */

/**
 * The visible text runs inside the lockup, as the accessibility rules see them.
 * Leaf spans only: a wrapper's `textContent` is the concatenation of its children,
 * and the mobile and desktop title variants never appear together, so a container
 * would assert against a string no user ever sees.
 */
function visibleText(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("span"))
    .filter((node) => node.querySelector("span") === null)
    .map((node) => node.textContent?.trim() ?? "")
    .filter((text) => text.length > 0);
}

describe("Logo", () => {
  it("has no aria-label, so the name comes from the content", () => {
    render(<Logo locale="en" />);
    // This is the fix, not an accident. An `aria-label` here reintroduces the
    // label-content-name-mismatch failure, because it cannot contain both
    // breakpoint variants at once.
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-label");
  });

  it("contains every visible string in the computed name", () => {
    const { container } = render(<Logo locale="en" />);
    const name = screen.getByRole("link").textContent ?? "";

    for (const text of visibleText(container)) {
      expect(name).toContain(text);
    }
  });

  it("states both title variants and the locale", () => {
    render(<Logo locale="en" />);
    const link = screen.getByRole("link");

    expect(link).toHaveTextContent(SITE.legalName);
    expect(link).toHaveTextContent(SITE.shortName);
    expect(link).toHaveTextContent("EN");
  });

  it("omits the subtitle when showMotto is false", () => {
    // The footer sets this: the lockup sits above the motto already, so a
    // repeated `KC TECHNOLOGY · EN` line would be noise.
    const { container } = render(<Logo locale="en" showMotto={false} />);

    expect(container.textContent).not.toContain("· EN");
    expect(screen.getByRole("link")).not.toHaveTextContent("·");
  });

  it("still satisfies the name invariant with the subtitle hidden", () => {
    const { container } = render(<Logo locale="fr" showMotto={false} />);
    const name = screen.getByRole("link").textContent ?? "";
    for (const text of visibleText(container)) {
      expect(name).toContain(text);
    }
  });

  it("keeps the brand mark out of the accessibility tree", () => {
    render(<Logo locale="en" />);
    // alt="" plus aria-hidden on the wrapper: the lockup announces once, as text.
    const image = document.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image?.closest("span")).toHaveAttribute("aria-hidden", "true");
  });
});
