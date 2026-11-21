import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteUserForm } from "@/components/admin/DeleteUserForm";

/**
 * The console's delete control.
 *
 * Two behaviours matter and neither is visual: the control must be *collapsed*
 * (a live delete button beside a role picker is a mis-click waiting to happen),
 * and it must not offer self-deletion, because the console is not the place to
 * remove the person holding it. Both are asserted from the rendered output.
 */

// The form imports a Server Action; the module is mocked so this stays a render
// test rather than a network one.
vi.mock("@/lib/admin/delete-user-actions", () => ({
  deleteUserAccountAction: vi.fn(),
}));

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

describe("DeleteUserForm", () => {
  it("renders the form collapsed behind a disclosure", () => {
    const { container } = render(
      <DeleteUserForm
        profileId={PROFILE_ID}
        displayName="Ada N."
        isSelf={false}
        locale="en"
      />,
    );

    // A `<details>` keeps the destructive control closed until it is asked for.
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.hasAttribute("open")).toBe(false);

    // The reason field is not in the tab order until the disclosure opens.
    expect(screen.getByLabelText(/reason/i)).toBeDefined();
  });

  it("names the account it is about to delete", () => {
    render(
      <DeleteUserForm
        profileId={PROFILE_ID}
        displayName="Ada N."
        isSelf={false}
        locale="en"
      />,
    );
    expect(screen.getByText(/Ada N\./)).toBeDefined();
  });

  it("carries the target id in a hidden field, not in a visible input", () => {
    const { container } = render(
      <DeleteUserForm
        profileId={PROFILE_ID}
        displayName="Ada N."
        isSelf={false}
        locale="en"
      />,
    );
    const hidden = container.querySelector('input[name="profileId"]');
    expect(hidden?.getAttribute("type")).toBe("hidden");
    expect(hidden?.getAttribute("value")).toBe(PROFILE_ID);
  });

  it("offers no delete control for the signed-in account", () => {
    // The action also refuses this, but the control should not invite it.
    const { container } = render(
      <DeleteUserForm
        profileId={PROFILE_ID}
        displayName="Me"
        isSelf
        locale="en"
      />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(screen.getByText(/cannot delete your own account/i)).toBeDefined();
  });

  it("renders in French when asked", () => {
    render(
      <DeleteUserForm
        profileId={PROFILE_ID}
        displayName="Ada N."
        isSelf={false}
        locale="fr"
      />,
    );
    // The disclosure label is the giveaway that the locale was honoured.
    expect(screen.getByText("Supprimer le compte")).toBeDefined();
  });
});
