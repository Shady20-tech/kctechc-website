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

/**
 * The `VALUES` rows of a generated geography insert.
 *
 * The migration is generated from a vetted dataset, so the counts and the
 * referential integrity are the things worth asserting — a dataset swap or a
 * careless edit that drops rows or mis-parents them is otherwise invisible until
 * a visitor finds an empty selector. Deliberately not a database connection: this
 * must run without Postgres.
 */
function parseRows(sql: string): string[][] {
  const rows: string[][] = [];
  for (const line of sql.split("\n")) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) continue;
    const inner = trimmed.slice(1, -1);
    const values = inner.match(/'((?:[^']|'')*)'/g) ?? [];
    rows.push(values.map((v) => v.slice(1, -1).replace(/''/g, "'")));
  }
  return rows;
}

function blockBetween(sql: string, start: string, end: string): string {
  const i = sql.indexOf(start);
  const j = sql.indexOf(end, i);
  if (i === -1 || j === -1) throw new Error(`markers not found: ${start}`);
  return sql.slice(i, j);
}

describe("Cameroon geography migration", () => {
  const sql = readMigration("cameroon_divisions_and_subdivisions");

  const regionBlock = blockBetween(
    sql,
    "insert into public.regions",
    "on conflict (code) do nothing;",
  );
  const divisionBlock = blockBetween(
    sql,
    "with data(code, region_code, name, name_fr, slug)",
    "insert into public.divisions",
  );
  const subdivisionBlock = blockBetween(
    sql,
    "with data(code, division_code, name, name_fr, slug)",
    "insert into public.subdivisions",
  );

  const regions = parseRows(regionBlock);
  const divisions = parseRows(divisionBlock);
  const subdivisions = parseRows(subdivisionBlock);

  it("seeds the ten regions", () => {
    expect(regions).toHaveLength(10);
  });

  it("seeds all 58 divisions", () => {
    expect(divisions).toHaveLength(58);
  });

  it("seeds all 360 subdivisions", () => {
    expect(subdivisions).toHaveLength(360);
  });

  it("parents every division to a seeded region", () => {
    const regionCodes = new Set(regions.map((r) => r[0]));
    for (const [code, regionCode] of divisions.map((d) => [d[0], d[1]])) {
      expect(regionCodes.has(regionCode!), `division ${code}`).toBe(true);
    }
  });

  it("parents every subdivision to a seeded division", () => {
    const divisionCodes = new Set(divisions.map((d) => d[0]));
    for (const [code, divisionCode] of subdivisions.map((s) => [s[0], s[1]])) {
      expect(divisionCodes.has(divisionCode!), `subdivision ${code}`).toBe(
        true,
      );
    }
  });

  it("uses unique codes and slugs at every level", () => {
    for (const rows of [regions, divisions, subdivisions]) {
      const codes = rows.map((r) => r[0]);
      // The slug is the last quoted value in every row shape: regions end at
      // `slug` before the unquoted `sort_order`, divisions and subdivisions end
      // at `slug`.
      const slugs = rows.map((r) => r[r.length - 1]);
      expect(new Set(codes).size).toBe(codes.length);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("uses slugs that satisfy the tables' format check", () => {
    for (const rows of [divisions, subdivisions]) {
      for (const slug of rows.map((r) => r[4])) {
        expect(slug, `slug ${slug}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });

  it("uses codes that satisfy the tables' format check", () => {
    for (const rows of [divisions, subdivisions]) {
      for (const code of rows.map((r) => r[0])) {
        expect(code, `code ${code}`).toMatch(/^[A-Z0-9-]{2,16}$/);
      }
    }
  });

  it("restates the region rows exactly as the seed does", () => {
    // `HOME_REGION_SLUG` and the region landing pages resolve `northwest` /
    // `southwest`; the dataset spells them `north-west` / `south-west`, so the
    // migration must keep the seed's spelling or a fresh database gets different
    // slugs than production.
    const slugs = regions.map((r) => r[3]);
    expect(slugs).toContain("northwest");
    expect(slugs).toContain("southwest");
    expect(slugs).not.toContain("north-west");
    expect(slugs).not.toContain("south-west");
  });

  it("attributes the CC BY 4.0 source", () => {
    // The licence requires attribution, and a database seed is a redistribution.
    expect(sql).toContain("open-admin-data/cameroon-administrative-divisions");
    expect(sql).toContain("CC BY 4.0");
  });
});

describe("head-office locality migration", () => {
  const sql = readMigration("correct_head_office_locality");

  it("sets the locality to Limbe", () => {
    expect(sql).toContain("'city', 'Limbe'");
    expect(sql).not.toContain("Limbo");
  });

  it("rewrites only the address key of the contact row", () => {
    expect(sql).toContain("jsonb_set(");
    expect(sql).toContain("'{address}'");
    expect(sql).toContain("where key = 'site.contact'");
  });
});
