"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { Cart, CartLine } from "@/lib/store/cart";
import { productPath } from "@/lib/store/product-path";
import {
  removeCartItemAction,
  updateCartItemAction,
} from "@/lib/store/cart-actions";
import { formatPrice } from "@/lib/store/types";

/**
 * Cart line items.
 *
 * A Client Component so a quantity change and a removal take effect without a
 * full page reload. The mutations still run through Server Actions, so the price
 * and the cart's ownership are decided on the server; this component only sends
 * an item id and a quantity.
 *
 * The quantity control is a native number input flanked by decrement/increment
 * buttons. The input stays because it is what a screen reader, a keyboard and a
 * numeric keypad already understand; the buttons are a convenience on top of it,
 * not a replacement. Each button's accessible name includes the product, so a
 * screen-reader user walking a list of identical "+" icons knows which line each
 * one changes.
 *
 * When the recorded unit price differs from the product's current price, the
 * change is shown rather than applied silently: the customer was shown one price
 * and must not be charged another without seeing it.
 */
export function CartLines({ cart, locale }: { cart: Cart; locale: Locale }) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [pending, startTransition] = useTransition();

  const onQuantityChange = (itemId: string, quantity: number) => {
    startTransition(async () => {
      await updateCartItemAction({ itemId, quantity, locale });
    });
  };

  const onRemove = (itemId: string) => {
    startTransition(async () => {
      await removeCartItemAction({ itemId, locale });
    });
  };

  return (
    <ul aria-label={t("a11y.cartContents")} className="space-y-4">
      {cart.lines.map((line) => (
        <CartLineRow
          key={line.id}
          line={line}
          locale={locale}
          pending={pending}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

function CartLineRow({
  line,
  locale,
  pending,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  locale: Locale;
  pending: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}) {
  // Derived here rather than received: a translator function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const maxQuantity = Math.max(1, Math.min(line.stock, 999));

  // The field is controlled by a local draft so a keystroke and a button press
  // both register immediately, while the cart row remains the source of truth.
  //
  // It used to be `defaultValue`, which was the defect: React stops writing to
  // an input once the customer has typed into it, so pressing +/- after editing
  // the field sent the right quantity to the server but left the field showing
  // the old number — the cart changed and the screen did not.
  const [draft, setDraft] = useState(() => String(line.quantity));
  const [syncedQuantity, setSyncedQuantity] = useState(line.quantity);

  // Adopt a quantity that arrived from the server. Done during render rather
  // than in an effect: this is React's documented way to reset state when a prop
  // changes, it cannot flash a stale value, and `react-hooks/set-state-in-effect`
  // rejects the effect form.
  if (syncedQuantity !== line.quantity) {
    setSyncedQuantity(line.quantity);
    setDraft(String(line.quantity));
  }

  // A blank or out-of-range field falls back to the cart's value, so the line
  // total below never renders `NaN`.
  const parsedDraft = Number(draft);
  const shownQuantity =
    Number.isInteger(parsedDraft) && parsedDraft >= 1
      ? Math.min(parsedDraft, maxQuantity)
      : line.quantity;

  const commit = (next: number) => {
    const clamped = Math.max(1, Math.min(Math.trunc(next), maxQuantity));
    setDraft(String(clamped));
    onQuantityChange(line.id, clamped);
  };

  const priceChanged =
    line.currentPriceMinor !== null &&
    line.currentPriceMinor !== line.unitPriceMinor;

  return (
    <li className="rounded-card border border-border bg-surface p-4 shadow-card transition-soft hover:border-border-strong sm:p-5">
      <div className="flex gap-4">
        <div className="shrink-0 overflow-hidden rounded-control border border-border bg-surface-sunken">
          {line.imagePath ? (
            <Image
              src={line.imagePath}
              alt=""
              width={200}
              height={200}
              sizes="(max-width: 640px) 88px, 112px"
              className="aspect-square w-20 object-cover sm:w-28"
            />
          ) : (
            <span className="flex aspect-square w-20 items-center justify-center text-muted sm:w-28">
              <ShoppingBag aria-hidden="true" className="h-6 w-6" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={productPath(locale, line)}
                className="block text-base font-semibold leading-snug text-ink-900 transition-soft hover:text-dept-accent"
              >
                {line.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {t("store.cart.unitPrice", {
                  price: formatPrice(line.unitPriceMinor, line.currency, locale),
                })}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-label={t("store.cart.removeLabel", { name: line.title })}
              onClick={() => onRemove(line.id)}
              className="h-11 w-11 shrink-0 text-muted hover:text-red-800"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>

          {priceChanged && line.currentPriceMinor !== null ? (
            <p className="mt-2 inline-block rounded-field bg-surface-sunken px-2 py-1 text-xs font-medium text-teal-700">
              {t("store.cart.lineTotal")}:{" "}
              {formatPrice(line.currentPriceMinor, line.currency, locale)}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label
                htmlFor={`quantity-${line.id}`}
                className="block text-xs font-medium uppercase tracking-wide text-muted"
              >
                {t("store.cart.quantityLabel")}
              </label>
              <div className="mt-1 inline-flex items-center rounded-control border border-border-strong bg-surface">
                <button
                  type="button"
                  disabled={pending || shownQuantity <= 1}
                  aria-label={t("store.cart.decreaseLabel", {
                    name: line.title,
                  })}
                  onClick={() => commit(shownQuantity - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-l-control text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <input
                  id={`quantity-${line.id}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxQuantity}
                  value={draft}
                  disabled={pending}
                  onChange={(event) => {
                    const raw = event.currentTarget.value;
                    setDraft(raw);
                    const next = Number(raw);
                    if (Number.isInteger(next) && next >= 1) {
                      onQuantityChange(line.id, Math.min(next, maxQuantity));
                    }
                  }}
                  onBlur={() => {
                    // Restore a usable number after the field is left blank or
                    // out of range; the change handler ignores those values, so
                    // without this the field would keep showing an invalid one.
                    const next = Number(draft);
                    if (!(Number.isInteger(next) && next >= 1)) {
                      setDraft(String(line.quantity));
                    }
                  }}
                  className="h-11 w-12 border-x border-border-strong bg-transparent text-center text-base font-medium text-ink-900 focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  disabled={pending || shownQuantity >= maxQuantity}
                  aria-label={t("store.cart.increaseLabel", {
                    name: line.title,
                  })}
                  onClick={() => commit(shownQuantity + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-r-control text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="font-display text-lg font-bold text-ink-900">
              {formatPrice(
                line.unitPriceMinor * shownQuantity,
                line.currency,
                locale,
              )}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
