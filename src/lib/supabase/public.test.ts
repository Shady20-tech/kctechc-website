import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The public render path must not touch cookies.
 *
 * Reading content through the cookie-bound client called `cookies()`, which
 * turned every page that used it dynamic. Next 16 then refused the static
 * `generateStaticParams` on those routes, so project detail pages produced no
 * params during the build and 500'd at request time — a silent failure, since
 * the loader's fallback swallowed the error. These tests pin the fix: public
 * content is read through the stateless client.
 */

/** Source paths, relative to `src/lib/supabase/`, of public render-path modules. */
const PUBLIC_ONLY_MODULES = [
  "../content/loaders.ts",
  "../config/site-content.ts",
];

function readModule(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("public render path", () => {
  it.each(PUBLIC_ONLY_MODULES)(
    "%s reads only through the stateless client",
    (relativePath) => {
      const source = readModule(relativePath);

      expect(source).toMatch(/from "@\/lib\/supabase\/public"/);
      expect(source).not.toMatch(/from "@\/lib\/supabase\/server"/);
    },
  );

  it("storefront loaders read through the stateless client", () => {
    const source = readModule("../store/loaders.ts");

    expect(source).toMatch(/from "@\/lib\/supabase\/public"/);
    // Every storefront read is stateless. The count is not pinned, because a
    // loader split into more functions is not a regression — the property that
    // matters is that the *only* session client is the admin-only
    // `loadCategoryOptions`, which must see unpublished categories. A single
    // `await createClient()` is exactly that one call.
    expect(
      source.match(/createPublicClient\(\)/g)?.length ?? 0,
    ).toBeGreaterThan(2);
    expect(source.match(/await createClient\(\)/g)).toHaveLength(1);
  });
});

describe("createPublicClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when Supabase is unconfigured", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const { createPublicClient } = await import("@/lib/supabase/public");

    expect(createPublicClient()).toBeNull();
  });

  it("fails fast instead of retrying with backoff", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    const { createPublicClient } = await import("@/lib/supabase/public");
    const client = createPublicClient();
    expect(client).not.toBeNull();

    // supabase-js retries a failed request three times with 1s/2s/4s backoff,
    // which turned an unreachable database into a flat ~7s stall on every public
    // page. Assert the attempt count, because the retry policy is invisible to
    // types and to every other test.
    let attempts = 0;
    const original = globalThis.fetch;
    globalThis.fetch = ((input, init) => {
      attempts += 1;
      return original(input, init);
    }) as typeof fetch;

    try {
      const started = Date.now();
      await client!.from("property_listings").select("id").limit(1);
      const elapsed = Date.now() - started;

      expect(attempts).toBe(1);
      expect(elapsed).toBeLessThan(1000);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("bounds a hung request with an abort timeout", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    const { createPublicClient } = await import("@/lib/supabase/public");
    const client = createPublicClient();
    expect(client).not.toBeNull();

    // A connection that hangs rather than refusing is the case `retry: false`
    // cannot help with, so the request itself must carry an abort signal.
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }));

    await client!.from("property_listings").select("id").limit(1);

    expect(timeout).toHaveBeenCalled();
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    fetchSpy.mockRestore();
    timeout.mockRestore();
  });

  it("builds a client without a persisted session when configured", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    const { createPublicClient } = await import("@/lib/supabase/public");
    const client = createPublicClient();

    expect(client).not.toBeNull();
    // No cookie or storage adapter is attached, which is what keeps it usable
    // from a prerendered page.
    expect(client?.auth.getSession).toBeTypeOf("function");
  });
});
