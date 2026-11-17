import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relative), "utf8"));
}

/** Every `.tsx`/`.ts` under a directory, recursively. */
function filesUnder(relative: string): string[] {
  const absolute = join(ROOT, relative);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

function get(source: Record<string, unknown>, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
}

/**
 * A department's filter binding reads its own message namespace.
 *
 * The shared `marketplace` components take already-translated labels, and each
 * department's binding translates them. A binding that reached into another
 * department's namespace would couple the two — editing the store's "Clear
 * filters" wording would silently change the Work Done gallery's — and it would
 * read a key that only exists because the other department happens to define it.
 * The store and the projects gallery therefore own the shell labels they use.
 */
describe("marketplace department message ownership", () => {
  const en = readJson("src/lib/i18n/messages/en.json");
  const fr = readJson("src/lib/i18n/messages/fr.json");

  /** The prefixes each department's binding must never reach into. */
  const FORBIDDEN: Record<string, RegExp[]> = {
    "src/components/store": [/t\("realEstate\.search\./],
    "src/components/content": [/t\("realEstate\.search\./, /t\("store\./],
  };

  const OWNED_KEYS: Record<string, string[]> = {
    "src/components/store": [
      "store.optionWithCount",
      "store.filtersHeading",
      "store.openFilters",
      "store.closeFilters",
      "store.clearFilters",
      "store.activeFilters",
      "store.removeFilter",
      "store.filtersActiveCount",
      "store.applyFilters",
    ],
    "src/components/content": [
      "projects.filtersHeading",
      "projects.openFilters",
      "projects.closeFilters",
      "projects.activeFilters",
      "projects.filtersActiveCount",
      "projects.removeFilter",
      "projects.clearFilters",
      "projects.filterApply",
    ],
  };

  for (const [directory, keys] of Object.entries(OWNED_KEYS)) {
    it(`${directory} uses only keys its own namespace defines`, () => {
      for (const key of keys) {
        expect(get(en, key), `en is missing ${key}`).toBeTruthy();
        expect(get(fr, key), `fr is missing ${key}`).toBeTruthy();
      }
    });

    it(`${directory} does not read another department's namespace`, () => {
      for (const file of filesUnder(directory)) {
        const source = readFileSync(join(ROOT, file), "utf8");
        for (const pattern of FORBIDDEN[directory] ?? []) {
          expect(source, `${file} matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });
  }
});
