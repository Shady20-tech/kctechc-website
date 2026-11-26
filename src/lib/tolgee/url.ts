const DEFAULT_TOLGEE_API_URL = "https://app.tolgee.io";

/**
 * Normalize a Tolgee API base URL.
 *
 * Operators commonly paste the API URL with a trailing slash or with the `/v2`
 * path segment that appears in Tolgee's REST examples. Both are harmless in a
 * browser address bar and fatal here, because every request already appends
 * `/v2/...`; the result is `/v2/v2/projects/...` and a 404.
 *
 * A self-hosted installation may legitimately live under a subpath, so only the
 * trailing slash and a final `/v2` are removed. Query strings and fragments are
 * dropped because they are never part of a REST base URL.
 */
export function normalizeTolgeeApiUrl(value?: string | null): string {
  const candidate =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : DEFAULT_TOLGEE_API_URL;

  try {
    const url = new URL(candidate);
    let pathname = url.pathname.replace(/\/+$/, "");
    pathname = pathname.replace(/\/v2$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_TOLGEE_API_URL;
  }
}

export { DEFAULT_TOLGEE_API_URL };
