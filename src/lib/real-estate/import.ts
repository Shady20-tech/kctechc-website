import {
  LISTING_PROPERTY_KINDS,
  LISTING_SOURCES,
  LISTING_STATUSES,
  LISTING_TYPES,
  PRICE_PERIODS,
  PRICE_PERIODS_BY_LISTING_TYPE,
  PROPERTY_TYPES,
  type ListingPropertyKind,
  type ListingSource,
  type ListingStatus,
  type ListingType,
  type PricePeriod,
  type PropertyType,
} from "./enums";
import { parseListCell, type CsvRow, type ParsedCsv } from "./csv";

/**
 * CSV import validation.
 *
 * The design principle: every problem in the file is reported in one pass, with
 * its row number and the column that caused it. An importer that stops at the
 * first error makes a 500-row file a 500-step conversation, and one that reports
 * "invalid row" without naming the column makes the operator guess.
 *
 * The module is pure: it takes parsed rows and returns a report. Nothing is
 * written, so a preview costs nothing and the same function can validate before
 * and after the geography lookup, which is what lets the import distinguish "the
 * file is malformed" from "this region code does not exist".
 */

/** A geography lookup resolved once, so validation is not per-row I/O. */
export interface GeographyIndex {
  /** Region code (uppercased) → region id. */
  regions: ReadonlyMap<string, string>;
  /** Division code → { id, regionId }. */
  divisions: ReadonlyMap<string, { id: string; regionId: string }>;
  /** Subdivision code → { id, divisionId, regionId }. */
  subdivisions: ReadonlyMap<
    string,
    { id: string; divisionId: string; regionId: string }
  >;
}

export interface ImportIssue {
  /** 1-based line in the source file, so the operator can find it. */
  line: number;
  /** The column name, or null when the problem is the row as a whole. */
  column: string | null;
  /** What is wrong, in the terms the operator used. */
  message: string;
}

export interface ListingImportRow {
  line: number;
  slug: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyKind: ListingPropertyKind;
  propertyType: PropertyType;
  status: ListingStatus;
  source: ListingSource;
  regionId: string;
  divisionId: string | null;
  subdivisionId: string | null;
  locality: string | null;
  highlights: string[];
  amenities: string[];
  priceMinor: number | null;
  currency: string;
  pricePeriod: PricePeriod;
  priceOnRequest: boolean;
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  agentSlug: string | null;
  /** Present only when the row carries coordinates, which most exports do not. */
  exactLongitude: number | null;
  exactLatitude: number | null;
}

export interface ImportReport {
  rows: ListingImportRow[];
  issues: ImportIssue[];
  /** Rows that parsed but were rejected, for the summary line. */
  rejectedCount: number;
  /** True when nothing would be written. */
  hasErrors: boolean;
}

const REQUIRED_COLUMNS = [
  "slug",
  "title",
  "description",
  "listingType",
  "propertyKind",
  "propertyType",
  "regionCode",
] as const;

const KNOWN_COLUMNS = new Set<string>([
  ...REQUIRED_COLUMNS,
  "status",
  "source",
  "divisionCode",
  "subdivisionCode",
  "locality",
  "highlights",
  "amenities",
  "price",
  "currency",
  "pricePeriod",
  "priceOnRequest",
  "landAreaSqm",
  "buildingAreaSqm",
  "bedrooms",
  "bathrooms",
  "yearBuilt",
  "agentSlug",
  "longitude",
  "latitude",
]);

/**
 * A whole-franc price.
 *
 * Accepts a thousands separator because an exported spreadsheet will contain
 * one, and a value like "25,000,000" should import rather than be reported as
 * non-numeric. Spaces and non-breaking spaces are stripped for the same reason:
 * they are what a French-locale export produces.
 */
function parseIntegerCell(
  raw: string,
  options: { min?: number; max?: number } = {},
): { value: number | null; error: string | null } {
  const cleaned = raw.replace(/[\s\u00a0,]/g, "").trim();
  if (cleaned === "") return { value: null, error: null };

  if (!/^-?\d+$/.test(cleaned)) {
    return { value: null, error: `"${raw}" is not a whole number.` };
  }

  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) {
    return { value: null, error: `"${raw}" is too large.` };
  }
  if (options.min !== undefined && value < options.min) {
    return { value: null, error: `Must be at least ${options.min}.` };
  }
  if (options.max !== undefined && value > options.max) {
    return { value: null, error: `Must be at most ${options.max}.` };
  }
  return { value, error: null };
}

