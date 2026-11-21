import { describe, expect, it } from "vitest";

import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteOwnAccountSchema,
  deleteUserAccountSchema,
} from "./account-deletion";

/**
 * The confirmation contract.
 *
 * Deletion is irreversible, so the guards that stop an accidental submission are
 * worth pinning: a lower-case phrase, a padded phrase and an empty phrase are
 * each a different way to almost-delete an account by mistake.
 */

describe("deleteOwnAccountSchema", () => {
  it("accepts the exact confirmation phrase", () => {
    const result = deleteOwnAccountSchema.safeParse({
      confirmation: DELETE_ACCOUNT_CONFIRMATION,
    });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    // A trailing space from a mobile keyboard is not a different intent.
    const result = deleteOwnAccountSchema.safeParse({
      confirmation: `  ${DELETE_ACCOUNT_CONFIRMATION}  `,
    });
    expect(result.success).toBe(true);
  });

  it("refuses a lower-case phrase", () => {
    // Case-sensitive on purpose: the point is a deliberate act, and accepting
    // "delete" would also accept a sentence that merely contains the word.
    const result = deleteOwnAccountSchema.safeParse({ confirmation: "delete" });
    expect(result.success).toBe(false);
  });

  it("refuses an empty or unrelated value", () => {
    expect(deleteOwnAccountSchema.safeParse({ confirmation: "" }).success).toBe(
      false,
    );
    expect(
      deleteOwnAccountSchema.safeParse({ confirmation: "yes" }).success,
    ).toBe(false);
  });

  it("reports the stable code the form maps to a message", () => {
    const result = deleteOwnAccountSchema.safeParse({ confirmation: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("confirmation_mismatch");
    }
  });
});

describe("deleteUserAccountSchema", () => {
  const profileId = "11111111-1111-4111-8111-111111111111";

  it("accepts a substantive reason", () => {
    const result = deleteUserAccountSchema.safeParse({
      profileId,
      reason: "Customer requested erasure of their account and data.",
    });
    expect(result.success).toBe(true);
  });

  it("requires a UUID, so a crafted id is refused before any query", () => {
    const result = deleteUserAccountSchema.safeParse({
      profileId: "not-a-uuid",
      reason: "A perfectly good reason for deleting this account.",
    });
    expect(result.success).toBe(false);
  });

  it("requires a reason of at least ten characters", () => {
    const result = deleteUserAccountSchema.safeParse({
      profileId,
      reason: "too short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("reason_too_short");
    }
  });

  it("caps the reason so it cannot become a payload", () => {
    const result = deleteUserAccountSchema.safeParse({
      profileId,
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
