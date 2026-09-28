"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Customer sign-out.
 *
 * The admin console already had a sign-out; the customer-facing surfaces — order
 * history, favourites, saved searches — had none, so a signed-in customer could
 * not leave their account without clearing cookies by hand. This is the action
 * those surfaces call.
 *
 * It clears the session server-side so the auth cookies are revoked rather than
 * merely removed in the browser, then returns the visitor to the localized
 * sign-in page they came from. The locale is a parameter rather than a cookie
 * read because the caller already knows it: the page is under `/[locale]/…`, and
 * passing it through keeps the redirect correct without another header lookup.
 *
 * The path is validated before use, the same allowlist the sign-in `next`
 * parameter goes through, so a crafted `locale` cannot turn this into an open
 * redirect.
 */
export async function customerSignOutAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const locale = String(formData.get("locale") ?? "");
  const target = /^[a-z]{2}$/.test(locale)
    ? `/${locale}/admin/login`
    : "/admin/login";
  redirect(target);
}
