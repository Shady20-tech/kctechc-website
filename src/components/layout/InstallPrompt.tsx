"use client";

import { Download, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { stripLocaleFromPath } from "@/lib/i18n/routing";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Registers the service worker once, on the client.
 *
 * Installability depends on this: Chromium requires a service worker with a
 * `fetch` handler before it will fire `beforeinstallprompt`, so the banner below
 * cannot appear until this has run and the worker has activated. Registration
 * only — the worker itself lives in `public/sw.js`.
 *
 * Failures are swallowed deliberately. Registration is unsupported in some
 * contexts (a non-secure origin, a browser without service workers) and the site
 * is fully functional without it; a thrown error here would break the page for no
 * benefit.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No service worker: the site works, it simply cannot be installed.
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

/**
 * "Add to home screen" banner.
 *
 * Shown only when the browser has fired `beforeinstallprompt`, which is the
 * browser's own statement that the app is installable and that a prompt will
 * succeed. It therefore never appears on a platform that cannot install, and the
 * button never fails when pressed.
 *
 * No `mounted` flag is needed: every input to `canInstall` has a defined server
 * snapshot of "false" (`useSyncExternalStore` for the display mode and the stored
 * dismissal, `useState` for the event), so the server HTML and the first client
 * render agree and nothing appears until the browser actually offers an install.
 *
 * The locale comes from the path rather than a prop, so the same component can be
 * mounted once in the root layout and still speak the visitor's language on the
 * language-neutral gateway `/`. Deriving it from `usePathname` also keeps it in
 * step across a client-side language switch, which a prop captured at render
 * would not.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const locale: Locale =
    stripLocaleFromPath(pathname ?? "/").locale ?? DEFAULT_LOCALE;
  const t = createTranslator(locale).t;
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  if (!canInstall) return null;

  return (
    <aside
      // A complementary landmark rather than a dialog: it is not modal, it does
      // not trap focus, and it must not interrupt what the visitor is reading.
      aria-labelledby="pwa-install-title"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-card border border-border-strong bg-surface p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-ink-950"
          aria-hidden="true"
        >
          <Download className="h-5 w-5 text-teal-300" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            id="pwa-install-title"
            className="font-display text-sm font-bold text-ink-900"
          >
            {t("pwa.installTitle")}
          </p>
          <p className="mt-1 text-xs text-body">{t("pwa.installBody")}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await promptInstall();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("pwa.installAction")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
              {t("pwa.installDismiss")}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.close")}
          className="shrink-0 rounded-control p-1 text-muted transition-soft hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
