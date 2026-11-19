import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) =>
    f.includes(nameFragment),
  );
  if (!file) {
    throw new Error(
      `No migration matching "${nameFragment}" in ${MIGRATIONS_DIR}`,
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

/** Strip `--` comments so assertions target what the migration executes. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const index = line.indexOf("--");
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");
}

const sql = stripSqlComments(readMigration("region_and_division_headquarters"));
const hierarchySql = stripSqlComments(
  readMigration("cameroon_divisions_and_subdivisions"),
);

/** The seeded hierarchy's own codes, read from the migration that created it. */
function seededRegionCodes(): string[] {
  const block = hierarchySql.slice(
    hierarchySql.indexOf("insert into public.regions"),
  );
  const body = block.slice(0, block.indexOf("on conflict (code) do nothing;"));
  return [...body.matchAll(/\('([A-Z]{2})',\s*'/g)].map((m) => m[1]!);
}

function seededDivisionCodes(): string[] {
  return [...hierarchySql.matchAll(/^\s*\('(CM\d{6})',\s*'[A-Z]{2}',/gm)].map(
    (m) => m[1]!,
  );
}

/**
 * Headquarters is the one piece of the geography dataset that was supplied but
 * never stored. The migration that adds it is easy to get subtly wrong — a
 * mis-keyed code silently updates nothing, because `update ... where code = ...`
 * on a non-existent code succeeds having touched zero rows.
 */
describe("region and division headquarters migration", () => {
  it("adds the column to regions and divisions only", () => {
    expect(sql).toContain("alter table public.regions");
    expect(sql).toContain("alter table public.divisions");
    // The dataset supplies no subdivision headquarters, so one must not appear.
    expect(sql).not.toMatch(
      /alter table public\.subdivisions[\s\S]{0,200}headquarters/,
    );
  });

  it("adds both columns as nullable text", () => {
    expect(sql).toMatch(/add column if not exists headquarters text/);
    expect(sql).not.toMatch(/headquarters text not null/);
  });

  it("is idempotent, so re-applying it does not fail", () => {
    expect(sql).toMatch(/add column if not exists/);
    expect(sql).toMatch(/where conname = 'regions_headquarters_not_blank'/);
    expect(sql).toMatch(/where conname = 'divisions_headquarters_not_blank'/);
  });

  it("constrains a blank headquarters away", () => {
    expect(sql).toMatch(
      /check \(headquarters is null or btrim\(headquarters\) <> ''\)/,
    );
    // Once per table, so a blank cannot slip through on either level.
    expect(
      sql.match(
        /check \(headquarters is null or btrim\(headquarters\) <> ''\)/g,
      ),
    ).toHaveLength(2);
  });

  it("backfills all ten regions, each to a code that exists", () => {
    const updated = [
      ...sql.matchAll(
        /update public\.regions set headquarters = '(?:[^']|'')*' where code = '([A-Z]{2})';/g,
      ),
    ].map((m) => m[1]!);

    expect(updated).toHaveLength(10);
    expect(new Set(updated).size).toBe(10);
    const seeded = seededRegionCodes();
    expect(seeded).toHaveLength(10);
    // A code that is not in the seed updates nothing and reports success.
    for (const code of updated) {
      expect(seeded).toContain(code);
    }
    expect(new Set(updated)).toEqual(new Set(seeded));
  });

  it("backfills all 58 divisions, each to a code that exists", () => {
    const updated = [
      ...sql.matchAll(
        /update public\.divisions set headquarters = '(?:[^']|'')*' where code = '(CM\d{6})';/g,
      ),
    ].map((m) => m[1]!);

    expect(updated).toHaveLength(58);
    expect(new Set(updated).size).toBe(58);
    const seeded = seededDivisionCodes();
    expect(seeded).toHaveLength(58);
    for (const code of updated) {
      expect(seeded).toContain(code);
    }
    expect(new Set(updated)).toEqual(new Set(seeded));
  });

  it("resolves the two regions whose code differs from the CSV", () => {
    // The CSV uses WE/SO; this schema uses OU/SU. A copy of the CSV's codes
    // would update zero rows for West and South and leave them null.
    expect(sql).toMatch(/headquarters = 'Bafoussam' where code = 'OU';/);
    expect(sql).toMatch(/headquarters = 'Ebolowa' where code = 'SU';/);
    expect(sql).not.toMatch(/where code = 'WE';/);
    expect(sql).not.toMatch(/where code = 'SO';/);
  });

  it("writes no blank headquarters value", () => {
    const values = [
      ...sql.matchAll(/set headquarters = '((?:[^']|'')*)'/g),
    ].map((m) => m[1]!);
    expect(values.length).toBeGreaterThanOrEqual(68);
    for (const value of values) {
      expect(value.trim()).not.toBe("");
    }
  });

  it("asserts its own completeness, so a partial backfill aborts", () => {
    expect(sql).toMatch(/expected 10 regions/);
    expect(sql).toMatch(/expected 58 divisions/);
    expect(sql).toMatch(/raise exception/);
  });
});