function parseCoordinateCell(
  raw: string,
): { value: number | null; error: string | null } {
  const cleaned = raw.trim();
  if (cleaned === "") return { value: null, error: null };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { value: null, error: `"${raw}" is not a number.` };
  }
  return { value, error: null };
}

const booleanCells = new Map<string, boolean>([
  ["true", true],
  ["yes", true],
  ["y", true],
  ["1", true],
  ["false", false],
  ["no", false],
  ["n", false],
  ["0", false],
]);

function parseBooleanCell(
  raw: string,
): { value: boolean; error: string | null } {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === "") return { value: false, error: null };
  const value = booleanCells.get(cleaned);
  if (value === undefined) {
    return { value: false, error: `"${raw}" is not a yes/no value.` };
  }
  return { value, error: null };
}

/**
 * A slug, matching the database's `property_listings_slug_format`.
 *
 * Rejected rather than normalized: "Villa in Limbe" and "villa-in-limbe" must
 * not silently become the same slug, because the second would then fail on a
 * uniqueness conflict with a message that does not explain why.
 */
function slugError(value: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return "Use lowercase words separated by single hyphens.";
  }
  if (value.length < 2 || value.length > 160) {
    return "Must be between 2 and 160 characters.";
  }
  return null;
}

/**
 * Validate the file's shape: required columns present, no unknown columns.
 *
 * Unknown columns are reported rather than ignored, because a misspelled header
 * (`regioncode` for `regionCode`) would otherwise be silently dropped and the
 * required column reported as missing — pointing the operator at the wrong
 * problem.
 */
export function validateHeader(header: CsvRow): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const present = new Set(header);

  for (const required of REQUIRED_COLUMNS) {
    if (!present.has(required)) {
      issues.push({
        line: 1,
        column: required,
        message: `Required column "${required}" is missing.`,
      });
    }
  }

  for (const name of header) {
    if (!KNOWN_COLUMNS.has(name)) {
      issues.push({
        line: 1,
        column: name,
        message: `Unknown column "${name}".`,
      });
    }
  }

  return issues;
}

/**
 * Validate and normalize every data row.
 *
 * `geography` may be omitted for a structural preview; when supplied, region,
 * division and subdivision codes are resolved and a combination that does not
 * exist is reported. That is the same rule the database enforces with composite
 * foreign keys — checked here as well so the operator gets a row number and a
 * column name rather than a constraint name.
 */
