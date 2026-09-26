import type { ReactNode } from "react";
import { Alert, type AlertTone } from "./Alert";

/**
 * Inline notice.
 *
 * Kept as a named export because the admin surface already uses it, and
 * implemented as a thin wrapper over `Alert` so there is exactly one notice
 * component rendering in the product. `title` is optional here because notices
 * are sometimes a single sentence.
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <Alert tone={tone} title={title}>
      {children}
    </Alert>
  );
}
