import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInWithIdToken: vi.fn(),
  completeOAuthSignInAction: vi.fn(),
  script: {
    src: null as string | null,
    onReady: null as (() => void) | null,
    onError: null as (() => void) | null,
  },
  env: { publicEnv: { googleClientId: "test-client-id" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next/script", () => ({
  default: ({
    src,
    onReady,
    onError,
  }: {
    src: string;
    onReady?: () => void;
    onError?: () => void;
  }) => {
    mocks.script.src = src;
    mocks.script.onReady = onReady ?? null;
    mocks.script.onError = onError ?? null;
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
}));

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type CredentialCallback = (response: { credential?: string }) => void;

const initialize = vi.fn();
const renderButton = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.publicEnv.googleClientId = "test-client-id";
  mocks.script.src = null;
  mocks.script.onReady = null;
  mocks.script.onError = null;
  mocks.signInWithIdToken.mockResolvedValue({ error: null });
  mocks.completeOAuthSignInAction.mockResolvedValue({
    status: "redirect",
    path: "/en/account",
  });
  vi.stubGlobal("google", {
    accounts: { id: { initialize, renderButton } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoogleSignInButton", () => {
  it("renders nothing when the Google client id is missing", () => {
    mocks.env.publicEnv.googleClientId = "";

    const { container } = render(<GoogleSignInButton locale="en" />);

    expect(container).toBeEmptyDOMElement();
    expect(mocks.script.src).toBeNull();
  });

  it("loads the official GIS script and renders the button", async () => {
    render(<GoogleSignInButton locale="en" />);

    expect(mocks.script.src).toBe("https://accounts.google.com/gsi/client");

    act(() => mocks.script.onReady?.());

    await waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id",
        ux_mode: "popup",
        nonce: expect.any(String),
      }),
    );
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        text: "signin_with",
        size: "large",
        width: 320,
      }),
    );
  });

  it("uses the sign-up wording and French locale", async () => {
    render(<GoogleSignInButton locale="fr" mode="signup" />);
    act(() => mocks.script.onReady?.());

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: "signup_with", locale: "fr" }),
    );
  });

  it("exchanges the credential with Supabase and follows the resolved path", async () => {
    let callback: CredentialCallback | undefined;
    initialize.mockImplementation(
      (options: { callback: CredentialCallback }) => {
        callback = options.callback;
      },
    );

    render(
      <GoogleSignInButton locale="en" nextPath="/en/real-estate/favorites" />,
    );
    act(() => mocks.script.onReady?.());
    await waitFor(() => expect(callback).toBeTypeOf("function"));

    await act(async () => {
      callback?.({ credential: "google-id-token" });
    });

    await waitFor(() =>
      expect(mocks.signInWithIdToken).toHaveBeenCalledWith({
        provider: "google",
        token: "google-id-token",
        nonce: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(mocks.completeOAuthSignInAction).toHaveBeenCalledWith({
        locale: "en",
        next: "/en/real-estate/favorites",
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/en/account"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows an error and does not navigate when Supabase rejects the token", async () => {
    mocks.signInWithIdToken.mockResolvedValueOnce({
      error: { message: "invalid token" },
    });
    let callback: CredentialCallback | undefined;
    initialize.mockImplementation(
      (options: { callback: CredentialCallback }) => {
        callback = options.callback;
      },
    );

    render(<GoogleSignInButton locale="en" />);
    act(() => mocks.script.onReady?.());
    await waitFor(() => expect(callback).toBeTypeOf("function"));

    await act(async () => {
      callback?.({ credential: "bad-token" });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not complete that sign-in",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("reports a script that fails to load", async () => {
    render(<GoogleSignInButton locale="en" />);
    act(() => mocks.script.onError?.());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not complete that sign-in",
    );
  });
});
