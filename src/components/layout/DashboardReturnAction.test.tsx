import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public header's return-to-dashboard control.
 *
 * The header is statically rendered and cannot read the session, so this island
 * asks `/api/account/summary` whether the caller has a dashboard. These
 * assertions pin the three behaviours that make that safe:
 *
 *   - nothing renders for a customer with no dashboard (the requirement: only
 *     dashboard users get the control),
 *   - a console role gets the console link, and
 *   - a landlord capability gets the localized dashboard link with a translated
 *     label.
 *
 * The store is module-level, so each test re-imports the modules after
 * `resetModules` to start from a clean store.
 */

const pathname = vi.fn(() => "/en");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  pathname.mockReturnValue("/en");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A signed-in account summary with no dashboard. */
function signedIn(dashboard: unknown = null) {
  return {
    signedIn: true,
    accountHref: "/en/account",
    name: "A Customer",
    avatarUrl: null,
    dashboard,
  };
}

async function renderAction(compact = false) {
  const { DashboardReturnAction } =
    await import("@/components/layout/DashboardReturnAction");
  return render(<DashboardReturnAction locale="en" compact={compact} />);
}

describe("DashboardReturnAction", () => {
  it("renders nothing for an account with no dashboard", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signedIn(null),
    });
    await renderAction();

    // Give the fetch a chance to resolve, then assert absence.
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing before the answer arrives (no hydration mismatch)", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await renderAction();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links a console role to the admin console", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        signedIn({
          href: "/admin",
          labelKey: "account.dashboards.returnToConsole",
        }),
    });
    await renderAction();

    const link = await screen.findByRole("link", { name: "Admin console" });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("links a landlord capability to the localized dashboard", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        signedIn({
          href: "/en/account/landlord",
          labelKey: "account.dashboards.landlord.title",
        }),
    });
    await renderAction();

    const link = await screen.findByRole("link", {
      name: "Landlord dashboard",
    });
    expect(link).toHaveAttribute("href", "/en/account/landlord");
  });

  it("keeps the label in the accessible name when compact", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        signedIn({
          href: "/en/account/agent",
          labelKey: "account.dashboards.agent.title",
        }),
    });
    await renderAction(true);

    // Compact hides the visible label, so the name comes from `aria-label`.
    const link = await screen.findByRole("link", { name: "Agent dashboard" });
    expect(link).toHaveTextContent("");
  });

  it("translates the label for a French visitor", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        signedIn({
          href: "/fr/account/landlord",
          labelKey: "account.dashboards.landlord.title",
        }),
    });
    const { DashboardReturnAction } =
      await import("@/components/layout/DashboardReturnAction");
    render(<DashboardReturnAction locale="fr" />);

    expect(
      await screen.findByRole("link", { name: "Tableau de bord propriétaire" }),
    ).toBeInTheDocument();
  });
});
