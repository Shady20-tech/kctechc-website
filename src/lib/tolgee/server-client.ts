import "server-only";

import { serverEnv } from "@/lib/config/server-env";
import { publicEnv } from "@/lib/config/env";

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
  return serverEnv.tolgeeApiKey !== null && publicEnv.tolgeeProjectId !== "";
}

type TolgeeConfig = {
  baseUrl: string;
  projectId: string;
  apiKey: string;
};

function getConfig(): TolgeeConfig | null {
  if (!isTolgeeSyncConfigured()) return null;
  return {
    baseUrl: publicEnv.tolgeeApiUrl.replace(/\/$/, ""),
    projectId: publicEnv.tolgeeProjectId,
    apiKey: serverEnv.tolgeeApiKey as string,
  };
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
function classifyFailure(status: number): { message: string; retryable: boolean } {
  if (status === 429) {
    return { message: "Tolgee rate limit reached", retryable: true };
  }
  if (status >= 500) {
    return { message: `Tolgee server error (${status})`, retryable: true };
  }
  if (status === 401 || status === 403) {
    return {
      message: "Tolgee rejected the project API key",
      retryable: false,
    };
  }
  if (status === 404) {
    return { message: "Tolgee project or endpoint not found", retryable: false };
  }
  return { message: `Tolgee request failed (${status})`, retryable: false };
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
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method,
      headers: {
        // The documented header. The `ak` query parameter is deliberately not
        // used: it leaks the key into server access logs.
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // A hung Tolgee must not hold a worker open indefinitely.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      const { message, retryable } = classifyFailure(response.status);
      return { ok: false, error: message, retryable };
    }

    // Some endpoints answer 200/201 with an empty body.
    const text = await response.text();
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Tolgee transport error";
    // A timeout or a network failure is transient by nature.
    return { ok: false, error: message, retryable: true };
  }
}

export type TolgeeKeyResponse = {
  id?: number;
  name?: string;
};

/**
 * Create a key or update its translations.
 *
 * This is Tolgee's `POST /v2/projects/{projectId}/translations`: it creates the
 * key if it does not exist and sets the supplied translations if it does. That
 * upsert semantics is exactly what makes the workflow idempotent — pushing the
 * same key twice updates one key rather than creating a second.
 *
 * The body carries both locales in one call. Sending the English source and the
 * French value together means a key never exists in Tolgee with only one language
 * populated, which would leave a translator with nothing to translate from.
 */
export async function pushTranslation(input: {
  key: string;
  translations: Record<string, string>;
  /** Marks the key's context in the Tolgee UI so a translator knows where it lives. */
  description?: string;
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
        ...(input.description ? { description: input.description } : {}),
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
