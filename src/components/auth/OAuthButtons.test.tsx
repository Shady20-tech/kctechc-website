import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOAuthProviderAction: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({
  signInWithOAuthProviderAction: mocks.signInWithOAuthProviderAction,
}));

import { OAuthButtons } from "@/components/auth/OAuthButtons";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "google,facebook");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function providerOf(button: HTMLElement): string | undefined {
  return button
    .closest("form")
    ?.querySelector<HTMLInputElement>('input[name="provider"]')?.value;
}

describe("OAuthButtons", () => {
  it("renders Google and Facebook as server-redirect forms in two columns", () => {
    render(<OAuthButtons locale="en" disabled={false} />);

    const google = screen.getByRole("button", { name: "Google" });
    const facebook = screen.getByRole("button", { name: "Facebook" });

    expect(providerOf(google)).toBe("google");
    expect(providerOf(facebook)).toBe("facebook");

    const grid = facebook.closest("form")?.parentElement;
    expect(grid?.className).toContain("sm:grid-cols-2");
  });

  it("renders nothing when social sign-in is explicitly disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "none");

    const { container } = render(<OAuthButtons locale="en" disabled={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps both buttons visible but disabled when the form is unavailable", () => {
    render(<OAuthButtons locale="en" disabled />);

    expect(screen.getByRole("button", { name: "Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Facebook" })).toBeDisabled();
  });

  it("uses one full-width column when only Facebook is offered", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "facebook");

    render(<OAuthButtons locale="en" disabled={false} />);

    const facebook = screen.getByRole("button", { name: "Facebook" });
    expect(providerOf(facebook)).toBe("facebook");
    expect(screen.queryByRole("button", { name: "Google" })).toBeNull();

    const grid = facebook.closest("form")?.parentElement;
    expect(grid?.className).toContain("sm:grid-cols-1");
  });

  it("uses one full-width column when only Google is offered", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "google");

    render(<OAuthButtons locale="en" disabled={false} />);

    const google = screen.getByRole("button", { name: "Google" });
    expect(providerOf(google)).toBe("google");
    expect(screen.queryByRole("button", { name: "Facebook" })).toBeNull();

    const grid = google.closest("form")?.parentElement;
    expect(grid?.className).toContain("sm:grid-cols-1");
  });
});
