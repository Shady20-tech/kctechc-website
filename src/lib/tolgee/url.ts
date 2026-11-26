const DEFAULT_TOLGEE_API_URL = "https://app.tolgee.io";

/**
 * Normalize a Tolgee API base URL to its origin.
 *
 * Tolgee Cloud's REST API always lives at the origin; every request already
 * appends `/v2/...`. Operators paste the project URL or a docs URL by mistake, so
 * any path (`/v2`, `/projects/35323`, a self-hosted prefix) is discarded rather
 * than concatenated into `/v2/v2/...`. Query strings and fragments are dropped for
 * the same reason.
 *
 * A self-hosted installation mounted under a subpath is not supported by this
 * origin-only rule; point `TOLGEE_API_URL` at the host that serves `/v2`.
 */
export function normalizeTolgeeApiUrl(value?: string | null): string {
  const candidate =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : DEFAULT_TOLGEE_API_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_TOLGEE_API_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_TOLGEE_API_URL;
  }
}

export { DEFAULT_TOLGEE_API_URL };
