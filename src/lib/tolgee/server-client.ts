import "server-only";

import { serverEnv } from "@/lib/config/server-env";
import { publicEnv } from "@/lib/config/env";
import { normalizeTolgeeApiUrl } from "@/lib/tolgee/url";

/**
 * Tolgee server-side client.
 *
 * `import "server-only"` is the guard that keeps the project API key out of
 * client bundles: importing this module from a Client Component is a build error,
 * which is stronger than a convention that a reviewer has to notice.
 *
 * Only the endpoints the sync workflow needs are implemented. Each returns a
 * discriminated result rather than throwing, because a Tolgee outage must be
 * recorded as a retryable sync failure and must never propagate as an exception
 * that could roll back a valid product write.
 */

export type TolgeeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

export function isTolgeeSyncConfigured(): boolean {
  return serverEnv.tolgeeApiKey !== null && getProjectId() !== "";
}

type TolgeeConfig = {
  baseUrl: string;
  projectId: string;
  apiKey: string;
};

function getProjectId(): string {
  return (serverEnv.tolgeeProjectId ?? publicEnv.tolgeeProjectId ?? "").trim();
}

function getConfig(): TolgeeConfig | null {
  if (!isTolgeeSyncConfigured()) return null;
  return {
    // A server-only URL is authoritative when present: the public value always
    // has a default, so treating it as "configured" would hide the override.
    baseUrl: normalizeTolgeeApiUrl(
      serverEnv.tolgeeApiUrl ?? publicEnv.tolgeeApiUrl,
    ),
    projectId: getProjectId(),
    apiKey: serverEnv.tolgeeApiKey as string,
  };
}

function apiKeyKind(apiKey: string): string {
  if (apiKey.startsWith("tgpak_")) return "project_api_key";
  if (apiKey.startsWith("tgpat_")) return "personal_access_token";
  if (apiKey.startsWith("eyJ")) return "legacy_jwt";
  return "unknown";
}

/**
 * Turn Tolgee's error payload into a readable reason.
 *
 * Tolgee answers failures with `{ "code": "...", "params": [...] }` (and some
 * proxies with `message` or `error`). The HTTP status alone cannot distinguish an
 * expired key from a missing translation scope or a rejected DTO, so both the log
 * and the returned error carry the body's code and parameters.
 */
function describeResponseBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const code =
        typeof record.code === "string" ? record.code.trim() : undefined;
      const message =
        typeof record.message === "string"
          ? record.message.trim()
          : typeof record.error === "string"
            ? record.error.trim()
            : undefined;
      const params =
        record.params === undefined || record.params === null
          ? undefined
          : JSON.stringify(record.params);
      const parts = [
        code || undefined,
        message || undefined,
        params ? `params=${params}` : undefined,
      ].filter((part): part is string => Boolean(part));
      if (parts.length > 0) return parts.join(": ");
    }
  } catch {
    // Not JSON (a proxy HTML page, for example); use the text below.
  }

  return trimmed.slice(0, 1000);
}

function withDetail(base: string, detail: string): string {
  return detail ? `${base}: ${detail}` : base;
}

/**
 * Classify a failed request.
 *
 * A 4xx other than 429 is the caller's problem — a malformed key, a missing
 * language, a bad API key — and retrying it unchanged will fail identically
 * forever. Only 429 and 5xx (and network failures) are worth another attempt.
 * Recording that distinction is what stops the queue from burning all its
 * attempts on an error that will never succeed.
 */
