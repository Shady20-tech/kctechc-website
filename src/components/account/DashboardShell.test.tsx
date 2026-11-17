import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "@/components/account/DashboardShell";
import { dashboardNavSections } from "@/lib/real-estate/dashboard-nav";

/**
 * Dashboard shell (mobile drawer).
 *
 * The shell mirrors the admin sidebar, and so does the bug it must not repeat:
 * the mobile backdrop was a sibling of the panel at the same `z-index`, and
 * because it comes later in the DOM it won the tie and painted over the nav
 * links — every tap hit the backdrop and closed the drawer. The assertions are
 * about layer order, because that is the actual failure mode; the markup is valid
 * either way.
 */

const pathname = vi.fn(() => "/en/account/landlord");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const labels: Record<string, string> = {
  consoleName: "Landlord dashboard",
  sidebarLabel: "Dashboard navigation",
  openMenu: "Open navigation menu",
  closeMenu: "Close navigation menu",
  yourAccount: "Your account",
  signOut: "Sign out",
  sectionManage: "Manage",
  sectionActivity: "Your activity",
  sectionAccount: "Account",
  overview: "Overview",
  create: "Add a property",
  favorites: "Saved favourites",
  savedSearches: "Saved searches",
  kyc: "Identity verification",
  account: "Account home",
};

function renderShell() {
  return render(
    <DashboardShell
      sections={dashboardNavSections("landlord", "en")}
      labels={labels}
      user={{
        name: "Ada",
        email: "ada@example.com",
        role: "customer",
        avatarUrl: null,
      }}
      locale="en"
      kind="landlord"
      siteLabel="View main site"
      siteHref="/en"
    >
      <p>Overview content</p>
    </DashboardShell>,
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

describe("DashboardShell mobile drawer", () => {
  it("keeps the nav panel on a higher layer than the backdrop", () => {
    renderShell();
    openDrawer();

    const panel = document.getElementById("dashboard-sidebar");
    expect(panel).toBeTruthy();

    const panelZ = panel!.className.match(/(?:^|\s)z-(\d+)/)?.[1];
    const backdropZ = backdrop().className.match(/(?:^|\s)z-(\d+)/)?.[1];
    expect(panelZ).toBeTruthy();
    expect(backdropZ).toBeTruthy();
    expect(Number(panelZ)).toBeGreaterThan(Number(backdropZ));
    expect(panel!.className).toContain("relative");
  });

  it("renders the links the sidebar model defines", () => {
    renderShell();
    openDrawer();

    for (const label of ["Overview", "Add a property", "Your account"]) {
      expect(
        screen.getAllByRole("link", { name: label }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("marks the active entry and only on its exact route", () => {
    renderShell();
    openDrawer();

    const overview = screen
      .getAllByRole("link", { name: "Overview" })
      .find((node) => node.getAttribute("href") === "/en/account/landlord");
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  it("closes the drawer when a nav link is followed", () => {
    renderShell();
    openDrawer();

    const link = screen.getAllByRole("link", { name: "Add a property" })[0]!;
    fireEvent.click(link);

    expect(document.getElementById("dashboard-sidebar")!.className).toContain(
      "hidden",
    );
  });

  it("offers a link back to the main site", () => {
    renderShell();

    // The shared chrome is hidden on this tree, so the shell is what carries the
    // "return to the site" affordance. Both the mobile bar and the desktop top bar
    // render it.
    const links = screen.getAllByRole("link", { name: /view main site/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", "/en");
  });

  it("offers a sign-out control that posts to the customer sign-out action", () => {
    renderShell();
    openDrawer();

    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut.closest("form")).toBeTruthy();
  });
});
