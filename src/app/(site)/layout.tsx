import type { ReactNode } from "react";

import { InstallPrompt } from "@/components/layout/InstallPrompt";

/**
 * Public-site layout.
 *
 * It renders only the install banner and passes `children` through. The chrome —
 * header, footer, skip link — belongs to `[locale]/layout.tsx`, and the document
 * belongs to the root layout.
 *
 * The banner sits here rather than in the root layout or the locale layout for two
 * reasons. It must cover the language-neutral gateway `/`, which has no locale
 * segment and therefore no `[locale]` layout above it; and it must *not* cover the
 * `(static)` admin tree, where a fixed bottom banner would sit over the console.
 * This group is exactly "the public site", which is the intended scope.
 *
 * The locale is derived inside the component from the pathname, so the gateway
 * renders it in English without a prop and a `/fr` page renders it in French.
 *
 * `ServiceWorkerRegistration` is deliberately *not* here: a service worker's scope
 * is a directory of the origin, so the registration must exist on every route that
 * the worker covers, including the console. It lives in the root layout.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
