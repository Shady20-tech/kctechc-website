"use client";

import { useState, useTransition } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { addToCartAction } from "@/lib/store/cart-actions";

/**
 * Add-to-cart control.
 *
 * A Client Component because the interaction is local: the button shows a
 * pending state and then a confirmation without navigating. The action itself
 * runs on the server, so the price is never taken from this component.
 *
 * The confirmation is announced through a live region rather than only changing
 * the button's appearance, so a screen-reader user learns the item was added.
 */
export function AddToCartButton({
  productId,
  locale,
  t,
  disabled = false,
  disabledReason,
}: {
  productId: string;
  locale: Locale;
  t: Translator["t"];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <p className="text-sm text-muted">
        {disabledReason ?? t("store.product.notPurchasable")}
      </p>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await addToCartAction({
              productId,
              quantity: 1,
              locale,
            });
            if (result.ok) {
              setAdded(true);
            } else {
              setError(
                result.error === "out_of_stock"
                  ? t("store.availability.out_of_stock")
                  : t("errors.generic"),
              );
            }
          });
        }}
      >
        {added ? (
          <>
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
            {t("store.product.addedToCart")}
          </>
        ) : (
          <>
            <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4" />
            {pending
              ? t("store.product.addingToCart")
              : t("store.product.addToCart")}
          </>
        )}
      </Button>

      {/* Announced to assistive technology without moving focus. */}
      <p aria-live="polite" className="visually-hidden">
        {added ? t("store.product.addedToCart") : ""}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
