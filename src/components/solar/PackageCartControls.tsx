"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { STORE_PATH } from "@/lib/config/navigation";
import { addToCartAction } from "@/lib/store/cart-actions";

/**
 * Add-to-cart and request-info controls for one solar package.
 *
 * The package is a real store product (seeded under the Electrical Services
 * department), so adding it to the cart goes through the same Server Action the
 * store uses: the price is re-read from the database and never taken from the
 * request. The product id is resolved server-side from the package, so this
 * component cannot be used to add an arbitrary product.
 *
 * When no product row exists yet (an unseeded deployment), the control does not
 * pretend to work: it hides the cart button and offers the request-info path
 * instead, which stores an inquiry rather than a phantom order.
 *
 * The confirmation is announced through a live region so a screen-reader user
 * learns the package was added without the layout moving.
 */
export function PackageCartControls({
  productId,
  packageSlug,
  locale,
  requestHref,
}: {
  productId: string | null;
  packageSlug: string;
  locale: Locale;
  requestHref: string;
}) {
  const t = createTranslator(locale).t;
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  const cartHref = `/${locale}${STORE_PATH}/cart`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {productId ? (
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={pending}
          onClick={() => {
            setError(false);
            startTransition(async () => {
              const result = await addToCartAction({
                productId,
                quantity: 1,
                locale,
              });
              if (result.ok) setAdded(true);
              else setError(true);
            });
          }}
        >
          {added ? (
            <>
              <Check aria-hidden="true" className="h-4 w-4" />
              {t("solarPackages.labels.addedToCart")}
            </>
          ) : (
            <>
              <ShoppingCart aria-hidden="true" className="h-4 w-4" />
              {pending
                ? t("solarPackages.labels.addingToCart")
                : t("solarPackages.labels.addToCart")}
            </>
          )}
        </Button>
      ) : null}

      <Link
        href={requestHref}
        className="inline-flex items-center justify-center gap-2 rounded-control border border-ink-900 px-6 py-3 text-base font-semibold text-ink-900 transition-soft hover:bg-ink-900 hover:text-white"
      >
        {t("solarPackages.labels.requestInfo")}
      </Link>

      {/* Announced to assistive technology without moving focus. */}
      <p
        aria-live="polite"
        className="visually-hidden"
        data-package={packageSlug}
      >
        {added ? t("solarPackages.labels.addedToCart") : ""}
      </p>

      {added ? (
        <Link
          href={cartHref}
          className="text-sm font-semibold text-dept-accent underline underline-offset-4"
        >
          {t("store.cart.checkout")}
        </Link>
      ) : null}

      {error ? (
        <p role="alert" className="w-full text-sm text-red-800">
          {t("errors.generic")}
        </p>
      ) : null}
    </div>
  );
}
