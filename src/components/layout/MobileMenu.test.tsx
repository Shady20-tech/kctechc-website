import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { buildPrimaryNav } from "@/lib/config/navigation";
import { createTranslator } from "@/lib/i18n/translator";

// The drawer builds language links from the current path so a switch keeps the
// visitor on the page. jsdom has no router, so the path is stubbed to a nested
// route — the home page would pass even if the helper silently reset to "/".
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/electrical-services",
}));

function setup(locale: "en" | "fr" = "en") {
  const t = createTranslator(locale).t;
  return render(
    <MobileMenu
      locale={locale}
      entries={buildPrimaryNav(locale, t)}
      signInHref="/admin/login"
      labels={{
        menuLabel: t("common.menu"),
        close: t("actions.closeMenu"),
        title: t("common.menu"),
        language: t("common.language"),
        signIn: t("actions.signIn"),
        brand: t("common.brandShort"),
        brandSubtitle: `${t("common.brandShort")} · ${locale.toUpperCase()}`,
      }}
    />,
  );
}

const trigger = () => screen.getByRole("button", { name: "Menu" });

describe("MobileMenu", () => {
  it("closes initially and exposes its state on the trigger", () => {
    setup();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("takes its accessible name from the visible label", () => {
    setup();
    // The word on screen is the accessible name. An `aria-label` that differed
    // from the visible text would break voice control ("click Menu").
    expect(trigger()).toHaveTextContent("Menu");
    expect(trigger()).not.toHaveAttribute("aria-label");
  });

  it("no longer exposes the old 'Mobile navigation' phrasing", () => {
    setup();
    expect(screen.queryByText("Mobile navigation")).not.toBeInTheDocument();
  });

  it("opens a drawer with the nav entries as real links", () => {
    setup();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Home", "About us", "Services", "Gallery", "Contact"]) {
      expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  // This was a full-screen sheet in practice. `w-[min(22rem,92vw)]` is 345px at
  // a 375px viewport — 92% of the screen — so almost nothing of the page stayed
  // visible and the drawer read as a takeover. Pinning the real numbers keeps it
  // from silently drifting back, and a pure viewport-relative width would fail
  // the desktop-width case below just as badly as a fixed 22rem fails the phone.
  it("sizes the drawer to leave the page visible beside it", () => {
    setup();
    fireEvent.click(trigger());

    const layer = screen.getByRole("dialog").parentElement!;
    const panel = layer.lastElementChild! as HTMLElement;
    const [, maxRem, maxVw] = panel.className.match(
      /w-\[min\(([\d.]+)rem,([\d.]+)vw\)\]/,
    )!;

    // Mirrors the CSS `min()`: the panel is the smaller of the two terms. The
    // viewport term only wins below ~366px, so the panel is a flat 300px on
    // most phones and a proportional 82% on the narrowest ones.
    const width = (vw: number) => Math.min(Number(maxRem) * 16, (Number(maxVw) / 100) * vw);

    expect(Number(maxRem) * 16).toBe(300); // the requested width
    expect(width(375)).toBe(300);
    expect(width(1440)).toBe(300); // and it does not grow with the viewport
    expect(width(360)).toBeCloseTo(295.2, 1); // cap binds on small screens

    for (const vw of [320, 360, 375, 390, 414]) {
      expect(width(vw), `${vw}px: drawer too wide`).toBeLessThanOrEqual(vw * 0.85);
      // The page has to stay identifiable behind the drawer, not just be
      // technically uncovered.
      expect(vw - width(vw), `${vw}px: nothing left visible`).toBeGreaterThanOrEqual(54);
    }

    // A drawer needs its own height; a bottom sheet would need `auto`.
    expect(panel.className).toContain("h-full");
  });

  // The drawer renders from inside the sticky header, which carries
  // `backdrop-blur`. A `backdrop-filter` ancestor becomes the containing block
  // for `position: fixed` descendants, so the panel's `inset-0` resolved against
  // the header instead of the viewport and the drawer collapsed to the height of
  // the header row. It is portalled to `document.body` to escape that ancestor.
  it("renders outside the header so fixed positioning is not trapped", () => {
    const t = createTranslator("en").t;
    const { container } = render(
      <div className="backdrop-blur">
        <MobileMenu
          locale="en"
          entries={buildPrimaryNav("en", t)}
          signInHref="/admin/login"
          labels={{
            menuLabel: t("common.menu"),
            close: t("actions.closeMenu"),
            title: t("common.menu"),
            language: t("common.language"),
            signIn: t("actions.signIn"),
            brand: t("common.brandShort"),
            brandSubtitle: `${t("common.brandShort")} · EN`,
          }}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const dialog = screen.getByRole("dialog");
    // The panel must not be inside the blur wrapper, and must live on `body`.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog.closest(".backdrop-blur")).toBeNull();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("lists every department as a link, grouped under one heading", () => {
    setup();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Departments" }),
    ).toBeInTheDocument();
    // The label and the destination have to agree; asserting both pins the icon
    // lookup too, which derives the department from the href's last segment.
    const expected = [
      ["Digital Marketing", "/en/digital-marketing"],
      ["Electrical Services", "/en/electrical-services"],
      ["Real Estate", "/en/real-estate"],
    ] as const;
    for (const [label, href] of expected) {
      expect(within(dialog).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("keeps the current route when switching language", () => {
    setup();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    const french = within(dialog).getByRole("link", { name: "Français" });
    // Preserving the path is the point of using `buildLocaleSwitchHref`; a plain
    // `/${locale}` link would send the visitor home instead.
    expect(french).toHaveAttribute("href", "/fr/electrical-services");
    expect(within(dialog).getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("offers the account action", () => {
    setup();
    fireEvent.click(trigger());
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/admin/login");
  });

  it("closes on Escape", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from its own close control", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels every link in French for a French visitor", () => {
    setup("fr");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      "/fr",
    );
    expect(within(dialog).getByRole("link", { name: "Se connecter" })).toBeInTheDocument();
  });
});
