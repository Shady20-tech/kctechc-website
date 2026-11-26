import { afterEach, describe, expect, it, vi } from "vitest";

type TolgeeEnv = {
  apiUrl?: string;
  projectId?: string;
  apiKey?: string;
  serverApiUrl?: string;
  serverProjectId?: string;
};

async function loadServerClient(env: TolgeeEnv) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_TOLGEE_API_URL", env.apiUrl ?? "");
  vi.stubEnv("NEXT_PUBLIC_TOLGEE_PROJECT_ID", env.projectId ?? "");
  vi.stubEnv("TOLGEE_API_KEY", env.apiKey ?? "");
  vi.stubEnv("TOLGEE_API_URL", env.serverApiUrl ?? "");
  vi.stubEnv("TOLGEE_PROJECT_ID", env.serverProjectId ?? "");
  return import("./server-client");
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Tolgee server client", () => {
  it.each([
    ["tgpak_project_key", "project_api_key"],
    ["tgpat_personal_token", "personal_access_token"],
  ])(
    "authenticates %s with X-API-Key against the translations endpoint",
    async (apiKey, apiKeyKind) => {
      const fetchMock = stubFetch(new Response("{}", { status: 200 }));
      const { pushTranslation } = await loadServerClient({
        apiUrl: "https://app.tolgee.io/v2/",
        projectId: "42",
        apiKey,
      });

      const result = await pushTranslation({
        key: "product.1.title.en",
        translations: { en: "Laptop", fr: "Ordinateur portable" },
      });

      expect(result.ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://app.tolgee.io/v2/projects/42/translations");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(
        apiKey,
      );
      expect((init.headers as Record<string, string>).Authorization).toBe(
        undefined,
      );
      expect(apiKeyKind).toBe(
        apiKey.startsWith("tgpak_")
          ? "project_api_key"
          : "personal_access_token",
      );
    },
  );

  it("accepts server-only URL and project id aliases", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    const { isTolgeeSyncConfigured, pushTranslation } = await loadServerClient({
      projectId: "99",
      serverApiUrl: "https://tolgee.example.com/v2/",
      serverProjectId: "7",
      apiKey: "tgpak_project_key",
    });

    expect(isTolgeeSyncConfigured()).toBe(true);
    await pushTranslation({
      key: "product.7.title.en",
      translations: { en: "Laptop" },
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://tolgee.example.com/v2/projects/7/translations");
  });

  it("logs the exact URL, status and credential kind on a 404", async () => {
    const expectedUrl = "https://app.tolgee.io/v2/projects/42/translations";
    stubFetch(new Response("{}", { status: 404 }));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { pushTranslation } = await loadServerClient({
      apiUrl: "https://app.tolgee.io",
      projectId: "42",
      apiKey: "tgpak_project_key",
    });

    const result = await pushTranslation({
      key: "product.42.title.en",
      translations: { en: "Laptop" },
    });

    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(result.ok ? "" : result.error).toContain(expectedUrl);
    expect(consoleError).toHaveBeenCalledWith(
      "[tolgee] 404",
      expect.objectContaining({
        url: expectedUrl,
        status: 404,
        projectId: "42",
        apiKeyKind: "project_api_key",
      }),
    );
  });

  it("does not treat a missing project id as configured", async () => {
    const { isTolgeeSyncConfigured, pushTranslation } = await loadServerClient({
      apiKey: "tgpak_project_key",
    });

    expect(isTolgeeSyncConfigured()).toBe(false);
    const result = await pushTranslation({
      key: "product.1.title.en",
      translations: { en: "Laptop" },
    });
    expect(result).toMatchObject({ ok: false, retryable: false });
  });
});
