/**
 * Map a `delete_content_permanently` failure to a message key.
 *
 * The database is the boundary, so its messages are the only reliable signal of
 * *why* a delete was refused. In particular, an old database that has not applied
 * the department-editor migration answers with the former super-admin-only text;
 * reporting that as a generic write failure sends the operator to retry an action
 * that cannot succeed until the migration is applied.
 */
export type ContentDeletionErrorKey =
  | "forbidden"
  | "migration_pending"
  | "not_found"
  | "reason_required"
  | "write_failed";

export function contentDeletionErrorKey(
  message: string | null | undefined,
): ContentDeletionErrorKey {
  const text = message ?? "";
  if (text.includes("at least 10 characters")) return "reason_required";
  if (text.includes("Unknown ")) return "not_found";
  if (
    text.includes("Only a super administrator may permanently delete content")
  ) {
    return "migration_pending";
  }
  if (text.includes("permission denied for function"))
    return "migration_pending";
  if (text.includes("department editor")) return "forbidden";
  return "write_failed";
}
