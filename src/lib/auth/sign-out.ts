"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out Server Action.
 *
 * Clears the session server-side so the auth cookies are revoked rather than
 * merely removed in the browser.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
