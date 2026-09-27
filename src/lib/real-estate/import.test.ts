import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import {
  IMPORT_TEMPLATE_HEADER,
  formatImportReport,
  validateHeader,
  validateListingImport,
  type GeographyIndex,
} from "./import";

/**
 * A geography index matching the real region codes, so a fixture row uses a code
 * that actually exists rather than an invented one that would mask a bug in the
 * lookup.
 */
const geography: GeographyIndex = {
  regions: new Map([
    ["SW", "region-sw"],
    ["LT", "region-lt"],
    ["CE", "region-ce"],
  ]),
  divisions: new Map([
    ["SW-FAKO", { id: "div-fako", regionId: "region-sw" }],
    ["LT-WOURI", { id: "div-wouri", regionId: "region-lt" }],
  ]),
  subdivisions: new Map([
    [
      "SW-FAKO-LIM",
      { id: "sub-limbe", divisionId: "div-fako", regionId: "region-sw" },
    ],
    [
      "LT-WOURI-DLA",
      { id: "sub-douala", divisionId: "div-wouri", regionId: "region-lt" },
    ],
  ]),
};

const BASE_HEADER =
  "slug,title,description,listingType,propertyKind,propertyType,regionCode";

const DEFAULTS: Record<string, string> = {
  slug: "modern-villa-limbe",
  title: "Modern villa in Limbe",
  description: "A bright modern villa overlooking the bay.",
  listingType: "sale",
  propertyKind: "villa",
  propertyType: "residential",
  regionCode: "SW",
};

/**
 * Quote a CSV cell when it contains a delimiter, a quote or a newline, which is
 * what a real spreadsheet export does. Without this a fixture value like
 * "25,000,000" would split into two columns.
 */
function quoteCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build a row matching the given header, so extending the header with extra
 * columns does not accidentally produce a ragged row.
 */
function row(
  overrides: Record<string, string> = {},
  header: string = BASE_HEADER,
): string {
  const values = { ...DEFAULTS, ...overrides };
  return header
    .split(",")
    .map((name) => quoteCell(values[name] ?? ""))
    .join(",");
}

function run(overridesList: Record<string, string>[], geo?: GeographyIndex) {
  return runWith(BASE_HEADER, overridesList, geo);
}

function runWith(
  header: string,
  overridesList: Record<string, string>[],
  geo?: GeographyIndex,
) {
  const rows = overridesList.map((o) => row(o, header));
  return validateListingImport(parseCsv(`${header}\n${rows.join("\n")}\n`), geo);
}

describe("validateHeader", () => {
  it("accepts the documented template header", () => {
    const { header } = parseCsv(`${IMPORT_TEMPLATE_HEADER}\n`);
    expect(validateHeader(header)).toEqual([]);
  });

  it("reports each missing required column", () => {
    const issues = validateHeader(["slug", "title"]);
    const missing = issues.map((i) => i.column).sort();
    expect(missing).toEqual(
      [
        "description",
        "listingType",
        "propertyKind",
        "propertyType",
        "regionCode",
      ].sort(),
    );
  });

  it("reports an unknown column so a misspelled header is not silently dropped", () => {
    const issues = validateHeader([...BASE_HEADER.split(","), "regioCode"]);
    expect(issues).toEqual([
      { line: 1, column: "regioCode", message: 'Unknown column "regioCode".' },
    ]);
  });
});

