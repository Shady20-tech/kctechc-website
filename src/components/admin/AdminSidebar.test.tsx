import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Admin sidebar (mobile drawer).
 *
 * Two bugs are pinned here:
 *
 * 1. The mobile backdrop was a sibling of the panel with the same `z-index`, and
 *    because it comes later in the DOM it won the tie and painted over the nav
 *    links. Every tap hit the backdrop, which only closed the drawer, so the nav
 *    "did nothing" on a phone while working on desktop. The assertions are about
 *    layer order, because that is the actual failure mode — the links render fine
 *    and the markup is valid either way.
 * 2. The account menu (profile / password / sign-out) lived only in the desktop
 *    header, which is `hidden lg:flex`. A signed-in phone user therefore had no way
 *    to sign out at all. It now sits in the mobile top bar, mirroring desktop.
 */

const pathname = vi.fn(() => "/admin");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const labels = {
  sidebarLabel: "Admin navigation",
  openMenu: "Open navigation menu",
  closeMenu: "Close navigation menu",
  sectionOverview: "Overview",
  dashboard: "Dashboard",
};

const sections = [
  {
    headingKey: "sectionOverview",
    items: [
      { href: "/admin", labelKey: "dashboard", iconKey: "dashboard" as const },
    ],
  },
];

function renderSidebar() {
  return render(
    <AdminSidebar
      sections={sections}
      labels={labels}
      user={{
        name: "Ada",
        email: "ada@example.com",
        role: "super_admin",
        avatarUrl: null,
      }}
      accountMenu={<Link href="/admin/profile">My profile</Link>}
    />,
  );
}

function openDrawer() {
  fireEvent.click(
    screen.getByRole("button", { name: /open navigation menu/i }),
  );
}

/** The backdrop is the fixed full-viewport layer, not the drawer's toggle. */
function backdrop(): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(
    'button[class*="inset-0"]',
  );
  if (!el) throw new Error("backdrop not found");
  return el;
}

describe("AdminSidebar mobile drawer", () => {
  it("keeps the nav panel on a higher layer than the backdrop", () => {
    renderSidebar();
    openDrawer();

    const panel = document.getElementById("admin-sidebar");
    expect(panel).toBeTruthy();

    // The panel must carry a stacking context and a higher `z-*` than the
    // backdrop, otherwise the later-in-DOM backdrop covers the links.
    const panelZ = panel!.className.match(/(?:^|\s)z-(\d+)/)?.[1];
    const backdropZ = backdrop().className.match(/(?:^|\s)z-(\d+)/)?.[1];
    expect(panelZ).toBeTruthy();
    expect(backdropZ).toBeTruthy();
    expect(Number(panelZ)).toBeGreaterThan(Number(backdropZ));
    expect(panel!.className).toContain("relative");
  });

  it("keeps the top bar (and its account menu) above the drawer and backdrop", () => {
    // The account menu opens a dropdown from the bar; if the bar sat below the
    // panel or the backdrop, the menu would be painted over and its sign-out
    // button untappable while the drawer is open.
    renderSidebar();
    openDrawer();

    const bar = document.querySelector<HTMLElement>(
      'div[class*="lg:hidden"][class*="justify-between"]',
    );
    expect(bar).toBeTruthy();
    const barZ = bar!.className.match(/(?:^|\s)z-(\d+)/)?.[1];
    expect(barZ).toBeTruthy();
    expect(Number(barZ)).toBeGreaterThan(
      Number(backdrop().className.match(/(?:^|\s)z-(\d+)/)?.[1]),
    );
  });

  it("renders the account menu in the mobile bar, not the drawer", () => {
    // The desktop header is `hidden lg:flex`, so without this a signed-in phone
    // user has no sign-out and no profile link anywhere in the console.
    renderSidebar();
    openDrawer();

    const panel = document.getElementById("admin-sidebar")!;
    expect(panel.querySelector('a[href="/admin/profile"]')).toBeNull();
    expect(
      screen.getAllByRole("link", { name: /my profile/i }).length,
    ).toBeGreaterThan(0);
  });

  it("closes the drawer when a nav link is followed", () => {
    renderSidebar();
    openDrawer();

    const link = screen.getByRole("link", { name: /dashboard/i });
    fireEvent.click(link);

    expect(document.getElementById("admin-sidebar")!.className).toContain(
      "hidden",
    );
  });
});
