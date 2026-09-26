import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { buildPrimaryNav } from "@/lib/config/navigation";
import { createTranslator } from "@/lib/i18n/translator";

// The switcher reads the current pathname to preserve the route across a
// language change. jsdom has no router, so it is stubbed to the home page.
vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
}));

function setup(locale: "en" | "fr" = "en") {
  const translator = createTranslator(locale);
  return render(
    <SiteHeader
      locale={locale}
      t={translator.t}
      navEntries={buildPrimaryNav(locale, translator.t)}
    />,
  );
}

/**
 * These assertions cover the header's alignment contract.
 *
 * jsdom does not lay anything out, so it cannot catch a 57px overflow or a
 * wrapped label. What it can do is pin the structural decisions that made those
 * failures possible, so a later edit that reintroduces them fails here rather
 * than only in a browser.
 *
 * The mobile drawer and the dropdown panel are always in the DOM (hidden with
 * CSS), so queries are scoped to the desktop bar's own list items rather than
 * sweeping the whole header.
 */
const desktopNav = (container: HTMLElement) =>
  container.querySelector("header > div > nav[aria-label]");

/**
 * The clickable top-level nav items: the anchors for plain links, and the
 * dropdown *trigger* for the Departments menu. The trigger is nested one level
 * deeper inside its `<li>` (the wrapper also holds the panel), so it is selected
 * explicitly rather than by "first child of li".
 */
const topLevelItems = (container: HTMLElement) => [
  ...(desktopNav(container)?.querySelectorAll(
    ":scope > ul > li > a, :scope > ul > li > .nav-menu-trigger",
  ) ?? []),
];

const switchers = (container: HTMLElement, locale: "en" | "fr" = "en") => {
  const label = createTranslator(locale).t("a11y.languageSwitcher");
  return [...container.querySelectorAll(`header nav[aria-label="${label}"]`)];
};

describe("SiteHeader alignment", () => {
  it("uses equal side columns so the nav is centred on the content box", () => {
    const { container } = setup();
    const row = container.querySelector("header > div");

    // `justify-between` places the nav midway between the logo and the account
    // action, so the nav drifts off the page centre by half their width
    // difference. Equal `1fr` columns are what hold it on the true centre.
    expect(row?.className).toContain("grid-cols-[1fr_auto_1fr]");
    expect(row?.className).not.toContain("justify-between");
  });

  it("keeps the header on the same container as page content", () => {
    const { container } = setup();
    const row = container.querySelector("header > div");

    // Sharing `container-page` is what makes the logo and the account action line
    // up with the content edges of the page below the bar.
    expect(row?.className).toContain("container-page");
  });

  it("stops desktop nav labels wrapping onto a second line", () => {
    const { container } = setup();
    const items = topLevelItems(container);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // A flex item shrinks below its text width and wraps unless it is told not
      // to, which is what made "About us" two lines tall and the only item with a
      // different baseline.
      expect(item.className).toContain("whitespace-nowrap");
    }
  });

  it("gives plain links and the dropdown trigger the same box model", () => {
    const { container } = setup();
    const items = topLevelItems(container);

    // An `inline` box reports a shorter rect than an `inline-flex` one, so
    // mixing the two puts the items on different baselines.
    expect(items.length).toBeGreaterThan(1);
    for (const item of items) {
      expect(item.className).toContain("inline-flex");
      expect(item.className).toContain("items-center");
    }
  });

  it("abbreviates the switcher without losing the full language name", () => {
    const { container } = setup();
    const [desktop] = switchers(container);

    if (!desktop) throw new Error("desktop language switcher not rendered");
    const labels = [...desktop.querySelectorAll("a")].map((a) => ({
      text: a.textContent,
      name: a.getAttribute("aria-label"),
    }));

    // The compact codes keep the bar inside its width budget on narrow desktop
    // widths; the accessible name stays the full language so screen readers and
    // voice control still get something meaningful.
    expect(labels).toEqual([
      { text: "EN", name: "English" },
      { text: "FR", name: "Français" },
    ]);
  });

  it("keeps the lockup from wrapping on one line", () => {
    const { container } = setup();
    const title = container.querySelector("header a[aria-label] span > span");

    // The legal name wrapped to three lines at 320px, which overflowed the 64px
    // bar and pushed the header past its own rule.
    expect(title?.className).toContain("truncate");
  });

  it("renders the same alignment structure in French", () => {
    const { container } = setup("fr");
    const row = container.querySelector("header > div");

    // French labels are the longer set, so the bar is widest here and this is the
    // locale where an overflow appears first.
    expect(row?.className).toContain("grid-cols-[1fr_auto_1fr]");
    const items = topLevelItems(container);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.className).toContain("whitespace-nowrap");
      expect(item.className).toContain("inline-flex");
    }
  });
});
