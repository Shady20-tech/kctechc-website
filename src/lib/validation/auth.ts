import { z } from "zod";
import { ACCOUNT_TYPES, accountTypeRequiresKyc, isOldEnoughToApply } from "@/lib/real-estate/kyc";
import { emailSchema, safeRedirectPathSchema } from "./common";

// The field-to-message-key maps live in a dependency-free module because the
// auth forms are Client Components; importing them from here would pull Zod
// into the browser bundle, where Zod's JIT probe (`Function("")`) trips the
// CSP eval check. Re-exported so server-side importers keep their path.
export {
  OAUTH_ONBOARDING_ERROR_KEYS,
  RESET_PASSWORD_ERROR_KEYS,
  SIGN_UP_ERROR_KEYS,
  type OAuthOnboardingFieldErrors,
  type ResetPasswordFieldErrors,
  type SignUpFieldErrors,
} from "./auth-error-keys";

/** Credentials accepted by the sign-in Server Action. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  next: safeRedirectPathSchema.optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Password policy for account creation and recovery.
 *
 * Enforced before `verifyOtp` in the reset flow: a recovery OTP is single-use,
 * so if Supabase rejects a weak password after the code has been verified the
 * visitor cannot retry with the same code. Sign-in deliberately keeps the looser
 * minimum so an account created under an older policy can still authenticate.
 */
export const passwordSchema = z
  .string()
  .min(8)
  .max(200)
  .refine(
    (value) =>
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9]/.test(value),
    { message: "passwordPolicy" },
  );

/**
 * Self-registration payload.
 *
 * Role is never accepted from the client: `handle_new_user` provisions every
 * account as `customer` regardless of what is submitted, and there is no field
 * here to carry one. Nor is `confirmPassword` sent to Supabase — it exists only
 * so the form can prove the two entries match before an account is created, and
 * validating it here rather than in the component means a mismatch cannot be
 * bypassed by posting the form directly.
 *
 * `accountType` is the brief's requirement 2.1: the user chooses Buyer /
 * Property Seeker, Landlord / Property Owner, or Real Estate Agent. It is a
 * DECLARATION, not a capability — `handle_new_user` stores it on the profile and
 * nothing reads it as a permission. A landlord or agent declaration routes the
 * user to a KYC application; it never grants one.
 *
 * `acceptPrivacy` is `z.literal(true)`: agreeing is a precondition of creating
 * the account, so a missing or unchecked value must fail validation rather than
 * being treated as an optional courtesy.
 *
 * `dateOfBirth` is required, because an adult-only rule has to be checked before
 * a person declares an intent to publish property. The 18+ rule itself is NOT
 * enforced here — a buyer account carries no age requirement, and the form
 * applies the age check only when the chosen account type is a capability one.
 * The authoritative check is the KYC application's CHECK constraint.
 *
 * `phone` and `permanentResidency` are the two fields the brief asks for at
 * sign-up. The phone is a required international-format number (the same rule the
 * account-page form applies, and the database's `profiles_phone_format` CHECK);
 * the residency declaration is a boolean stored as `true`/`false`, with a blank
 * selection normalised to `undefined` so an unanswered question is stored as null
 * rather than as a fabricated "yes".
 */
export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
    accountType: z.enum(ACCOUNT_TYPES),
    dateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate")
      .refine((value) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
      }, "invalidDate"),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+ ()./-]{5,32}$/, "invalidPhone"),
    // The form sends the string "true" / "false", or nothing at all. Anything
    // else — including an absent field — is "not stated" (undefined), which the
    // action stores as null. `z.enum` on the strings keeps a junk value out.
    permanentResidency: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      ),
    acceptPrivacy: z.literal(true, { message: "privacyRequired" }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  })
  .refine(
    (value) =>
      !accountTypeRequiresKyc(value.accountType) ||
      isOldEnoughToApply(value.dateOfBirth),
    { message: "underage", path: ["dateOfBirth"] },
  );

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * The address Supabase should look up for a recovery code.
 *
 * Supabase stores emails lowercased and issues the recovery token for that exact
 * address. Trimming and lowercasing here keeps `resetPasswordForEmail` and
 * `verifyOtp` in step even if the visitor typed capitals or copied a trailing
 * space; a mismatch surfaces as "Token has expired or is invalid" immediately.
 */
const recoveryEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(emailSchema);

/** Request a password-reset email. */
export const forgotPasswordSchema = z.object({
  email: recoveryEmailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Set a new password from a 6-digit email recovery code.
 *
 * The same confirmation rule as sign-up, for the same reason: a mistyped
 * password on this form locks the account out until another reset, so the match
 * is enforced on the server rather than trusted from the browser.
 *
 * `token` is the 6-digit OTP from the Supabase "Reset Password" email. The email
 * must use the `{{ .Token }}` variable; this flow does not use a clickable link.
 * The email is trimmed and lowercased before it reaches Supabase: `verifyOtp`
 * matches the exact address the recovery token was issued for.
 */
export const resetPasswordSchema = z
  .object({
    email: recoveryEmailSchema,
    token: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "otpInvalid"),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Sign-in outcome.
 *
 * `email_unconfirmed` is a distinct state rather than a generic failure so the
 * page can offer to resend the confirmation instead of leaving the customer
 * stuck. It does reveal that an account exists in an unconfirmed state, which is
 * a deliberate trade: without it the only honest message is "those details were
 * not recognised", which sends a customer who simply never clicked the link on a
 * loop with no way out. GitHub and Slack make the same trade.
 *
 * A wrong password and an unknown account both return the generic `invalid`
 * state, so neither can be used to enumerate confirmed accounts.
 */
export type SignInState =
  | { status: "idle" }
  | { status: "error"; messageKey: string }
  | { status: "email_unconfirmed"; email: string }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

/** Sign-up outcome. `check_email` means confirmation is required before sign-in. */
export type SignUpState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string> }
  | { status: "check_email" }
  | { status: "created" }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

/**
 * The declarations an OAuth account still owes us.
 *
 * A social sign-in creates the account without asking anything: neither
 * `signInWithOAuth` nor `signInWithIdToken` accepts a metadata payload, so
 * `handle_new_user` provisions the profile with `declared_account_type` null.
 * This schema collects the two facts the password form already collects — the
 * role the person is signing up as and their residency — so both paths end in
 * the same place.
 *
 * Nothing here is an authorization input. The declaration is stored on the
 * profile; only an approved KYC application grants a capability, exactly as for a
 * password sign-up. There is deliberately no `role` field to post.
 *
 * `permanentResidency` is required here, unlike on the password form. The form
 * asks it as an explicit yes/no and the onboarding step exists precisely to
 * collect these answers, so "not stated" would mean the step did nothing.
 */
export const oauthOnboardingSchema = z.object({
  accountType: z.enum(ACCOUNT_TYPES, { message: "invalidAccountType" }),
  permanentResidency: z.enum(["true", "false"], {
    message: "residencyRequired",
  }),
  // Optional because a social provider may not supply one, and the account page
  // already collects it later. A blank string is "not given", not an error.
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[0-9+ ()./-]{5,32}$/.test(value),
      "invalidPhone",
    )
    .optional(),
});

export type OAuthOnboardingInput = z.infer<typeof oauthOnboardingSchema>;

/** Outcome of completing the OAuth declarations. */
export type OAuthOnboardingState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string> }
  | { status: "rate_limited" }
  | { status: "unauthenticated" }
  | { status: "unconfigured" };

/** Forgot-password outcome. `sent` is returned whether or not the account exists. */
export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "error"; messageKey: string }
  | { status: "sent" }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

/**
 * Diagnostic details for a failed reset step.
 *
 * Deliberately contains no token, password or email; it is returned to the form
 * so the browser console can show the Supabase status and error code alongside
 * the server log. The message is the provider's own wording.
 */
export type ResetPasswordDebug = {
  step: "verifyOtp" | "updateUser";
  status?: number;
  code?: string;
  message?: string;
};

/** Reset-password outcome. */
export type ResetPasswordState =
  | { status: "idle" }
  | {
      status: "error";
      errors: Record<string, string>;
      debug?: ResetPasswordDebug;
    }
  | { status: "updated" }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

