"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  THEME_ATTRIBUTE,
  themeSlugFromPathname,
} from "@/lib/theme/department-theme";

/**
 * Applies the department theme to the document element.
 *
 * The inline bootstrap script in the root `<head>` sets the attribute before the
 * first paint, so a deep link into a department page never flashes the corporate
 * palette. This component covers the other case — client-side navigation, which
 * does not re-run the bootstrap — so moving from a department page back to a
 * corporate page removes the attribute again.
 *
 * It resolves the theme from the pathname rather than from the page wrapper's
 * `data-theme`, so it does not depend on the page having mounted; the resolution
 * function is shared with the bootstrap, so the two cannot disagree.
 *
 * `useEffect` rather than `useLayoutEffect`: the initial paint is already correct
 * thanks to the bootstrap, so the effect only needs to run after a navigation,
 * and the layout variant would warn during the server render.
 */
export function ThemeController() {
  const pathname = usePathname();

  useEffect(() => {
    const slug = themeSlugFromPathname(pathname ?? "");
    const root = document.documentElement;
    if (slug) {
      root.setAttribute(THEME_ATTRIBUTE, slug);
    } else {
      root.removeAttribute(THEME_ATTRIBUTE);
    }
  }, [pathname]);

  return null;
}
