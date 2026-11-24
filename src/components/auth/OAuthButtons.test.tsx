import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInWithIdToken: vi.fn(),
  completeOAuthSignInAction: vi.fn(),
  signInWithOAuthProviderAction: vi.fn(),
  script: { src: null as string | null },
  env: { publicEnv: { googleClientId: "test-client-id" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => {
    mocks.script.src = src;
    return null;
  },
}));

vi.mock("@/lib/config/env", () => mocks.env);

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithIdToken: mocks.signInWithIdToken },
  }),
}));

vi.mock("@/lib/auth/actions", () => ({
  completeOAuthSignInAction: mocks.completeOAuthSignInAction,
  signInWithOAuthProviderAction: mocks.signInWithOAuthProviderAction,
}));

import { OAuthButtons } from "@/components/auth/OAuthButtons";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.publicEnv.googleClientId = "test-client-id";
  mocks.script.src = null;
  vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "google,facebook");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OAuthButtons", () => {
  it("renders the GIS Google button and the Facebook form in two columns", () => {
    render(<OAuthButtons locale="en" disabled={false} />);

    const facebook = screen.getByRole("button", { name: "Facebook" });
    expect(facebook).toBeInTheDocument();
    expect(mocks.script.src).toBe("https://accounts.google.com/gsi/client");

    const grid = facebook.closest("form")?.parentElement;
    expect(grid?.className).toContain("sm:grid-cols-2");

    const provider = facebook
      .closest("form")
      ?.querySelector<HTMLInputElement>('input[name="provider"]');
    expect(provider?.value).toBe("facebook");
  });

  it("renders nothing when social sign-in is explicitly disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "none");

    const { container } = render(<OAuthButtons locale="en" disabled={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(mocks.script.src).toBeNull();
  });

  it("warns instead of silently dropping Google when its client id is missing", () => {
    mocks.env.publicEnv.googleClientId = "";
    render(<OAuthButtons locale="en" disabled={false} />);

    expect(
      screen.getByText(/Google sign-in is not configured/),
    ).toBeInTheDocument();
    expect(mocks.script.src).toBeNull();
    expect(
      screen.getByRole("button", { name: "Facebook" }),
    ).toBeInTheDocument();
  });

  it("uses one full-width column when only Facebook is offered", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS", "facebook");
    render(<OAuthButtons locale="en" disabled={false} />);

    const facebook = screen.getByRole("button", { name: "Facebook" });
    expect(facebook).toBeInTheDocument();
    expect(mocks.script.src).toBeNull();

    const grid = facebook.closest("form")?.parentElement;
    expect(grid?.className).toContain("sm:grid-cols-1");
  });
});
