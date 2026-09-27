import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the shape of the `"use server"` modules.
 *
 * Next.js requires every export from a `"use server"` file to be an async
 * function, because the directive turns each export into a callable endpoint and
 * only a function can be one. A plain helper or a type-only re-export alongside
 * the actions compiles and typechecks, then fails the production build with
 * "Server Actions must be async functions" — a failure that does not appear in
 * `tsc` or in a unit test that imports the helper directly.
 *
 * The rule this pins: shared logic belongs in a module without the directive, and
 * the action module imports it. Types are exempt, since `export type` is erased
 * and never becomes an endpoint.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("server action modules", () => {
  const modules = walk(SRC).filter((path) => {
    if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) return false;
    return readFileSync(path, "utf8").startsWith('"use server"');
  });

  it("finds the action modules to check", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(modules.length).toBeGreaterThan(0);
  });

  it("exports nothing but async functions and types", () => {
    const offenders: string[] = [];

    for (const path of modules) {
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (!line.startsWith("export ")) continue;
        // Erased at compile time, so never an endpoint.
        if (line.startsWith("export type ") || line.startsWith("export interface ")) {
          continue;
        }
        if (line.startsWith("export async function ")) continue;
        if (/^export\s+const\s+\w+\s*=\s*async\b/.test(line)) continue;
        if (/^export\s+\{\s*type\b/.test(line)) continue;
        offenders.push(`${path}: ${line.trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
