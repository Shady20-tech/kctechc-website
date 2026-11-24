"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, getSiteUrl } from "@/lib/config/env";
import {
  confirmationRedirectUrl,
  postSignInPathFor,
  recoveryRedirectUrlFor,
} from "@/lib/auth/redirects";
import {
  enabledOAuthProviders,
  isServerOAuthProvider,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";
import { DEFAULT_ROLE, isAppRole } from "@/lib/auth/roles";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { safeRedirectPathSchema } from "@/lib/validation/common";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/security/audit";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthOnboardingSchema,
  type SignInState,
  type SignUpState,
  type ForgotPasswordState,
  type ResetPasswordState,
  type OAuthOnboardingState,
} from "@/lib/validation/auth";

export type SignInActionState = SignInState;

/** The recovery email lands here; see {@link recoveryRedirectUrlFor}. */
async function recoveryRedirectUrl(): Promise<string> {
  const cookieStore = await cookies();
  return recoveryRedirectUrlFor(cookieStore.get("kc_locale")?.value);
}

/**
 * Supabase reports an unconfirmed account with a stable machine code. Matching
 * on the code rather than the message keeps this working if the wording changes;
 * the message check is a fallback for older server versions.
 */
function isUnconfirmedError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "email_not_confirmed" ||
    (error.message ?? "").toLowerCase().includes("email not confirmed")
  );
}

/**
 * Sign-in Server Action.
 *
 * Credentials are validated server-side, brute-force attempts are rate limited
 * per client, and both success and failure are audited. The `next` path is
 * validated against an open-redirect allowlist before any redirect.
 *
 * **Sign-in never creates an account.** There is no code path from here that
 * calls `signUp`, and an unknown email is reported exactly like a wrong password.
 * An unconfirmed account is the one distinct case: the customer is told to
 * confirm and offered a resend, because otherwise a person who simply missed the
 * email would be stuck in a loop with no way forward.
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
    return { status: "rate_limited" };
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
    // An unconfirmed account is surfaced so the page can offer a resend. A wrong
    // password and an unknown account are indistinguishable here by design.
    if (error && isUnconfirmedError(error)) {
      await recordAudit({
        actorId: null,
        action: "sign_in_failed",
        entityType: "auth",
        entityId: null,
        metadata: { email: parsed.data.email, reason: "email_unconfirmed" },
      });
      // The typed email is echoed back so the resend control can prefill it
      // without asking the customer to type it a second time.
      return { status: "email_unconfirmed", email: parsed.data.email };
    }

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

  // The requested page wins; otherwise the landing depends on the role, so a
  // customer is not sent to the console only to be refused there. The profile is
  // read here because the redirect happens before any page renders.
  if (parsed.data.next) {
    redirect(parsed.data.next);
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role =
    profileRow && isAppRole(profileRow.role) ? profileRow.role : DEFAULT_ROLE;

  const localeCookie = (await cookies()).get("kc_locale")?.value;
  redirect(postSignInPathFor(role, localeCookie ?? DEFAULT_LOCALE));
}

/**
 * Sign-up Server Action.
 *
 * Creates an account for a self-registering customer. Three properties matter:
 *
 *   * **The role is not accepted from the client.** No role field is read here;
 *     `handle_new_user` provisions every account as `customer`.
 *   * **Confirmation is required before sign-in.** When email confirmation is on
 *     (the intended configuration), Supabase returns no session, and this action
 *     reports `check_email` rather than pretending the account is usable. See
 *     `docs/PROJECT_BRIEF.md`: a visitor must be able to sign up, confirm, and
 *     only then sign in.
 *   * **Registration cannot be used to enumerate accounts.** Supabase answers a
 *     duplicate signup by returning a user with no identities and no error, so an
 *     already-registered address is reported exactly like a fresh one.
 */
