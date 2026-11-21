import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DepartmentShowcase } from "@/components/content/DepartmentShowcase";
import { buildShowcasePanels } from "@/lib/content/department-showcase";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Department services showcase.
 *
 * Two properties matter here and neither is visible in a screenshot.
 *
 * The first is crawlability: every panel is in the DOM on first render, so a
 * crawler and a no-JavaScript visitor read all three catalogues. The inactive
 * ones are hidden with the `hidden` attribute rather than being unmounted or
 * hidden with CSS, because `hidden` is what removes them from the accessibility
 * tree. A regression to `display:none` in a class would leave the tab set
 * reading three departments' contents as one.
 *
 * The second is that the tab set is a real one: roving `tabIndex`, arrow-key
 * navigation and `aria-controls` pointing at a panel that exists. Without the
 * arrow keys it is three adjacent buttons, which is what the WAI-ARIA authoring
 * practice exists to avoid.
 */
function setup(locale: "en" | "fr" = "en") {
  const { t } = createTranslator(locale);
  const panels = buildShowcasePanels(locale);
  return render(
    <DepartmentShowcase
      panels={panels}
      eyebrow={t("home.showcase.eyebrow")}
      heading={t("home.showcase.heading")}
      headingId="showcase-heading"
      intro={t("home.showcase.intro")}
      tabsLabel={t("home.showcase.tabsLabel")}
    />,
  );
}

describe("DepartmentShowcase", () => {
  it("renders every panel in the DOM on first render", () => {
    setup();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    // All three panels exist, not just the active one — this is what keeps the
    // catalogues crawlable without running any script.
    for (const tab of tabs) {
      const panelId = tab.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId!)).not.toBeNull();
    }
  });

  it("hides inactive panels with the hidden attribute, not a CSS class", () => {
    setup();
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(3);
    const hidden = panels.filter((panel) => panel.hasAttribute("hidden"));
    expect(hidden).toHaveLength(2);
    for (const panel of hidden) {
      // `hidden` is the presentation state assistive technology honours; a
      // class-based hide would leave the panel in the accessibility tree.
      expect(panel.className).not.toContain("hidden");
    }
  });

  it("selects the first tab and exposes exactly one tab stop", () => {
    setup();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("scopes each panel to its own department accent", () => {
    setup();
    // A panel without `data-department` silently renders in corporate teal.
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const scopes = panels.map((panel) => panel.getAttribute("data-department"));
    expect(scopes).toEqual([
      "digital-marketing",
      "electrical-services",
      "real-estate",
    ]);
  });

  it("switches panels on click and on the arrow keys", () => {
    setup();
    const tabs = screen.getAllByRole("tab");

    fireEvent.click(tabs[1]!);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(tabs[1]!, { key: "ArrowRight" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");

    // The end of the list wraps rather than dead-ending.
    fireEvent.keyDown(tabs[2]!, { key: "ArrowRight" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs[0]!, { key: "End" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("links each item to a real destination", () => {
    setup();
    const firstPanel = screen.getAllByRole("tabpanel", { hidden: true })[0]!;
    const links = Array.from(firstPanel.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      // Locale-prefixed, so a language switch lands on the same page.
      expect(href).toMatch(/^\/(en|fr)\//);
    }
  });

  it("localizes the panels for French", () => {
    setup("fr");
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.textContent).not.toBe("");
    const firstPanel = screen.getAllByRole("tabpanel", { hidden: true })[0]!;
    expect(firstPanel.querySelectorAll("a").length).toBeGreaterThan(0);
  });
});