export function validateListingImport(
  parsed: ParsedCsv,
  geography?: GeographyIndex,
): ImportReport {
  const issues: ImportIssue[] = [...validateHeader(parsed.header)];

  for (const ragged of parsed.ragged) {
    issues.push({
      line: ragged.line,
      column: null,
      message: `Row has ${ragged.cells} value${ragged.cells === 1 ? "" : "s"} but the header has ${parsed.header.length}.`,
    });
  }

  const rows: ListingImportRow[] = [];
  const seenSlugs = new Map<string, number>();
  let rejectedCount = 0;

  for (let i = 0; i < parsed.rows.length; i += 1) {
    // +2: one for the header, one because lines are 1-based.
    const line = i + 2;
    const raw = parsed.rows[i] ?? [];
    const cell = (name: string): string => {
      const index = parsed.header.indexOf(name);
      return index === -1 ? "" : (raw[index] ?? "").trim();
    };

    const rowIssues: ImportIssue[] = [];
    const add = (column: string, message: string) =>
      rowIssues.push({ line, column, message });

    // ------------------------------------------------------------- identity --
    const slug = cell("slug");
    if (slug === "") {
      add("slug", "Required.");
    } else {
      const error = slugError(slug);
      if (error) add("slug", error);
      const firstLine = seenSlugs.get(slug);
      if (firstLine !== undefined) {
        add("slug", `Duplicate of row ${firstLine}.`);
      } else {
        seenSlugs.set(slug, line);
      }
    }

    const title = cell("title");
    if (title.length < 4 || title.length > 200) {
      add("title", "Must be between 4 and 200 characters.");
    }

    const description = cell("description");
    if (description.length < 20 || description.length > 20_000) {
      add("description", "Must be between 20 and 20000 characters.");
    }

    // ---------------------------------------------------------------- enums --
    const listingType = cell("listingType");
    if (!(LISTING_TYPES as readonly string[]).includes(listingType)) {
      add("listingType", `Must be one of: ${LISTING_TYPES.join(", ")}.`);
    }

    const propertyKind = cell("propertyKind");
    if (!(LISTING_PROPERTY_KINDS as readonly string[]).includes(propertyKind)) {
      add("propertyKind", `Must be one of: ${LISTING_PROPERTY_KINDS.join(", ")}.`);
    }

    const propertyType = cell("propertyType");
    if (!(PROPERTY_TYPES as readonly string[]).includes(propertyType)) {
      add("propertyType", `Must be one of: ${PROPERTY_TYPES.join(", ")}.`);
    }

    // Status defaults to draft: an import must not be a way to publish without
    // review, so the default is the state that is not visible.
    const status = cell("status") || "draft";
    if (!(LISTING_STATUSES as readonly string[]).includes(status)) {
      add("status", `Must be one of: ${LISTING_STATUSES.join(", ")}.`);
    }
    if (status !== "draft") {
      add(
        "status",
        "Imports may only create drafts. Publish through review so the transition is audited.",
      );
    }

    const source = cell("source") || "import";
    if (!(LISTING_SOURCES as readonly string[]).includes(source)) {
      add("source", `Must be one of: ${LISTING_SOURCES.join(", ")}.`);
    }
    if (source === "owner_submission") {
      add(
        "source",
        "Owner submissions arrive through the submission form, not an import.",
      );
    }

    // ------------------------------------------------------------- geography --
    const regionCode = cell("regionCode").toUpperCase();
    const divisionCode = cell("divisionCode").toUpperCase();
    const subdivisionCode = cell("subdivisionCode").toUpperCase();

    let regionId: string | null = null;
    let divisionId: string | null = null;
    let subdivisionId: string | null = null;

    if (regionCode === "") {
      add("regionCode", "Required.");
    } else if (geography) {
      regionId = geography.regions.get(regionCode) ?? null;
      if (!regionId) add("regionCode", `No region with code "${regionCode}".`);
    }

    if (geography) {
      if (divisionCode !== "") {
        const division = geography.divisions.get(divisionCode);
        if (!division) {
          add("divisionCode", `No division with code "${divisionCode}".`);
        } else {
          divisionId = division.id;
          // The cross-check the composite FK enforces in the database. Reported
          // here so the operator sees "division X is in region Y" rather than a
          // foreign key violation naming two UUIDs.
          if (regionId && division.regionId !== regionId) {
            add(
              "divisionCode",
              `Division "${divisionCode}" is not in region "${regionCode}".`,
            );
          }
        }
      }

      if (subdivisionCode !== "") {
        const subdivision = geography.subdivisions.get(subdivisionCode);
        if (!subdivision) {
          add(
            "subdivisionCode",
            `No subdivision with code "${subdivisionCode}".`,
          );
        } else {
          subdivisionId = subdivision.id;
          if (divisionId && subdivision.divisionId !== divisionId) {
            add(
              "subdivisionCode",
              `Subdivision "${subdivisionCode}" is not in division "${divisionCode}".`,
            );
          }
          if (regionId && subdivision.regionId !== regionId) {
            add(
              "subdivisionCode",
              `Subdivision "${subdivisionCode}" is not in region "${regionCode}".`,
            );
          }
        }
      }

      // A subdivision implies a division; requiring the pair keeps the import
      // and the composite FK in agreement about what a complete address is.
      if (subdivisionId && !divisionId) {
        add("divisionCode", "Required when subdivisionCode is given.");
      }
    }

    // ---------------------------------------------------------------- pricing --
    const priceRaw = cell("price");
    const priceOnRequest = parseBooleanCell(cell("priceOnRequest"));
    if (priceOnRequest.error) add("priceOnRequest", priceOnRequest.error);

    const price = parseIntegerCell(priceRaw, { min: 1, max: 1_000_000_000_000 });
    if (price.error) add("price", price.error);

    // Mirrors `property_listings_price_consistency`: a price and "on request"
    // are contradictory.
    if (priceOnRequest.value && price.value !== null) {
      add("price", "Leave blank when priceOnRequest is yes.");
    }

    const currency = (cell("currency") || "XAF").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      add("currency", "Must be a three-letter code, e.g. XAF.");
    }

    // The period defaults to the only value its listing type allows, so a sale
    // does not need the column filled in.
    const defaultPeriod: PricePeriod =
      listingType === "short_term" ? "nightly" : listingType === "sale" ? "total" : "monthly";
    const pricePeriod = cell("pricePeriod") || defaultPeriod;
    if (!(PRICE_PERIODS as readonly string[]).includes(pricePeriod)) {
      add("pricePeriod", `Must be one of: ${PRICE_PERIODS.join(", ")}.`);
    } else if (
      (LISTING_TYPES as readonly string[]).includes(listingType) &&
      !PRICE_PERIODS_BY_LISTING_TYPE[listingType as ListingType].includes(
        pricePeriod as PricePeriod,
      )
    ) {
      add(
        "pricePeriod",
        `A "${listingType}" listing cannot use the "${pricePeriod}" period.`,
      );
    }

    // ------------------------------------------------------------- dimensions --
    const landArea = parseIntegerCell(cell("landAreaSqm"), { min: 1 });
    if (landArea.error) add("landAreaSqm", landArea.error);

    const buildingArea = parseIntegerCell(cell("buildingAreaSqm"), { min: 1 });
    if (buildingArea.error) add("buildingAreaSqm", buildingArea.error);

    const bedrooms = parseIntegerCell(cell("bedrooms"), { min: 0, max: 50 });
    if (bedrooms.error) add("bedrooms", bedrooms.error);

    const bathrooms = parseIntegerCell(cell("bathrooms"), { min: 0, max: 50 });
    if (bathrooms.error) add("bathrooms", bathrooms.error);

    const yearBuilt = parseIntegerCell(cell("yearBuilt"), {
      min: 1800,
      max: 2100,
    });
    if (yearBuilt.error) add("yearBuilt", yearBuilt.error);

    // --------------------------------------------------------------- location --
    const longitude = parseCoordinateCell(cell("longitude"));
    const latitude = parseCoordinateCell(cell("latitude"));
    if (longitude.error) add("longitude", longitude.error);
    if (latitude.error) add("latitude", latitude.error);

    // One coordinate without the other is unusable, so it is an error rather
    // than a silently dropped half.
    if ((longitude.value === null) !== (latitude.value === null)) {
      add(
        longitude.value === null ? "longitude" : "latitude",
        "Both longitude and latitude are required for a coordinate.",
      );
    }

    // Mirrors the database's Cameroon bounds check, so an import of a
    // mis-signed or swapped pair is caught with a row number.
    if (longitude.value !== null && latitude.value !== null) {
      if (longitude.value < 8.0 || longitude.value > 17.0) {
        add("longitude", "Must be between 8.0 and 17.0 for Cameroon.");
      }
      if (latitude.value < 1.0 || latitude.value > 13.5) {
        add("latitude", "Must be between 1.0 and 13.5 for Cameroon.");
      }
    }

    const locality = cell("locality") || null;
    if (locality && (locality.length < 1 || locality.length > 160)) {
      add("locality", "Must be at most 160 characters.");
    }

    const agentSlug = cell("agentSlug") || null;

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      rejectedCount += 1;
      continue;
    }

    rows.push({
      line,
      slug,
      title,
      description,
      listingType: listingType as ListingType,
      // Casts here are safe because the row is rejected above when the cell is not
      // a member of the list; the validator is what guarantees the union.
      propertyKind: propertyKind as ListingPropertyKind,
      propertyType: propertyType as PropertyType,
      status: status as ListingStatus,
      source: source as ListingSource,
      regionId: regionId as string,
      divisionId,
      subdivisionId,
      locality,
      highlights: parseListCell(cell("highlights")),
      amenities: parseListCell(cell("amenities")),
      priceMinor: price.value,
      currency,
      pricePeriod: pricePeriod as PricePeriod,
      priceOnRequest: priceOnRequest.value,
      landAreaSqm: landArea.value,
      buildingAreaSqm: buildingArea.value,
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      yearBuilt: yearBuilt.value,
      agentSlug,
      exactLongitude: longitude.value,
      exactLatitude: latitude.value,
    });
  }

  return {
    rows,
    issues,
    rejectedCount,
    hasErrors: issues.length > 0,
  };
}