export async function signUpAction(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!isSupabaseConfigured()) {
    return { status: "unconfigured" };
  }

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "signup"), {
    limit: 5,
    windowSeconds: 900,
  });
  if (!limit.allowed) {
    return { status: "rate_limited" };
  }

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    accountType: formData.get("accountType"),
    dateOfBirth: formData.get("dateOfBirth"),
    phone: formData.get("phone"),
    // A radio group sends the chosen value or nothing at all; an unanswered
    // question stays undefined and is stored as null rather than as a "yes".
    permanentResidency: formData.get("permanentResidency") ?? undefined,
    // An unchecked box is absent from the payload, which `z.literal(true)`
    // rejects — the correct outcome, since consent is a precondition.
    acceptPrivacy: formData.get("acceptPrivacy") === "on" ? true : undefined,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] as string) ?? "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "error", errors };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // `full_name` is read by `handle_new_user` for the profile row. It is
      // presentation data, not an authorization input.
      //
      // `account_type` and `date_of_birth` are recorded on the profile as a
      // DECLARATION. `handle_new_user` never reads a `role` key — that is the
      // escalation migration 24 closed — and neither of these can grant a
      // capability: only an approved KYC application does that.
      //
      // `phone` and `permanent_residency` are the same kind of thing: profile
      // facts recorded by `handle_new_user`. The residency value is sent as the
      // string "true"/"false" so an absent answer is distinguishable from a
      // stated "no"; the trigger turns anything else into null.
      data: {
        full_name: parsed.data.fullName,
        account_type: parsed.data.accountType,
        date_of_birth: parsed.data.dateOfBirth,
        phone: parsed.data.phone,
        permanent_residency:
          parsed.data.permanentResidency === undefined
            ? undefined
            : String(parsed.data.permanentResidency),
      },
      emailRedirectTo: confirmationRedirectUrl(),
    },
  });

  if (error) {
    // A duplicate address arrives here on some configurations; reported the same
    // way as a success so the form cannot be used to test whether an email is
    // registered.
    return { status: "check_email" };
  }

  await recordAudit({
    actorId: data.user?.id ?? null,
    action: "profile_created",
    entityType: "auth",
    entityId: data.user?.id ?? null,
    metadata: { source: "self_registration" },
  });

  // No session means confirmation is required before the account can be used.
  // Supabase also returns this shape for an already-registered address, which is
  // the behaviour we want: both look identical from the outside.
  if (!data.session) {
    return { status: "check_email" };
  }

  return { status: "created" };
}

/**
 * Resend the confirmation email for an account that has not confirmed yet.
 *
 * Rate limited hard: this sends mail, so it is a spam vector as much as an auth
 * path. The response is identical whether or not the address exists.
 */
export async function resendConfirmationAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "resend-confirm"), {
    limit: 3,
    windowSeconds: 900,
  });
  if (!limit.allowed) return { status: "rate_limited" };

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", messageKey: "auth.invalidEmail" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: confirmationRedirectUrl() },
  });

  // Always the same answer, so it cannot be used to test for an account.
  return { status: "sent" };
}

/**
 * Request a password-reset email.
 *
 * The response is always `sent`, whether or not the address exists, so the form
 * cannot be used to discover which emails have accounts. Supabase itself does not
 * create an account here; it emails a recovery link to an existing one.
 */
export async function forgotPasswordAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "forgot-password"), {
    limit: 3,
    windowSeconds: 900,
  });
  if (!limit.allowed) return { status: "rate_limited" };

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", messageKey: "auth.invalidEmail" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await recoveryRedirectUrl(),
  });

  return { status: "sent" };
}

/**
 * Set a new password from a recovery link.
 *
 * Requires the session that the recovery link established via `/auth/callback`.
 * Without it Supabase refuses the update, so a visitor who guesses this URL
 * changes nothing. The new password is the only value accepted; the email is not
 * re-read, because a recovery flow that could be pointed at another address would
 * be an account-takeover primitive.
 */
export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "reset-password"), {
    limit: 10,
    windowSeconds: 900,
  });
  if (!limit.allowed) return { status: "rate_limited" };

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] as string) ?? "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "error", errors };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No recovery session: the link was not followed, or it expired. Nothing is
    // written, and the caller is told to request a new link rather than shown a
    // success it did not achieve.
    return { status: "error", errors: { form: "recoverySessionMissing" } };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", errors: { form: "errorBody" } };
  }

  await recordAudit({
    actorId: user.id,
    action: "password_changed",
    entityType: "auth",
    entityId: user.id,
    metadata: { source: "recovery" },
  });

  return { status: "updated" };
}

