import { z } from "zod";
import { emailSchema, safeRedirectPathSchema } from "./common";

/** Credentials accepted by the sign-in Server Action. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  next: safeRedirectPathSchema.optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

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
 * `acceptPrivacy` is `z.literal(true)`: agreeing is a precondition of creating
 * the account, so a missing or unchecked value must fail validation rather than
 * being treated as an optional courtesy.
 */
export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: emailSchema,
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
    acceptPrivacy: z.literal(true, { message: "privacyRequired" }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

/** Request a password-reset email. */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Set a new password from a recovery link.
 *
 * The same confirmation rule as sign-up, for the same reason: a mistyped
 * password on this form locks the account out until another reset, so the match
 * is enforced on the server rather than trusted from the browser.
 */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
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
 * Maps a sign-up field to its message key. Kept beside the schema so a new field
 * cannot be added without a decision about how to explain it.
 */
export const SIGN_UP_ERROR_KEYS = {
  fullName: "errFullName",
  email: "errEmail",
  password: "errPassword",
  confirmPassword: "errConfirmPassword",
  acceptPrivacy: "errPrivacy",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type SignUpFieldErrors = Partial<
  Record<keyof typeof SIGN_UP_ERROR_KEYS, string>
>;

/** Forgot-password outcome. `sent` is returned whether or not the account exists. */
export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "error"; messageKey: string }
  | { status: "sent" }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

/** Reset-password outcome. */
export type ResetPasswordState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string> }
  | { status: "updated" }
  | { status: "rate_limited" }
  | { status: "unconfigured" };

export const RESET_PASSWORD_ERROR_KEYS = {
  password: "errPassword",
  confirmPassword: "errConfirmPassword",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type ResetPasswordFieldErrors = Partial<
  Record<keyof typeof RESET_PASSWORD_ERROR_KEYS, string>
>;
