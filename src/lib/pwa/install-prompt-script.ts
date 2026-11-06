/**
 * The `beforeinstallprompt` capture script.
 *
 * A leaf module with no imports and no `"use client"` directive, because it is
 * reached from both sides of the server/client boundary: the root layout (a
 * Server Component) renders the script, and the install-prompt hook (a Client
 * Component) reads the property it writes. A `"use client"` module cannot export
 * a plain function to a Server Component — Next rejects the call at build time
 * with "Attempted to call … from the server but … is on the client" — so the
 * shared constant and the script generator live here instead.
 */

/**
 * The `beforeinstallprompt` event.
 *
 * Chromium-only and non-standard, so it is typed here rather than relied on from
 * the DOM lib. The event is single-use: it is prompted once and then discarded,
 * which is why the hook clears it after prompting.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Where the first `beforeinstallprompt` is parked until React is listening.
 *
 * Chromium fires the event as soon as it has decided the site is installable,
 * which on a mobile connection is routinely *before* the page's JavaScript has
 * hydrated. The event fires once per page load, so a listener added during
 * hydration misses it entirely and the banner never appears — which is why the
 * banner looked desktop-only.
 *
 * The inline script below therefore subscribes at parse time and stashes the
 * event here; the hook adopts it when it mounts. This is the "capture early,
 * consume late" shape the platform expects, and the only way to observe an event
 * that can precede the component that needs it.
 */
export const INSTALL_PROMPT_GLOBAL = "__kcInstallPrompt";

declare global {
  interface Window {
    __kcInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/**
 * Inline bootstrap for `beforeinstallprompt`.
 *
 * Rendered as the first element of `<body>` so it runs before the rest of the
 * document is parsed. It must stay dependency-free and tiny: it is inline in
 * every page and runs on the critical path. It only records the event — the
 * decision to show anything stays in the hook — so a browser that never fires the
 * event is unaffected.
 */
export function installPromptBootstrapScript(): string {
  return (
    "(function(){" +
    "window." +
    INSTALL_PROMPT_GLOBAL +
    "=window." +
    INSTALL_PROMPT_GLOBAL +
    "||null;" +
    'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.' +
    INSTALL_PROMPT_GLOBAL +
    "=e;});" +
    'window.addEventListener("appinstalled",function(){window.' +
    INSTALL_PROMPT_GLOBAL +
    "=null;});" +
    "})();"
  );
}
