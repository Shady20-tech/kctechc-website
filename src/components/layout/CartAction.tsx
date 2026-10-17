"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCartSummary } from "@/lib/hooks/use-cart-summary";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { cartPathFor } from "@/lib/store/product-path";

/**
 * Header cart action.
 *
 * The shared header is statically rendered, so it cannot read the cart cookie
 * without making every public page dynamic. This island fills the gap on the
 * client: it renders the cart link immediately (a real link in the first paint,
 * so it works with JavaScript disabled) and adds the item-count badge once
 * `/api/cart/summary` answers.
 *
 * The link is the default store's cart until the summary names the cart's own
 * department, at which point `href` is corrected to the department the items
 * actually belong to.
 */
export function CartAction({
  locale,
  onNavigate,
  size = "sm",
}: {
  locale: Locale;
  /** Called on click, so a host that opens over the page (the drawer) can close. */
  onNavigate?: () => void;
  size?: "sm" | "md" | "lg";
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const pathname = usePathname();
  const summary = useCartSummary(locale, pathname);

  const count = summary?.itemCount ?? 0;
  const href = summary?.href ?? cartPathFor(locale);

  const box =
    size === "lg" ? "h-12 w-12" : size === "md" ? "h-11 w-11" : "h-10 w-10";
  const icon = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      // The accessible name carries the count; the visible badge is decorative so
      // a screen reader hears the number once, not twice.
      aria-label={
        count > 0
          ? `${t("actions.viewCart")} — ${t("store.cart.itemCount", { count })}`
          : t("actions.viewCart")
      }
      className={`relative inline-flex ${box} shrink-0 items-center justify-center rounded-control text-white/75 transition-soft hover:bg-white/5 hover:text-white`}
    >
      <ShoppingCart aria-hidden="true" className={icon} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-dept-accent-bright px-1 text-[0.7rem] font-bold leading-none text-ink-950"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