describe("validateListingImport", () => {
  it("accepts a valid row", () => {
    const report = run([{}]);
    expect(report.issues).toEqual([]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!).toMatchObject({
      slug: "modern-villa-limbe",
      listingType: "sale",
      propertyKind: "villa",
      status: "draft",
      source: "import",
      currency: "XAF",
      pricePeriod: "total",
    });
  });

  it("resolves geography codes to ids when an index is supplied", () => {
    const report = runWith(
      `${BASE_HEADER},divisionCode,subdivisionCode`,
      [{ divisionCode: "SW-FAKO", subdivisionCode: "SW-FAKO-LIM" }],
      geography,
    );
    expect(report.issues).toEqual([]);
    expect(report.rows[0]!).toMatchObject({
      regionId: "region-sw",
      divisionId: "div-fako",
      subdivisionId: "sub-limbe",
    });
  });

  it("rejects a region code that does not exist", () => {
    const report = run([{ regionCode: "ZZ" }], geography);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "regionCode",
      message: 'No region with code "ZZ".',
    });
    expect(report.rows).toHaveLength(0);
  });

  it("rejects a division that belongs to a different region", () => {
    // The cross-check the composite FK enforces; caught here with a row number
    // rather than a constraint name.
    const report = runWith(
      `${BASE_HEADER},divisionCode`,
      [{ regionCode: "SW", divisionCode: "LT-WOURI" }],
      geography,
    );
    expect(report.issues).toContainEqual({
      line: 2,
      column: "divisionCode",
      message: 'Division "LT-WOURI" is not in region "SW".',
    });
  });

  it("rejects a subdivision that belongs to a different division", () => {
    const report = runWith(
      `${BASE_HEADER},divisionCode,subdivisionCode`,
      [{ divisionCode: "SW-FAKO", subdivisionCode: "LT-WOURI-DLA" }],
      geography,
    );
    expect(report.issues).toContainEqual({
      line: 2,
      column: "subdivisionCode",
      message: 'Subdivision "LT-WOURI-DLA" is not in division "SW-FAKO".',
    });
  });

  it("requires a division when a subdivision is given", () => {
    const report = runWith(
      `${BASE_HEADER},subdivisionCode`,
      [{ subdivisionCode: "SW-FAKO-LIM" }],
      geography,
    );
    expect(report.issues).toContainEqual({
      line: 2,
      column: "divisionCode",
      message: "Required when subdivisionCode is given.",
    });
  });

  it("rejects an unknown listing type and names the accepted values", () => {
    const report = run([{ listingType: "sell" }]);
    expect(report.issues[0]!.column).toBe("listingType");
    expect(report.issues[0]!.message).toContain("sale, rent, lease, short_term");
  });

  it("rejects a slug that is not lowercase-hyphenated", () => {
    const report = run([{ slug: "Modern Villa" }]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "slug",
      message: "Use lowercase words separated by single hyphens.",
    });
  });

  it("rejects a duplicate slug and points at the first occurrence", () => {
    const report = run([{}, {}]);
    expect(report.issues).toContainEqual({
      line: 3,
      column: "slug",
      message: "Duplicate of row 2.",
    });
    expect(report.rows).toHaveLength(1);
  });

  it("refuses to import a published listing", () => {
    const report = runWith(`${BASE_HEADER},status`, [{ status: "published" }]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "status",
      message:
        "Imports may only create drafts. Publish through review so the transition is audited.",
    });
  });

  it("refuses an owner_submission source, which has its own route", () => {
    const report = runWith(`${BASE_HEADER},source`, [
      { source: "owner_submission" },
    ]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "source",
      message:
        "Owner submissions arrive through the submission form, not an import.",
    });
  });

  it("rejects a price period that does not match the listing type", () => {
    const report = runWith(`${BASE_HEADER},pricePeriod`, [
      { listingType: "sale", pricePeriod: "nightly" },
    ]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "pricePeriod",
      message: 'A "sale" listing cannot use the "nightly" period.',
    });
  });

  it("defaults the period from the listing type", () => {
    const shortTerm = run([
      { listingType: "short_term", propertyKind: "guesthouse" },
    ]);
    expect(shortTerm.rows[0]!.pricePeriod).toBe("nightly");

    const rent = run([{ listingType: "rent" }]);
    expect(rent.rows[0]!.pricePeriod).toBe("monthly");

    const sale = run([{}]);
    expect(sale.rows[0]!.pricePeriod).toBe("total");
  });

  it("accepts a price with a thousands separator", () => {
    const report = runWith(`${BASE_HEADER},price`, [{ price: "25,000,000" }]);
    expect(report.issues).toEqual([]);
    expect(report.rows[0]!.priceMinor).toBe(25_000_000);
  });

  it("rejects a price given alongside priceOnRequest", () => {
    const report = runWith(`${BASE_HEADER},price,priceOnRequest`, [
      { price: "1000", priceOnRequest: "yes" },
    ]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "price",
      message: "Leave blank when priceOnRequest is yes.",
    });
  });

  it("requires both coordinates or neither", () => {
    const report = runWith(`${BASE_HEADER},longitude,latitude`, [
      { longitude: "9.28" },
    ]);
    expect(report.issues).toContainEqual({
      line: 2,
      column: "latitude",
      message: "Both longitude and latitude are required for a coordinate.",
    });
  });

  it("rejects coordinates outside Cameroon", () => {
    const report = runWith(`${BASE_HEADER},longitude,latitude`, [
      { longitude: "2.35", latitude: "48.85" },
    ]);
    const messages = report.issues.map((i) => i.message);
    expect(messages).toContain("Must be between 8.0 and 17.0 for Cameroon.");
    expect(messages).toContain("Must be between 1.0 and 13.5 for Cameroon.");
  });

  it("accepts a valid Cameroon coordinate", () => {
    const report = runWith(`${BASE_HEADER},longitude,latitude`, [
      { longitude: "9.28473", latitude: "4.01234" },
    ]);
    expect(report.issues).toEqual([]);
    expect(report.rows[0]!).toMatchObject({
      exactLongitude: 9.28473,
      exactLatitude: 4.01234,
    });
  });

  it("reports every problem in a row at once, not just the first", () => {
    const report = run([{ slug: "Bad Slug", title: "x", listingType: "sell" }]);
    const columns = report.issues.map((i) => i.column).sort();
    expect(columns).toEqual(["listingType", "slug", "title"]);
  });

  it("continues past a bad row and still accepts later good rows", () => {
    const report = run([{ slug: "Bad Slug" }, { slug: "good-row" }]);
    expect(report.rejectedCount).toBe(1);
    expect(report.rows.map((r) => r.slug)).toEqual(["good-row"]);
  });

  it("reports a ragged row with its line number", () => {
    const ragged = validateListingImport(parseCsv(`${BASE_HEADER}\na,b\n`));
    expect(ragged.issues).toContainEqual({
      line: 2,
      column: null,
      message: `Row has 2 values but the header has ${BASE_HEADER.split(",").length}.`,
    });
  });

  it("parses list cells for highlights and amenities", () => {
    const report = runWith(`${BASE_HEADER},highlights,amenities`, [
      { highlights: "sea view|fenced", amenities: "pool|solar" },
    ]);
    expect(report.rows[0]!.highlights).toEqual(["sea view", "fenced"]);
    expect(report.rows[0]!.amenities).toEqual(["pool", "solar"]);
  });

  it("sets hasErrors when anything is rejected", () => {
    expect(run([{}]).hasErrors).toBe(false);
    expect(run([{ slug: "Bad" }]).hasErrors).toBe(true);
  });
});

describe("formatImportReport", () => {
  it("summarizes counts and groups issues by line", () => {
    const report = run([{ slug: "Bad Slug" }, {}]);
    const text = formatImportReport(report);
    expect(text).toContain("1 row valid, 1 rejected, 1 problem");
    expect(text).toContain("Line 2:");
    expect(text).toContain("slug: Use lowercase words");
  });

  it("labels header issues distinctly from data rows", () => {
    const report = runWith("slug,title", [{}]);
    const text = formatImportReport(report);
    expect(text).toContain("Header:");
  });

  it("caps the output and says how many were withheld", () => {
    const bad = Array.from({ length: 5 }, (_, i) => ({
      slug: `Bad Slug ${i}`,
    }));
    const text = formatImportReport(run(bad), 2);
    expect(text).toContain("more.");
  });
});
