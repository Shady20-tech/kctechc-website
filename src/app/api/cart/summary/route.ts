import { NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/locales";
import { getCartSummary } from "@/lib/store/cart";

/**
 * Cart summary for the header badge.
 *
 * The shared site header must stay statically renderable — reading the cart
 * cookie in the locale layout would make every public page dynamic and cost the
 * prerendered HTML the SEO layer depends on — so the header renders the cart icon
 * without a server count and this endpoint is what supplies it to the client
 * island afterwards.
 *
 * It returns the item count and the cart's own path, never the line items, prices
 * or the cart token. Access is scoped to the caller's own cart by the httpOnly
 * cookie; a caller with no cookie gets a zero count, so the endpoint cannot be
 * used to read anyone else's basket.
 *
 * `force-dynamic` because the response depends on the request cookie.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = requested && isLocale(requested) ? requested : "en";

  const summary = await getCartSummary(locale);

  return NextResponse.json(summary ?? { itemCount: 0, href: null }, {
    headers: { "cache-control": "no-store" },
  });
}
