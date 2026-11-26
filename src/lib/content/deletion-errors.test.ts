import { describe, expect, it } from "vitest";

import { contentDeletionErrorKey } from "./deletion-errors";

describe("contentDeletionErrorKey", () => {
  it("recognises a database that still has the super-admin-only function", () => {
    expect(
      contentDeletionErrorKey(
        "Only a super administrator may permanently delete content",
      ),
    ).toBe("migration_pending");
  });

  it("recognises a missing function grant", () => {
    expect(
      contentDeletionErrorKey(
        "permission denied for function delete_content_permanently",
      ),
    ).toBe("migration_pending");
  });

  it("reports a cross-department refusal as forbidden", () => {
    expect(
      contentDeletionErrorKey(
        "Only a super administrator or the department editor for this content may permanently delete it",
      ),
    ).toBe("forbidden");
  });

  it("keeps the actionable validation failures distinct", () => {
    expect(
      contentDeletionErrorKey(
        "Permanent deletion requires a reason of at least 10 characters",
      ),
    ).toBe("reason_required");
    expect(contentDeletionErrorKey('Unknown product with id "abc"')).toBe(
      "not_found",
    );
  });

  it("falls back to a retryable write failure for anything else", () => {
    expect(contentDeletionErrorKey("connection reset")).toBe("write_failed");
    expect(contentDeletionErrorKey(null)).toBe("write_failed");
  });
});
