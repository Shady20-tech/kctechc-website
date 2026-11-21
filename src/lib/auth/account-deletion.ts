import { z } from "zod";

/**
 * Account deletion rules, shared by the server actions and the forms.
 *
 * No `"use server"` directive and no server-only import: the confirmation phrase
 * is rendered in a Client Component, so it has to be readable from the browser
 * bundle. The same constant is what the action compares against, so the phrase the
 * form displays is the phrase the server requires — one source, both sides.
 */

/**
 * The phrase a user must type to confirm deletion.
 *
 * A typed phrase rather than a single "Delete" button because deletion is
 * irreversible: the account row, its memberships, KYC applications and saved
 * data are gone, and the business records that survive are detached from it. A
 * mis-click on a one-button confirmation is an unrecoverable mistake; typing a
 * word is not.
 */
export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

/**
 * The self-service deletion request.
 *
 * `confirmation` is compared case-sensitively against
 * `DELETE_ACCOUNT_CONFIRMATION`, so a lower-case "delete" is refused rather than
 * silently accepted — the point is a deliberate act, not an incidental one.
 */
export const deleteOwnAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine(
      (value) => value === DELETE_ACCOUNT_CONFIRMATION,
      "confirmation_mismatch",
    ),
});

/**
 * The administrative deletion request.
 *
 * `reason` is required and substantive, matching `delete_listing_permanently`
 * and `delete_content_permanently`: a privileged, irreversible removal with no
 * recorded justification is an audit hole.
 */
export const deleteUserAccountSchema = z.object({
  profileId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(10, "reason_too_short")
    .max(500, "reason_too_long"),
});

export type DeleteUserAccountInput = z.infer<typeof deleteUserAccountSchema>;
