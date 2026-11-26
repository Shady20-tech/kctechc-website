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
      const headers = init.headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe(apiKey);
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toBe(undefined);
      expect(JSON.parse(String(init.body))).toEqual({
        key: "product.1.title.en",
        translations: { en: "Laptop", fr: "Ordinateur portable" },
      });
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
      serverApiUrl: "https://tolgee.example.com/platform/v2/",
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

  it("strips a pasted project path from the API URL", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    const { pushTranslation } = await loadServerClient({
      apiUrl: "https://app.tolgee.io/projects/35323/v2/",
      projectId: "35323",
      apiKey: "tgpak_project_key",
    });

    await pushTranslation({
      key: "product.1.title.en",
      translations: { en: "Laptop" },
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.tolgee.io/v2/projects/35323/translations");
  });

  it("returns the v2 key id from a successful upsert", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          keyId: 1234,
          keyName: "product.1.title.en",
          keyIsPlural: false,
          translations: { en: { id: 9, text: "Laptop" } },
        }),
        { status: 200 },
      ),
    );
    const { pushTranslation } = await loadServerClient({
      apiUrl: "https://app.tolgee.io",
      projectId: "42",
      apiKey: "tgpak_project_key",
    });

    const result = await pushTranslation({
      key: "product.1.title.en",
      translations: { en: "Laptop" },
    });

    expect(result).toMatchObject({ ok: true, data: { keyId: 1234 } });
  });

  it("includes Tolgee's response code and logs the body on a rejected request", async () => {
    const expectedUrl = "https://app.tolgee.io/v2/projects/42/translations";
    stubFetch(
      new Response(
        JSON.stringify({
          code: "invalid_project_api_key",
          params: ["project 42"],
        }),
        { status: 403 },
      ),
    );
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
    expect(result.ok ? "" : result.error).toContain("invalid_project_api_key");
    expect(result.ok ? "" : result.error).toContain('params=["project 42"]');
    expect(consoleError).toHaveBeenCalledWith(
      "[tolgee] request failed",
      expect.objectContaining({
        url: expectedUrl,
        status: 403,
        projectId: "42",
        apiKeyKind: "project_api_key",
        responseBody: expect.stringContaining("invalid_project_api_key"),
      }),
    );
  });

  it("logs the exact URL, status and credential kind on a 404", async () => {
    const expectedUrl = "https://app.tolgee.io/v2/projects/42/translations";
    stubFetch(
      new Response(JSON.stringify({ code: "project_not_found" }), {
        status: 404,
      }),
    );
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
    const error = result.ok ? "" : result.error;
    expect(error).toContain(expectedUrl);
    expect(error).toContain("project_not_found");
    expect(consoleError).toHaveBeenCalledWith(
      "[tolgee] request failed",
      expect.objectContaining({
        url: expectedUrl,
        status: 404,
        projectId: "42",
        apiKeyKind: "project_api_key",
        responseBody: expect.stringContaining("project_not_found"),
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
