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
    // The admin-only `loadCategoryOptions` must keep the session client so it
    // can see unpublished categories; the storefront loaders must not.
    expect(source.match(/createPublicClient\(\)/g)).toHaveLength(2);
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
