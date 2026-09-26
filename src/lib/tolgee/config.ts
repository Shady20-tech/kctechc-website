import { publicEnv } from "@/lib/config/env";
import type { Locale } from "@/lib/i18n/locales";
import { STATIC_MESSAGES } from "@/lib/i18n/messages";

/**
 * Tolgee runtime configuration.
 *
 * Only the public API URL and (optionally) the project id reach the browser.
 * The project-management API key stays server-side; see
 * `src/lib/tolgee/server-client.ts`.
 */
export type TolgeeRuntimeConfig = {
  apiUrl: string;
  projectId: string | null;
  /** True only when dev-mode editing should be offered in the browser. */
  devToolsEnabled: boolean;
};

export function getTolgeeRuntimeConfig(): TolgeeRuntimeConfig {
  return {
    apiUrl: publicEnv.tolgeeApiUrl,
    projectId: publicEnv.tolgeeProjectId || null,
    devToolsEnabled:
      process.env.NODE_ENV === "development" &&
      Boolean(publicEnv.tolgeeProjectId),
  };
}

/** Bundled fallback messages keep the UI rendering when Tolgee is offline. */
export function getStaticMessages(locale: Locale) {
  return STATIC_MESSAGES[locale];
}
