import { z } from "zod";
import { emailSchema, safeRedirectPathSchema } from "./common";

/** Credentials accepted by the sign-in Server Action. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  next: safeRedirectPathSchema.optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** Self-registration payload. Role is never accepted from the client. */
export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  fullName: z.string().min(1).max(200),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export type SignInState =
  | { status: "idle" }
  | { status: "error"; messageKey: string }
  | { status: "unconfigured" };
