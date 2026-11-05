"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { useStoredValue } from "@/lib/hooks/use-client-environment";

/**
 * The `beforeinstallprompt` event.
 *
 * Chromium-only and non-standard, so it is typed here rather than relied on from
 * the DOM lib. The event is single-use: it must be prompted once and then
 * discarded, which is why the hook clears it after prompting.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const INSTALL_DISMISSED_KEY = "kc_pwa_install_dismissed";

const STANDALONE_QUERY = "(display-mode: standalone)";

/**
 * Whether the app is already running as an installed window.
 *
 * Read as an external store rather than assigned in an effect: the value is
 * genuinely external (a media query plus a non-standard `navigator` property), and
 * `useSyncExternalStore` gives it a defined server snapshot. The effect form trips
 * `react-hooks/set-state-in-effect`, and the server snapshot has to be `false`
 * anyway so nothing renders into the HTML that only makes sense in an installed
 * window.
 *
 * `display-mode: standalone` covers Android and desktop; `navigator.standalone` is
 * the iOS Safari equivalent, which does not implement the media query.
 */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(STANDALONE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () =>
      window.matchMedia(STANDALONE_QUERY).matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true,
    () => false,
  );
}

export type InstallPromptState = {
  /** True when the browser has offered an install prompt we have not used yet. */
  canInstall: boolean;
  /** Show the prompt to the browser. Resolves once the user has chosen. */
  promptInstall: () => Promise<void>;
  /** Remember that the visitor dismissed our banner. */
  dismiss: () => void;
};

/**
 * Install-prompt state for the banner.
 *
 * Deliberately driven by `beforeinstallprompt` rather than by a timer. The event
 * fires only when the browser has already decided the site is installable, which
 * means:
 *
 *   * we never show the banner for a browser that would refuse the install, so
 *     the button always works when it is visible;
 *   * we never show it on iOS Safari, which does not fire the event at all —
 *     correct, because that platform has no programmatic prompt and would need
 *     "Share → Add to Home Screen" instructions instead of a button.
 *
 * The event arrives asynchronously, so `canInstall` starts false and the server
 * and first client render agree. A visitor who has already dismissed the banner,
 * or who is already running the installed app, sees nothing.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const dismissed = useStoredValue(INSTALL_DISMISSED_KEY) === "1";
  const standalone = useIsStandalone();

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Prevent the browser's own mini-infobar so the in-page banner is the only
      // prompt; without this the visitor sees two.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    canInstall: Boolean(deferred) && !dismissed && !standalone,
    promptInstall: async () => {
      if (!deferred) return;
      await deferred.prompt();
      // The event is single-use: Chromium will not fire it again for this page
      // load, so holding it would leave a button that silently does nothing.
      await deferred.userChoice;
      setDeferred(null);
    },
    dismiss: () => {
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
        // Notify this tab: `storage` only fires in *other* tabs, so without a
        // nudge the banner stays visible until the next navigation.
        window.dispatchEvent(new Event("storage"));
      } catch {
        // A blocked localStorage must not break the page; the banner simply
        // reappears on the next visit, which is a harmless degradation.
      }
    },
  };
}
