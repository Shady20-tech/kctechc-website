"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STORE_PATH } from "@/lib/config/navigation";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import type { Cart } from "@/lib/store/cart";
import {
  removeCartItemAction,
  updateCartItemAction,
} from "@/lib/store/cart-actions";
import { storagePublicUrl } from "@/lib/store/storage";
import { formatPrice } from "@/lib/store/types";

/**
 * Cart line items.
 *
 * A Client Component so a quantity change and a removal take effect without a
 * full page reload. The mutations still run through Server Actions, so the price
 * and the cart's ownership are decided on the server; this component only sends
 * an item id and a quantity.
 *
 * The quantity control is a plain number input inside a form. A stepper built
 * from buttons would need its own keyboard handling to be usable; the native
 * input already works with a keyboard, a screen reader and a numeric keypad.
 *
 * When the recorded unit price differs from the product's current price, the
 * change is shown rather than applied silently: the customer was shown one price
 * and must not be charged another without seeing it.
 */
export function CartLines({
  cart,
  locale,
  t,
}: {
  cart: Cart;
  locale: Locale;
  t: Translator["t"];
}) {
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
    <ul
      aria-label={t("a11y.cartContents")}
      className="divide-y divide-border border-y border-border"
    >
      {cart.lines.map((line) => {
        const src = line.imagePath ? storagePublicUrl(line.imagePath) : null;
        const priceChanged =
          line.currentPriceMinor !== null &&
          line.currentPriceMinor !== line.unitPriceMinor;

        return (
          <li
            key={line.id}
            className="grid gap-4 py-6 sm:grid-cols-[7rem_1fr_auto] sm:items-start"
          >
            <div className="overflow-hidden rounded-card border border-border bg-surface-sunken">
              {src ? (
                <Image
                  src={src}
                  alt=""
                  width={200}
                  height={200}
                  sizes="112px"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div aria-hidden="true" className="aspect-square w-full" />
              )}
            </div>

            <div>
              <Link
                href={`/${locale}${STORE_PATH}/${line.slug}`}
                className="text-base font-semibold text-ink-900 transition-soft hover:text-dept-accent"
              >
                {line.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {t("store.cart.unitPrice", {
                  price: formatPrice(
                    line.unitPriceMinor,
                    line.currency,
                    locale,
                  ),
                })}
              </p>

              {priceChanged && line.currentPriceMinor !== null ? (
                <p className="mt-2 text-sm font-medium text-teal-700">
                  {t("store.cart.lineTotal")}:{" "}
                  {formatPrice(line.currentPriceMinor, line.currency, locale)}
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-3">
                <label
                  htmlFor={`quantity-${line.id}`}
                  className="text-sm text-body"
                >
                  {t("store.cart.quantityLabel")}
                </label>
                <input
                  id={`quantity-${line.id}`}
                  type="number"
                  min={1}
                  max={Math.max(1, Math.min(line.stock, 999))}
                  defaultValue={line.quantity}
                  disabled={pending}
                  onChange={(event) => {
                    const next = Number(event.currentTarget.value);
                    if (Number.isFinite(next) && next >= 1) {
                      onQuantityChange(line.id, next);
                    }
                  }}
                  className="w-20 rounded-card border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink-900 focus-visible:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <p className="font-display text-base font-bold text-ink-900">
                {formatPrice(
                  line.unitPriceMinor * line.quantity,
                  line.currency,
                  locale,
                )}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                aria-label={t("store.cart.removeLabel", { name: line.title })}
                onClick={() => onRemove(line.id)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {t("store.cart.remove")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