/**
 * Format a report for an operator.
 *
 * Grouped by line so a row with three problems reads as three lines under one
 * heading, rather than interleaving with the next row's problems.
 */
export function formatImportReport(report: ImportReport, maxIssues = 100): string {
  const lines: string[] = [];

  const accepted = report.rows.length;
  lines.push(
    `${accepted} row${accepted === 1 ? "" : "s"} valid, ${report.rejectedCount} rejected, ${report.issues.length} problem${report.issues.length === 1 ? "" : "s"}.`,
  );

  const byLine = new Map<number, ImportIssue[]>();
  for (const issue of report.issues) {
    const existing = byLine.get(issue.line);
    if (existing) existing.push(issue);
    else byLine.set(issue.line, [issue]);
  }

  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);
  let shown = 0;

  for (const line of sortedLines) {
    if (shown >= maxIssues) {
      lines.push(`… and ${report.issues.length - shown} more.`);
      break;
    }
    const heading = line === 1 ? "Header" : `Line ${line}`;
    lines.push(`${heading}:`);
    for (const issue of byLine.get(line) as ImportIssue[]) {
      if (shown >= maxIssues) break;
      lines.push(
        issue.column ? `  ${issue.column}: ${issue.message}` : `  ${issue.message}`,
      );
      shown += 1;
    }
  }

  return lines.join("\n");
}

