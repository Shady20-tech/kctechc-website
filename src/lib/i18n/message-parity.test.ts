import { describe, expect, it } from "vitest";

import en from "./messages/en.json";
import fr from "./messages/fr.json";

/**
 * English/French static message parity.
 *
 * `Messages` is typed from the English file, so TypeScript already refuses a
 * French lookup for a key English lacks. The reverse is not caught: the translator
 * falls through to the raw key, so a key that exists only in French renders as a
 * dotted identifier in the English UI, and a key missing from French renders as
 * the raw key for a French reader. Both are silent in development because only the
 * locale being viewed shows the problem.
 *
 * This asserts the two trees have the same shape, which is the condition that
 * makes the typed lookup sound in both directions.
 */

type Tree = { [key: string]: string | Tree };

function paths(tree: Tree, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") keys.push(path);
    else keys.push(...paths(value, path));
  }
  return keys;
}

describe("static message parity", () => {
  const enKeys = paths(en as Tree).sort();
  const frKeys = paths(fr as Tree).sort();

  it("defines every English key in French", () => {
    const missing = enKeys.filter((key) => !frKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it("defines every French key in English", () => {
    const extra = frKeys.filter((key) => !enKeys.includes(key));
    expect(extra).toEqual([]);
  });

  it("leaves no message empty in either locale", () => {
    const blank = (tree: Tree) =>
      paths(tree).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, segment) => (node as Record<string, unknown>)[segment],
            tree,
          );
        return typeof value === "string" && value.trim() === "";
      });

    expect(blank(en as Tree)).toEqual([]);
    expect(blank(fr as Tree)).toEqual([]);
  });

  it("keeps placeholder tokens consistent across locales", () => {
    const tokens = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enValue = key
        .split(".")
        .reduce<unknown>(
          (node, segment) => (node as Record<string, unknown>)[segment],
          en,
        );
      const frValue = key
        .split(".")
        .reduce<unknown>(
          (node, segment) => (node as Record<string, unknown>)[segment],
          fr,
        );
      if (typeof enValue !== "string" || typeof frValue !== "string") continue;
      // A translation that drops a token renders a sentence with a hole in it;
      // one that adds a token renders an unsubstituted `{token}`.
      if (JSON.stringify(tokens(enValue)) !== JSON.stringify(tokens(frValue))) {
        mismatches.push(key);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