function classifyFailure(
  status: number,
  requestUrl: string,
  responseBody: string,
): { message: string; retryable: boolean } {
  const detail = describeResponseBody(responseBody);

  if (status === 429) {
    return {
      message: withDetail("Tolgee rate limit reached", detail),
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      message: withDetail(`Tolgee server error (${status})`, detail),
      retryable: true,
    };
  }
  if (status === 401 || status === 403) {
    return {
      message: withDetail(
        "Tolgee rejected the API key or personal access token",
        detail,
      ),
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      message: withDetail(
        `Tolgee project or endpoint not found (404) at ${requestUrl}`,
        detail,
      ),
      retryable: false,
    };
  }
  return {
    message: withDetail(`Tolgee request failed (${status})`, detail),
    retryable: false,
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<TolgeeResult<T>> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      error: "Tolgee is not configured (missing project id or API key)",
      retryable: false,
    };
  }

  try {
    const requestUrl = `${config.baseUrl}${path}`;
    const response = await fetch(requestUrl, {
      method: init.method,
      headers: {
        // Both Project API keys (`tgpak_...`) and Personal Access Tokens
        // (`tgpat_...`) authenticate with this header. The `ak` query parameter
        // is deliberately not used: it leaks the key into server access logs.
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // A hung Tolgee must not hold a worker open indefinitely.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      const { message, retryable } = classifyFailure(
        response.status,
        requestUrl,
        text,
      );
      // A 404 is almost always a base URL or project id problem, and the
      // generic status hides which one. Log the exact URL, the status, the
      // project id, the credential kind (never the secret) and Tolgee's response
      // body so the next failure is diagnosable from the deployment logs.
      console.error("[tolgee] request failed", {
        method: init.method,
        url: requestUrl,
        status: response.status,
        projectId: config.projectId,
        apiKeyKind: apiKeyKind(config.apiKey),
        responseBody: text.slice(0, 2000),
        error: message,
      });
      return { ok: false, error: message, retryable };
    }

    // Some endpoints answer 200/201 with an empty body.
    if (!text) return { ok: true, data: {} as T };

    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return {
        ok: false,
        error: `Tolgee returned a non-JSON response: ${text.slice(0, 500)}`,
        retryable: true,
      };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Tolgee transport error";
    // A timeout or a network failure is transient by nature.
    return { ok: false, error: message, retryable: true };
  }
}

/**
 * The `SetTranslationsResponseModel` Tolgee returns for a successful upsert.
 *
 * `keyId`/`keyName` are the v2 names; the older `id`/`name` shape was wrong and
 * meant a successfully synced key never recorded its Tolgee id.
 */
export type TolgeeKeyResponse = {
  keyId?: number;
  keyName?: string;
  keyNamespace?: string;
  keyIsPlural?: boolean;
  translations?: Record<string, { id?: number; text?: string }>;
};

/**
 * Create a key or update its translations.
 *
 * This is Tolgee's `POST /v2/projects/{projectId}/translations`
 * (`createOrUpdateTranslations`). Its body is `{ key, translations }` — the
 * `SetTranslationsWithKeyDto` schema — and it creates the key if it does not
 * exist and sets the supplied translations if it does. That upsert semantics is
 * exactly what makes the workflow idempotent: pushing the same key twice updates
 * one key rather than creating a second.
 *
 * The body carries both locales in one call. Sending the English source and the
 * French value together means a key never exists in Tolgee with only one language
 * populated, which would leave a translator with nothing to translate from.
 */
export async function pushTranslation(input: {
  key: string;
  translations: Record<string, string>;
}): Promise<TolgeeResult<TolgeeKeyResponse>> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      error: "Tolgee is not configured (missing project id or API key)",
      retryable: false,
    };
  }

  return request<TolgeeKeyResponse>(
    `/v2/projects/${encodeURIComponent(config.projectId)}/translations`,
    {
      method: "POST",
      body: {
        key: input.key,
        translations: input.translations,
      },
    },
  );
}

/**
 * Read one key's translations.
 *
 * Used to decide whether a French translation already exists, so the sync can
 * leave a human's work alone rather than overwriting it with the source text.
 */
export async function fetchTranslation(input: {
  key: string;
}): Promise<TolgeeResult<{ translations?: Record<string, string> }>> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      error: "Tolgee is not configured (missing project id or API key)",
      retryable: false,
    };
  }

  const params = new URLSearchParams({ filterKeyName: input.key });
  return request(
    `/v2/projects/${encodeURIComponent(config.projectId)}/translations?${params}`,
    { method: "GET" },
  );
}
