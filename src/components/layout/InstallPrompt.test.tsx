import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { createTranslator } from "@/lib/i18n/translator";
import { INSTALL_DISMISSED_KEY } from "@/lib/hooks/use-install-prompt";
import { INSTALL_PROMPT_GLOBAL } from "@/lib/pwa/install-prompt-script";

/**
 * Install banner.
 *
 * The banner is the visible half of an installability feature whose failure mode
 * is silence: if it renders when the browser cannot install, the button does
 * nothing and the visitor concludes the site is broken. So these assertions are
 * about *when* it appears, not how it looks.
 *
 * `beforeinstallprompt` is dispatched by hand. jsdom has no install machinery,
 * and the event is the only input that matters — the hook is deliberately driven
 * by it rather than by a timer or a user-agent check.
 */

function makeInstallEvent() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  return event;
}

const pathname = vi.fn(() => "/en");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

function renderBanner() {
  return render(<InstallPrompt />);
}

beforeEach(() => {
  localStorage.clear();
  pathname.mockReturnValue("/en");
  // The bootstrap script normally owns this property; clear it so a captured
  // event cannot leak between cases.
  delete (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_GLOBAL];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstallPrompt", () => {
  it("renders nothing before the browser offers an install", () => {
    renderBanner();
    // The server render and the first client render must agree, and neither can
    // know about a client-only event.
    expect(screen.queryByText("Install the KC Technology app")).toBeNull();
  });

  it("appears once beforeinstallprompt fires", async () => {
    renderBanner();
    fireEvent(window, makeInstallEvent());

    expect(
      await screen.findByText(createTranslator("en").t("pwa.installTitle")),
    ).toBeTruthy();
  });

  it("calls the browser prompt when the action is pressed", async () => {
    renderBanner();
    const event = makeInstallEvent();
    fireEvent(window, event);

    const button = await screen.findByRole("button", {
      name: createTranslator("en").t("pwa.installAction"),
    });
    fireEvent.click(button);

    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it("hides itself after the visitor dismisses it", async () => {
    renderBanner();
    fireEvent(window, makeInstallEvent());

    const dismiss = await screen.findByRole("button", {
      name: createTranslator("en").t("pwa.installDismiss"),
    });
    fireEvent.click(dismiss);

    await waitFor(() =>
      expect(
        screen.queryByText(createTranslator("en").t("pwa.installTitle")),
      ).toBeNull(),
    );
  });

  it("stays hidden for a visitor who dismissed it earlier", () => {
    // The persistence is the point: a banner that reappears on every page load is
    // nagging, and the visitor has already answered the question.
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    renderBanner();
    fireEvent(window, makeInstallEvent());

    expect(
      screen.queryByText(createTranslator("en").t("pwa.installTitle")),
    ).toBeNull();
  });

  it("speaks the locale of the current path", async () => {
    pathname.mockReturnValue("/fr");
    renderBanner();
    fireEvent(window, makeInstallEvent());

    expect(
      await screen.findByText(createTranslator("fr").t("pwa.installTitle")),
    ).toBeTruthy();
  });

  it("falls back to the default locale on the language-neutral gateway", async () => {
    // `/` has no locale segment, and reading headers there would make the
    // prerendered gateway dynamic, so the path is the only available signal.
    pathname.mockReturnValue("/");
    renderBanner();
    fireEvent(window, makeInstallEvent());

    expect(
      await screen.findByText(createTranslator("en").t("pwa.installTitle")),
    ).toBeTruthy();
  });

  it("adopts an install event the bootstrap captured before hydration", async () => {
    // The regression this covers: on a slow (mobile) connection Chromium fires
    // `beforeinstallprompt` before React hydrates, and the event fires only once
    // per page load. The banner must pick up the event the inline bootstrap
    // stashed, or it never appears on the platform it matters most on.
    const event = makeInstallEvent();
    window[INSTALL_PROMPT_GLOBAL] = event as never;
    renderBanner();

    expect(
      await screen.findByText(createTranslator("en").t("pwa.installTitle")),
    ).toBeTruthy();
  });

  it("does not show the banner when the bootstrap captured nothing", () => {
    window[INSTALL_PROMPT_GLOBAL] = null;
    renderBanner();
    expect(screen.queryByText("Install the KC Technology app")).toBeNull();
  });
});
