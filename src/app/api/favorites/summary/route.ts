import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in customer's saved ids, for the heart controls.
 *
 * The store, insights and landing pages are statically rendered, so they cannot
 * read a session cookie without becoming dynamic. The hearts therefore render
 * with their default state and this endpoint fills them in afterwards. It returns
 * ids only — never titles, prices or anything about another account — and the
 * three tables' own-row policies scope every query to the caller. A signed-out
 * visitor gets empty arrays rather than an error, which is the honest state for a
 * page that is public.
 *
 * `force-dynamic` because the response depends on the request cookie.
 */
export const dynamic = "force-dynamic";

const EMPTY = { listing: [], product: [], insight: [] } as const;

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "no-store" },
    });
  }

  const [{ data: listings }, { data: products }, { data: insights }] =
    await Promise.all([
      supabase.from("listing_favorites").select("listing_id"),
      supabase.from("product_favorites").select("product_id"),
      supabase.from("insight_favorites").select("insight_id"),
    ]);

  return NextResponse.json(
    {
      listing: (listings ?? []).map((row) => row.listing_id),
      product: (products ?? []).map((row) => row.product_id),
      insight: (insights ?? []).map((row) => row.insight_id),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