describe("headquarters validation script", () => {
  const validate = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "validate",
      "140_headquarters_behaviour.sql",
    ),
    "utf8",
  );

  it("exists and asserts rather than only reading", () => {
    expect(validate).toMatch(/raise exception/);
  });

  it("cites the division code that actually belongs to the division it names", () => {
    // Wouri is CM005004; asserting against CM005002 (Nkam) would fail the run.
    expect(validate).toMatch(/code = 'CM005004' and headquarters = 'Douala'/);
    expect(validate).not.toMatch(
      /code = 'CM005002' and headquarters = 'Douala'/,
    );
  });

  it("proves subdivisions were left without a headquarters", () => {
    expect(validate).toMatch(/table_name = 'subdivisions'/);
  });
});

/**
 * The CSVs under `supabase/data/` are the input the migrations were derived
 * from, so a later correction can be diffed rather than retyped. Committing them
 * is only useful if they still describe what the database holds: an edited CSV
 * that nobody re-applied is a second, silently divergent source of truth.
 */
describe("committed geography dataset", () => {
  const dataDir = join(process.cwd(), "supabase", "data");

  function readCsv(name: string): string[][] {
    const text = readFileSync(join(dataDir, name), "utf8").replace(
      /^\uFEFF/,
      "",
    );
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const columns = header!.split(",");
    return rows.map((row) => {
      // These files contain no quoted commas, so a split is faithful; assert it
      // rather than assume it, so a future hand-edit with a comma fails loudly.
      const cells = row.split(",");
      expect(cells).toHaveLength(columns.length);
      return cells;
    });
  }

  it("holds 10 regions, 58 divisions and 360 subdivisions", () => {
    expect(readCsv("cameroon_regions.csv")).toHaveLength(10);
    expect(readCsv("cameroon_divisions.csv")).toHaveLength(58);
    expect(readCsv("cameroon_subdivisions.csv")).toHaveLength(360);
  });

  it("supplies a headquarters for every region and division", () => {
    const regions = readCsv("cameroon_regions.csv");
    const divisions = readCsv("cameroon_divisions.csv");
    const regionHq = regions.map((r) => r[3]!.trim());
    const divisionHq = divisions.map((r) => r[2]!.trim());

    expect(regionHq.filter((v) => v !== "")).toHaveLength(10);
    expect(divisionHq.filter((v) => v !== "")).toHaveLength(58);
  });

  it("agrees with the headquarters the migration writes", () => {
    // Every value in the migration must come from the dataset, or the two have
    // drifted and the committed CSV is no longer the derivation input.
    const datasetValues = new Set(
      [
        ...readCsv("cameroon_regions.csv").map((r) => r[3]!.trim()),
        ...readCsv("cameroon_divisions.csv").map((r) => r[2]!.trim()),
      ].map((v) => v.replace(/'/g, "''")),
    );

    const migrationValues = [
      ...sql.matchAll(/set headquarters = '((?:[^']|'')*)'/g),
    ].map((m) => m[1]!);

    expect(migrationValues).toHaveLength(68);
    for (const value of migrationValues) {
      expect(datasetValues).toContain(value);
    }
  });

  it("keeps the per-region counts internally consistent", () => {
    const regions = readCsv("cameroon_regions.csv");
    const divisions = readCsv("cameroon_divisions.csv");
    const subdivisions = readCsv("cameroon_subdivisions.csv");

    const declaredDivisions = regions.reduce(
      (total, row) => total + Number(row[4]),
      0,
    );
    const declaredSubdivisions = regions.reduce(
      (total, row) => total + Number(row[5]),
      0,
    );

    expect(declaredDivisions).toBe(divisions.length);
    expect(declaredSubdivisions).toBe(subdivisions.length);
  });
});
