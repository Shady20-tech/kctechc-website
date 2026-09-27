"use client";

import { useEffect } from "react";
import { trackEcommerce } from "@/lib/analytics/track";
import type { AnalyticsItem } from "@/lib/analytics/events";

/**
 * Reports a `purchase` for a paid order.
 *
 * Rendered only when the order is genuinely paid — the caller checks
 * `shouldTrackPurchase` — because reporting revenue that was never collected
 * would make the conversion figure meaningless.
 *
 * Deduplication is per order reference, held in `sessionStorage`. A reload, a
 * back-navigation or a shared link opened twice would otherwise count the same
 * order again, and a double-counted sale is worse than a missing one because it
 * is invisible. `sessionStorage` is deliberate: the guard needs to outlive a
 * reload of this tab and no longer, and it carries only the reference, which is
 * already printed on the page.
 */
export function OrderPurchaseTracker({
  orderReference,
  totalMinor,
  currency,
  items,
}: {
  orderReference: string;
  totalMinor: number;
  currency: string;
  items: {
    productId: string;
    title: string;
    unitPriceMinor: number;
    quantity: number;
  }[];
}) {
  useEffect(() => {
    const key = `kc_purchase_${orderReference}`;

    try {
      if (window.sessionStorage.getItem(key) === "1") return;
    } catch {
      // Storage can be blocked (private mode, hardened settings). Reporting the
      // purchase once is better than not reporting it, so this falls through and
      // accepts the small risk of a repeat on reload.
    }

    trackEcommerce("purchase", {
      // The order reference is the transaction id GA4 deduplicates on, and it is
      // already visible on the page.
      transaction_id: orderReference,
      value: totalMinor,
      currency,
      items: items.map(
        (item, index): AnalyticsItem => ({
          item_id: item.productId,
          item_name: item.title,
          price: item.unitPriceMinor,
          quantity: item.quantity,
          index,
        }),
      ),
    });

    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // See above: a failed write only risks a duplicate on the next reload.
    }
  }, [orderReference, totalMinor, currency, items]);

  return null;
}
