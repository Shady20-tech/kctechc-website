import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

import { loadCategoryOptionsResult } from "./loaders";

type Result = { data: unknown; error: unknown };

function builder(result: Result) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "in", "eq"]) {
    chain[method] = () => chain;
  }
  chain.order = () => Promise.resolve(result);
  chain.then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function client(departments: Result, categories: Result) {
  return {
    from: (table: string) =>
      builder(table === "departments" ? departments : categories),
  };
}

afterEach(() => {
  createClient.mockReset();
});

describe("loadCategoryOptionsResult", () => {
  it("reports the session client as unconfigured", async () => {
    createClient.mockResolvedValue(null);

    await expect(loadCategoryOptionsResult()).resolves.toMatchObject({
      ok: false,
      reason: "unconfigured",
    });
  });

  it("reports a department read error instead of returning an empty list", async () => {
    createClient.mockResolvedValue(
      client(
        { data: null, error: { message: "permission denied", code: "42501" } },
        {
          data: [],
          error: null,
        },
      ),
    );

    const result = await loadCategoryOptionsResult();
    expect(result).toMatchObject({ ok: false, reason: "read_failed" });
    if (!result.ok) expect(result.detail).toContain("42501");
  });

  it("returns an empty list when there are no departments", async () => {
    createClient.mockResolvedValue(
      client({ data: [], error: null }, { data: [], error: null }),
    );

    await expect(loadCategoryOptionsResult()).resolves.toEqual({
      ok: true,
      categories: [],
    });
  });

  it("reports a category read error", async () => {
    createClient.mockResolvedValue(
      client(
        { data: [{ id: "dept-1" }], error: null },
        { data: null, error: { message: "boom", code: "XX000" } },
      ),
    );

    await expect(loadCategoryOptionsResult()).resolves.toMatchObject({
      ok: false,
      reason: "read_failed",
      detail: "boom (XX000)",
    });
  });

  it("maps category rows, including the department slug", async () => {
    createClient.mockResolvedValue(
      client(
        { data: [{ id: "dept-1" }], error: null },
        {
          data: [
            {
              id: "cat-1",
              name: "Laptops",
              department_id: "dept-1",
              departments: { slug: "digital-marketing" },
            },
          ],
          error: null,
        },
      ),
    );

    await expect(loadCategoryOptionsResult()).resolves.toEqual({
      ok: true,
      categories: [
        { id: "cat-1", name: "Laptops", departmentSlug: "digital-marketing" },
      ],
    });
  });
});
