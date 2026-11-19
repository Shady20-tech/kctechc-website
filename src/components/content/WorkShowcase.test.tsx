import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkShowcase } from "@/components/content/WorkShowcase";
import {
  ELECTRICAL_WORK,
  ELECTRICAL_WORK_ALT_KEY,
} from "@/lib/content/electrical-work";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Completed-work showcase.
 *
 * The properties that matter are the ones a crawler and a no-JavaScript visitor
 * depend on: every photograph is in the first render with a real description, and
 * the marquee's duplicate set is hidden from assistive technology so the strip is
 * not announced twice.
 */
function setup(variant: "marquee" | "grid", locale: "en" | "fr" = "en") {
  const t = createTranslator(locale).t;
  return render(
    <WorkShowcase
      t={t}
      variant={variant}
      eyebrow={`03 — ${t("electricalProducts.work.eyebrow")}`}
      heading={t("electricalProducts.work.heading")}
      intro={t("electricalProducts.work.intro")}
      note={t("electricalProducts.work.note")}
      headingId="electrical-work-heading"
    />,
  );
}

describe("WorkShowcase", () => {
  it("renders every photograph in the grid with its description", () => {
    setup("grid");
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(ELECTRICAL_WORK.length);
    const t = createTranslator("en").t;
    for (const image of images) {
      expect(image).toHaveAttribute("alt", t(ELECTRICAL_WORK_ALT_KEY));
    }
  });

  it("renders the set twice in the marquee but hides the duplicate", () => {
    const { container } = setup("marquee");
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    // The first set carries the descriptions; the drifting copy is decorative.
    expect(lists[0]?.querySelectorAll("img")).toHaveLength(ELECTRICAL_WORK.length);
    expect(lists[1]).toHaveAttribute("aria-hidden", "true");
    for (const image of lists[1]?.querySelectorAll("img") ?? []) {
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it("shows each photograph once to assistive technology", () => {
    setup("marquee");
    // The aria-hidden copy is excluded from the accessibility tree, so a screen
    // reader and a crawler both see the eight photographs exactly once.
    expect(screen.getAllByRole("img")).toHaveLength(ELECTRICAL_WORK.length);
  });

  it("labels the section heading so the region can be named by it", () => {
    setup("grid");
    const heading = screen.getByRole("heading", {
      name: createTranslator("en").t("electricalProducts.work.heading"),
    });
    expect(heading).toHaveAttribute("id", "electrical-work-heading");
  });

  it("renders the localized heading in French", () => {
    setup("grid", "fr");
    const t = createTranslator("fr").t;
    expect(
      screen.getByRole("heading", { name: t("electricalProducts.work.heading") }),
    ).toBeInTheDocument();
  });
});
