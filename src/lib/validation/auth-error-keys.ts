/**
 * Field-to-message-key maps for the auth forms.
 *
 * These live in their own module, with no imports, because the forms that
 * consume them are Client Components. Importing them from `validation/auth.ts`
 * pulled Zod into the browser bundle: that module imports `zod` for its
 * schemas, and a Client Component that needs a runtime value (not just a type,
 * which is erased) drags the whole dependency with it.
 *
 * Zod 4 probes for JIT support with `Function("")` inside a try/catch. Under the
 * site's CSP (`script-src 'self' 'unsafe-inline'`, no `unsafe-eval`) the browser
 * reports that as an `eval` violation, which Lighthouse surfaces through
 * `inspector-issues` and which dropped `/en/sign-up` to a Best Practices
 * score of 96. Sign-in was unaffected because it imports only types from the
 * same module, and types leave no runtime trace.
 *
 * The same reasoning is why the upload byte limits live in
 * `src/lib/uploads/limits.ts`: a value shared with a Client Component belongs
 * in a leaf module. `validation/auth.ts` re-exports these so server-side
 * importers are unchanged.
 */

/**
 * Maps a sign-up field to its message key. Kept beside the schema so a new field
 * cannot be added without a decision about how to explain it.
 */
export const SIGN_UP_ERROR_KEYS = {
  fullName: "errFullName",
  email: "errEmail",
  password: "errPassword",
  confirmPassword: "errConfirmPassword",
  accountType: "errAccountType",
  dateOfBirth: "errDateOfBirth",
  phone: "errPhone",
  permanentResidency: "errPermanentResidency",
  acceptPrivacy: "errPrivacy",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type SignUpFieldErrors = Partial<
  Record<keyof typeof SIGN_UP_ERROR_KEYS, string>
>;

/** Maps a reset-password field to its message key. */
export const RESET_PASSWORD_ERROR_KEYS = {
  email: "invalidEmail",
  token: "errOtp",
  password: "errPassword",
  confirmPassword: "errConfirmPassword",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type ResetPasswordFieldErrors = Partial<
  Record<keyof typeof RESET_PASSWORD_ERROR_KEYS, string>
>;

/** Maps an OAuth onboarding field to its message key. */
export const OAUTH_ONBOARDING_ERROR_KEYS = {
  accountType: "errAccountType",
  permanentResidency: "errPermanentResidency",
  phone: "errPhone",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type OAuthOnboardingFieldErrors = Partial<
  Record<keyof typeof OAUTH_ONBOARDING_ERROR_KEYS, string>
>;
