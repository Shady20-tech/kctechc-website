"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config/env";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/security/audit";
import { signInSchema, type SignInState } from "@/lib/validation/auth";

export type SignInActionState = SignInState;

/**
 * Sign-in Server Action.
 *
 * Credentials are validated server-side, brute-force attempts are rate limited
 * per client, and both success and failure are audited. The `next` path is
 * validated against an open-redirect allowlist before any redirect.
 */
export async function signInAction(
  _previous: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "unconfigured" };
  }

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "signin"), {
    limit: 10,
    windowSeconds: 300,
  });
  if (!limit.allowed) {
    return { status: "error", messageKey: "auth.invalidCredentials" };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", messageKey: "auth.invalidCredentials" };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await recordAudit({
      actorId: null,
      action: "sign_in_failed",
      entityType: "auth",
      entityId: null,
      metadata: { email: parsed.data.email },
    });
    // Deliberately generic: never reveal whether the account exists.
    return { status: "error", messageKey: "auth.invalidCredentials" };
  }

  await recordAudit({
    actorId: data.user.id,
    action: "sign_in_succeeded",
    entityType: "auth",
    entityId: data.user.id,
  });

  redirect(parsed.data.next ?? "/admin");
}
