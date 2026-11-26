import { readFileSync, readdirSync, statSync } from "node:fs";

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

/**
 * Every literal `t("...")` key in the application must resolve to a *string*.
 *
 * The translator falls through to the raw key when a lookup fails, so a key that
 * does not exist renders as a dotted identifier in the UI. The parity test above
 * cannot see that: it compares the two dictionaries to each other, and a key that
 * is missing from *both* is perfectly parity-consistent.
 *
 * There are two ways a literal key can be wrong, and both have shipped here:
 *
 *   1. the key does not exist at all, and
 *   2. the key exists but names a *group* rather than a message — `t("account.kyc.idType")`
 *      where `idType` is the dictionary of option labels. `lookupMessage` returns
 *      undefined for a non-string, so this renders the raw key exactly like (1),
 *      which is why the check is "resolves to a string", not "exists".
 *
 * Only literal keys are checked. A key built from a template (`${base}.${key}`) is
 * resolved at runtime from a value this cannot enumerate, so it stays out of scope;
 * `dashboard.test.ts` covers the dashboard's own grouping keys.
 */
describe("message keys referenced in code", () => {
  const SOURCE_ROOTS = ["src"];
  const SKIP = /\.test\.(ts|tsx)$/;

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry) && !SKIP.test(entry)) out.push(full);
    }
    return out;
  }

  /** Resolve a dotted key to a value in the English tree. */
  function resolve(key: string): unknown {
    return key
      .split(".")
      .reduce<unknown>(
        (node, segment) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[segment]
            : undefined,
        en,
      );
  }

  it("resolves every literal key to a string, never a group or a miss", () => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/\bt\(\s*"([^"]+)"\s*[,)]/g)) {
          const key = match[1]!;
          // Skip keys with no namespace: a single bare word is more likely a
          // variable or a test label than a message key.
          if (!key.includes(".")) continue;
          if (typeof resolve(key) !== "string") {
            offenders.push(`${file}: t("${key}")`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/**
 * A page intro prints `eyebrow` above `heading`. When the two strings are equal
 * the page renders the same words twice, one directly above the other, which
 * reads as a duplicated header rather than as a section label and a title. The
 * projects surface shipped like this in both locales (`Work Done` over
 * `Work Done`) because the eyebrow was copied from the heading.
 *
 * Every other page-intro section pairs a short section label with a descriptive
 * title ("Portfolio" / "Our work"), so the two being identical is always a
 * mistake rather than a style choice.
 */
describe("page intro eyebrows", () => {
  const SECTIONS = [
    "projects",
    "portfolio",
    "insights",
    "gallery",
    "services",
    "store",
    "realEstate",
    "packages",
  ] as const;

  it.each(["en", "fr"] as const)(
    "does not repeat the heading as the eyebrow (%s)",
    (locale) => {
      const messages = (locale === "en" ? en : fr) as Tree;
      const duplicates: string[] = [];
      for (const section of SECTIONS) {
        const group = messages[section];
        if (!group || typeof group === "string") continue;
        const eyebrow = group.eyebrow;
        const heading = group.heading;
        if (
          typeof eyebrow === "string" &&
          typeof heading === "string" &&
          eyebrow === heading
        ) {
          duplicates.push(`${locale}.${section}: "${eyebrow}"`);
        }
      }
      expect(duplicates).toEqual([]);
    },
  );
});
