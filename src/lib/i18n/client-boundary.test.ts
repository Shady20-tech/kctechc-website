import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the Server/Client translation boundary.
 *
 * The translator is a closure over the message dictionary, so it cannot be
 * serialized across the RSC boundary. A Server Component that passes `t` into a
 * Client Component therefore compiles, typechecks and passes every other test —
 * and then throws at render time:
 *
 *     Functions cannot be passed directly to Client Components unless you
 *     explicitly expose it by marking it with "use server".
 *
 * That failure only appears when the page is actually requested, so a route
 * whose data source is empty (the usual state before launch) can hide it
 * indefinitely. This test makes the mistake visible at build time instead.
 *
 * The rule: a file with `"use client"` must not declare a `t` prop typed as
 * `Translator["t"]`. Client Components derive their own translator from a
 * `locale` prop, which is a serializable string.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("server/client translation boundary", () => {
  const files = walk(SRC).filter((path) => !path.endsWith(".test.tsx"));

  it("no Client Component accepts a translator function as a prop", () => {
    // Matches `t: Translator["t"]` and the equivalent spelled through the
    // factory's return type, since either form is a function-typed prop.
    const translatorProp = /\bt:\s*(?:Translator\["t"\]|ReturnType<typeof createTranslator>\["t"\])/;
    const offenders = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      if (!source.startsWith('"use client"')) return false;
      return translatorProp.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("every Client Component that translates derives its own translator", () => {
    // The complementary rule: a Client Component is allowed to call `t(...)`,
    // but only if it builds that translator itself from a locale. A client file
    // that references translations without importing `createTranslator` is
    // relying on a prop that cannot arrive.
    const offenders = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      if (!source.startsWith('"use client"')) return false;
      const callsTranslator = /\bt\(["`]/.test(source);
      if (!callsTranslator) return false;
      return !source.includes("createTranslator");
    });

    expect(offenders).toEqual([]);
  });
});