/** Column documentation, shown next to the upload control. */
export const IMPORT_COLUMNS: readonly {
  name: string;
  required: boolean;
  description: string;
}[] = [
  { name: "slug", required: true, description: "Lowercase words joined by hyphens." },
  { name: "title", required: true, description: "4–200 characters." },
  { name: "description", required: true, description: "20–20000 characters." },
  { name: "listingType", required: true, description: LISTING_TYPES.join(" | ") },
  { name: "propertyKind", required: true, description: "house, villa, land, …" },
  { name: "propertyType", required: true, description: PROPERTY_TYPES.join(" | ") },
  { name: "regionCode", required: true, description: "Two-letter region code, e.g. SW." },
  { name: "divisionCode", required: false, description: "Required if subdivisionCode is set." },
  { name: "subdivisionCode", required: false, description: "Must belong to the division." },
  { name: "locality", required: false, description: "Town, quarter or landmark." },
  { name: "status", required: false, description: "Must be draft or blank. Default draft." },
  { name: "source", required: false, description: "Default import." },
  { name: "highlights", required: false, description: "Separate with |." },
  { name: "amenities", required: false, description: "Slugs, separate with |." },
  { name: "price", required: false, description: "Whole francs. Blank if on request." },
  { name: "currency", required: false, description: "Default XAF." },
  { name: "pricePeriod", required: false, description: "Defaulted from listingType." },
  { name: "priceOnRequest", required: false, description: "yes/no. Blank price if yes." },
  { name: "landAreaSqm", required: false, description: "Positive whole number." },
  { name: "buildingAreaSqm", required: false, description: "Positive whole number." },
  { name: "bedrooms", required: false, description: "0–50." },
  { name: "bathrooms", required: false, description: "0–50." },
  { name: "yearBuilt", required: false, description: "1800–2100." },
  { name: "agentSlug", required: false, description: "Assign to an agent by slug." },
  { name: "longitude", required: false, description: "8.0–17.0. Both coordinates or neither." },
  { name: "latitude", required: false, description: "1.0–13.5. Both coordinates or neither." },
];

/** The exact header an operator should use, for the downloadable template. */
export const IMPORT_TEMPLATE_HEADER = IMPORT_COLUMNS.map((c) => c.name).join(",");
