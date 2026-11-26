"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, getSiteUrl } from "@/lib/config/env";
import {
  confirmationRedirectUrl,
  postSignInPathFor,
} from "@/lib/auth/redirects";
import {
  enabledOAuthProviders,
  isServerOAuthProvider,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";
import { resolvePostAuthPath } from "@/lib/auth/post-auth";
import { getAuthState } from "@/lib/auth/session";
import { DEFAULT_ROLE, isAppRole } from "@/lib/auth/roles";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
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
 * Request a password-reset code.
 *
 * Sends the Supabase "Reset Password" email, which must contain the
 * `{{ .Token }}` 6-digit code. No `redirectTo` is passed: the flow does not
 * depend on a clickable link. A non-existent address must look identical to an
 * existing one, so provider errors other than rate limiting are logged and the
 * visitor still lands on the code-entry page; only our own rate limit and a
 * transport failure are shown.
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

  // Supabase looks the account up by its normalized address, and the recovery
  // token is bound to that address. Sending and redirecting with the same
  // normalized value prevents a capitals/whitespace mismatch on the next step.
  const email = parsed.data.email.trim().toLowerCase();

  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  // Do not pass `redirectTo`: the flow uses the 6-digit `{{ .Token }}` in the
  // Supabase "Reset Password" email, not a clickable recovery link. A
  // non-existent address must look identical to an existing one, so only a
  // transport failure or our own rate limit is surfaced; provider errors are
  // logged and the visitor still reaches the code-entry page.
  let requestError: {
    status?: number;
    code?: string;
    message?: string;
  } | null = null;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    requestError = error;
  } catch (error) {
    console.error("[forgot-password] resetPasswordForEmail threw", error);
    return { status: "error", messageKey: "auth.errorBody" };
  }

  if (
    requestError &&
    (requestError.status === 429 ||
      requestError.code === "over_email_send_rate_limit")
  ) {
    return { status: "rate_limited" };
  }
  if (requestError) {
    console.error("[forgot-password] resetPasswordForEmail failed", {
      status: requestError.status,
      code: requestError.code,
      message: requestError.message,
      email,
    });
  }

  const localeCookie = (await cookies()).get("kc_locale")?.value;
  const locale =
    localeCookie && isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;
  redirect(`/${locale}/reset-password?email=${encodeURIComponent(email)}`);
}

/**
 * Set a new password from a 6-digit recovery OTP.
 *
 * `verifyOtp({ type: "recovery" })` creates the short-lived recovery session
 * server-side; the same request then calls `updateUser`. Neither step trusts a
 * link or a client-side session, so a guessed URL cannot change anything.
 *
 * The recovery session is signed out after the change so the redirect to
 * `/login` actually shows the sign-in form instead of bouncing an
 * already-authenticated visitor to the account hub.
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
    email: formData.get("email"),
    token: formData.get("token"),
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

  // `verifyOtp` matches the recovery token against this exact address and code.
  // Trim/lowercase the address and trim the code so a pasted value with a
  // leading/trailing space cannot produce a false "expired or invalid" result.
  const email = parsed.data.email.trim().toLowerCase();
  const token = parsed.data.token.trim();

  const { data: verifyData, error: verifyError } =
    await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });

  if (verifyError) {
    const debug = {
      step: "verifyOtp" as const,
      status: verifyError.status,
      code: verifyError.code,
      message: verifyError.message,
    };
    console.error("[reset-password] verifyOtp failed", {
      ...debug,
      email,
      tokenLength: token.length,
    });
    return { status: "error", errors: { form: "invalidOtp" }, debug };
  }

  if (!verifyData.user) {
    const debug = {
      step: "verifyOtp" as const,
      code: "no_user",
      message: "verifyOtp returned no user",
    };
    console.error("[reset-password] verifyOtp returned no user", {
      email,
      hasSession: Boolean(verifyData.session),
    });
    return { status: "error", errors: { form: "invalidOtp" }, debug };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    const debug = {
      step: "updateUser" as const,
      status: updateError.status,
      code: updateError.code,
      message: updateError.message,
    };
    console.error("[reset-password] updateUser failed", {
      ...debug,
      email,
    });
    if (updateError.code === "weak_password") {
      return {
        status: "error",
        errors: { password: "errPassword" },
        debug,
      };
    }
    return { status: "error", errors: { form: "errorBody" }, debug };
  }

  const userId = verifyData.user.id;
  await recordAudit({
    actorId: userId,
    action: "password_changed",
    entityType: "auth",
    entityId: userId,
    metadata: { source: "recovery_otp" },
  });

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("[reset-password] signOut failed", {
      status: signOutError.status,
      code: signOutError.code,
      message: signOutError.message,
    });
  }

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

  // Google normally uses Google Identity Services in the browser. It reaches
  // this action only when NEXT_PUBLIC_GOOGLE_CLIENT_ID is absent, where the UI
  // falls back to the server redirect rather than hiding the button.
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

export type OAuthCompletionState =
  | { status: "redirect"; path: string }
  | { status: "error"; messageKey: string };

/**
 * Resolve where a Google ID-token sign-in should land.
 *
 * `signInWithIdToken` runs in the browser and writes the session cookies there;
 * this action then reads the session server-side so the destination is decided by
 * the same rule `/auth/callback` uses. It returns a path instead of calling
 * `redirect()` because the caller has just finished a popup flow and needs to
 * show a failure inline if anything is wrong.
 *
 * The `next` path is validated against the open-redirect allowlist here, not in
 * the browser. An unauthenticated call is an error, not a redirect, so the
 * action cannot be used to probe destinations.
 */
export async function completeOAuthSignInAction(input: {
  locale?: string | null;
  next?: string | null;
}): Promise<OAuthCompletionState> {
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    return { status: "error", messageKey: "auth.notConfigured" };
  }
  if (state.status !== "authenticated") {
    return { status: "error", messageKey: "auth.oauthFailed" };
  }

  const locale =
    typeof input.locale === "string" && isLocale(input.locale)
      ? input.locale
      : DEFAULT_LOCALE;
  const nextParsed = safeRedirectPathSchema.safeParse(input.next);
  if (nextParsed.success) {
    return { status: "redirect", path: nextParsed.data };
  }

  const profile = state.profile
    ? {
        role: state.profile.role,
        declaredAccountType: state.profile.declaredAccountType,
      }
    : null;

  return {
    status: "redirect",
    path: resolvePostAuthPath(locale, profile),
  };
}

/**
 * Complete the declarations an OAuth account still owes us.
 *
 * A social sign-in never asks for a role or a residency, because neither
 * `signInWithOAuth` nor `signInWithIdToken` accepts a metadata payload —
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