/**
 * Start a social sign-in.
 *
 * Only a provider that still uses the server-side redirect may reach this
 * action: `isServerOAuthProvider` narrows to Facebook, and the enabled list is
 * checked as well. Both matter: the first stops an arbitrary provider name (or a
 * Google redirect the UI no longer offers) reaching Supabase, and the second
 * stops a button for an unconfigured provider being reachable by a crafted POST
 * even though it is not rendered.
 *
 * A Server Action rather than a client call to `supabase.auth.signInWithOAuth`,
 * because the allow-list decision must not live in the browser. `signInWithOAuth`
 * returns an authorization URL instead of navigating, so the redirect is issued
 * here and the browser follows it.
 *
 * The redirect carries the locale and an optional validated `next`, so a French
 * visitor comes back to French and a visitor who was heading somewhere specific
 * is not dropped on the account hub. `/auth/callback` decides the destination
 * once it can see whether the account still owes us its declarations.
 */
export async function signInWithOAuthProviderAction(
  formData: FormData,
): Promise<void> {
  const requested = formData.get("provider");
  const localeValue = formData.get("locale");
  const nextParsed = safeRedirectPathSchema.safeParse(formData.get("next"));
  const next = nextParsed.success ? nextParsed.data : undefined;

  // Resolve the locale first: every failure below redirects back to the sign-in
  // page, and a French visitor should not be bounced into the English one.
  const safeLocale = localeValue === "fr" ? "fr" : "en";
  const signInHref = `/${safeLocale}/login`;

  if (!isSupabaseConfigured()) {
    redirect(`${signInHref}?reason=unconfigured`);
  }

  // Both Google and Facebook use Supabase's server-side OAuth redirect. The
  // provider list is the single `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` gate; the
  // provider client IDs and secrets live in the Supabase dashboard.
  if (
    !isServerOAuthProvider(requested) ||
    !enabledOAuthProviders().includes(requested)
  ) {
    redirect(`${signInHref}?reason=oauth_unavailable`);
  }

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "oauth"), {
    limit: 20,
    windowSeconds: 300,
  });
  if (!limit.allowed) {
    redirect(`${signInHref}?reason=rate_limited`);
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect(`${signInHref}?reason=unconfigured`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: requested,
    options: {
      redirectTo: oauthCallbackUrl(getSiteUrl(), safeLocale, next),
      // The action runs on the server, so it returns the provider URL and lets
      // Next.js perform the redirect instead of the browser client.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    redirect(`${signInHref}?reason=oauth_failed`);
  }

  redirect(data.url);
}

/**
 * Complete the declarations an OAuth account still owes us.
 *
 * A social sign-in never asks for a role or a residency, because
 * `signInWithOAuth` accepts no metadata payload —
 * `handle_new_user` provisions the profile as `customer` with
 * `declared_account_type` null. This writes those two facts afterwards, so an
 * OAuth account ends up indistinguishable from a password account that answered
 * the same questions.
 *
 * The write goes through the **session** client, so `profiles_update_own` is the
 * control: it pins `role` to its stored value, which is what keeps this from
 * becoming a privilege-escalation path. `declared_account_type` is a declaration
 * and no policy reads it as a permission; a landlord or agent still has to pass
 * KYC before publishing anything.
 *
 * A profile that has already declared is not overwritten: the redirect to the
 * account hub happens first, so a second submission cannot rewrite a declaration
 * a person made earlier.
 */
export async function completeOAuthOnboardingAction(
  _previous: OAuthOnboardingState,
  formData: FormData,
): Promise<OAuthOnboardingState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const requestHeaders = await headers();
  const limit = checkRateLimit(clientKeyFrom(requestHeaders, "onboarding"), {
    limit: 10,
    windowSeconds: 900,
  });
  if (!limit.allowed) return { status: "rate_limited" };

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const parsed = oauthOnboardingSchema.safeParse({
    accountType: formData.get("accountType"),
    permanentResidency: formData.get("permanentResidency"),
    phone: formData.get("phone") ?? undefined,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] as string) ?? "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "error", errors };
  }

  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      declared_account_type: parsed.data.accountType,
      permanent_residency: parsed.data.permanentResidency === "true",
      ...(phone ? { phone } : {}),
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", errors: { form: "write_failed" } };
  }

  await recordAudit({
    actorId: user.id,
    action: "profile_updated",
    entityType: "auth",
    entityId: user.id,
    metadata: { source: "oauth_onboarding" },
  });

  const localeCookie = (await cookies()).get("kc_locale")?.value;
  redirect(`/${localeCookie === "fr" ? "fr" : "en"}/account`);
}
