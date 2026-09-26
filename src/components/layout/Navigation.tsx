import type { ReactNode } from "react";

/**
 * Keyboard skip link.
 *
 * Visually hidden until focused, then pinned to the top of the viewport. It
 * targets `#main`, which every layout applies to its main landmark, so a
 * keyboard user can bypass the header on every page.
 */
export function SkipLink({ children }: { children: ReactNode }) {
  return (
    <a href="#main" className="skip-link">
      {children}
    </a>
  );
}
