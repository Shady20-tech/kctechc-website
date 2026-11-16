import { describe, expect, it } from "vitest";

import { regionOptions } from "./membership-loaders";

/**
 * The residency form's region selector must show region names in the visitor's
 * language.
 *
 * `regions.name` is the English name and `name_fr` the French one, so a loader
 * that read `name` alone rendered "Far North" and "Adamawa" on the French page
 * while every other label around it was French. This is the same defect class
 * AGENTS.md records for a missing label key: silent, and only visible in a
 * rendered page.
 */
describe("regionOptions", () => {
  const rows = [
    { id: "r1", slug: "far-north", name: "Far North", name_fr: "Extrême-Nord" },
    { id: "r2", slug: "adamawa", name: "Adamawa", name_fr: "Adamaoua" },
  ];

  it("uses the English name for the en locale", () => {
    expect(regionOptions(rows, "en")).toEqual([
      { id: "r1", name: "Far North" },
      { id: "r2", name: "Adamawa" },
    ]);
  });

  it("uses the French name for the fr locale", () => {
    expect(regionOptions(rows, "fr")).toEqual([
      { id: "r1", name: "Extrême-Nord" },
      { id: "r2", name: "Adamaoua" },
    ]);
  });

  it("falls back to the English name when a French one is missing", () => {
    expect(
      regionOptions(
        [{ id: "r1", slug: "east", name: "East", name_fr: null }],
        "fr",
      ),
    ).toEqual([{ id: "r1", name: "East" }]);
  });
});
