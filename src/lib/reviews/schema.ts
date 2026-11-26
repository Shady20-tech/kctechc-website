import { z } from "zod";

import {
  MODERATOR_DECISIONS,
  REVIEW_MAX_BODY,
  REVIEW_MAX_NAME,
  REVIEW_MAX_TITLE,
  REVIEW_MIN_BODY,
} from "./types";

/**
 * Review submission and moderation schemas.
 *
 * Validated server-side before any write, per the project rule. The database
 * carries the same limits as CHECK constraints, so this is the message layer
 * rather than the only control.
 */

/**
 * The review a customer submits.
 *
 * `status` is deliberately absent. A submission is always pending, and the
 * database policy forces that; accepting a status here would invite a caller to
 * try to post an approved review.
 *
 * Consent is `z.literal(true)` rather than a boolean: an unchecked box is absent
 * from the payload, and the correct outcome for an absent consent is refusal, not
 * "false". The database has the matching `reviews_publish_requires_consent`.
 */
export const reviewSubmissionSchema = z.object({
  rating: z.coerce
    .number()
    .int("Choose a rating from 1 to 5.")
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  authorName: z
    .string()
    .trim()
    .min(1, "Tell us the name to show with your review.")
    .max(REVIEW_MAX_NAME),
  title: z.string().trim().max(REVIEW_MAX_TITLE).optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(REVIEW_MIN_BODY, "Please write at least a sentence.")
    .max(REVIEW_MAX_BODY),
  departmentSlug: z.string().trim().max(60).optional().or(z.literal("")),
  publishConsent: z.literal(true, {
    message: "Please agree to your review being published.",
  }),
});

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

/**
 * A moderator's decision.
 *
 * `note` is optional here and required by `decisionRequiresNote` for the two
 * refusal outcomes, checked in the action so the message names the reason. The
 * database enforces the same rule.
 */
export const reviewDecisionSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(MODERATOR_DECISIONS),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
