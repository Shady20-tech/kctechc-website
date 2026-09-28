import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalDocumentBody } from "@/components/content/LegalDocumentBody";
import { legalDocumentFor } from "@/lib/content/legal";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Legal page rendering.
 *
 * Two properties matter beyond "it renders": the clause anchors present in the
 * HTML (so deep links and the contents list resolve to a real element rather than
 * scrolling nowhere), and the state of the rendered prose. The hidden animation
 * state is applied by client code, never by the server markup, so a plain render
 * must contain the clauses at full opacity — no `data-reveal`, no `hidden`.
 */
function setup(key: "terms" | "privacy", locale: "en" | "fr") {
  const t = createTranslator(locale).t;
  const document = legalDocumentFor(key, locale);
  return render(
    <LegalDocumentBody
      document={document}
      contentsLabel={t("legal.contentsHeading")}
      updatedLabel={t("legal.updatedLabel")}
      retentionNoteLabel={t("legal.retentionNoteLabel")}
      breadcrumbAriaLabel={t("a11y.breadcrumb")}
      breadcrumbs={[
        { name: t("nav.home"), href: `/${locale}` },
        { name: t("footer." + key), href: `/${locale}/${key}` },
      ]}
    />,
  );
}

describe("LegalDocumentBody", () => {
  for (const locale of ["en", "fr"] as const) {
    for (const key of ["terms", "privacy"] as const) {
      it(`renders ${key} for ${locale} with a working contents list`, () => {
        setup(key, locale);
        const legal = legalDocumentFor(key, locale);

        for (const section of legal.sections) {
          // The heading is the visible label; the section is the anchor target.
          const heading = screen.getByRole("heading", {
            name: section.heading,
            level: 2,
          });
          expect(heading).toBeInTheDocument();

          const sectionElement = heading.closest("section");
          expect(sectionElement).toHaveAttribute("id", section.id);

          // The contents list must point at an id that exists, or the link
          // scrolls nowhere.
          const contentsLink = screen
            .getAllByRole("link", { name: section.heading })
            .find((node) => node.getAttribute("href") === `#${section.id}`);
          expect(contentsLink).toBeDefined();
        }
      });
    }
  }

  it("publishes every clause in the server markup, unanimated", () => {
    const { container } = setup("privacy", "en");
    const document = legalDocumentFor("privacy", "en");

    // No element may be carrying the reveal state in the initial render, or a
    // crawler would read an offset block as the page's content.
    expect(container.querySelector("[data-reveal]")).toBeNull();
    expect(container.querySelector("[hidden]")).toBeNull();

    const text = container.textContent ?? "";
    for (const section of document.sections) {
      expect(text).toContain(section.heading);
    }
  });

  it("shows the last-updated date as a machine-readable time element", () => {
    const { container } = setup("terms", "en");
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("datetime", "2026-09-24");
  });

  it("renders the internal privacy link from the terms as an anchor", () => {
    setup("terms", "en");
    // `richText` only turns http(s) and site-relative targets into anchors, so a
    // mistake in the bracketed link syntax would silently render as prose.
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/en/privacy");
  });

  it("flags the retention caveat only on the privacy notice", () => {
    setup("privacy", "en");
    expect(
      screen.getByRole("heading", { name: "How long we keep it" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/internal commitments/)).toBeInTheDocument();
  });
});
