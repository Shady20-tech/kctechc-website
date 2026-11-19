import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.includes(nameFragment));
  if (!file) {
    throw new Error(`No migration matching "${nameFragment}" in ${MIGRATIONS_DIR}`);
  }
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

/**
 * Strip `--` comments, so an assertion about what the migration *executes* is not
 * fooled by prose. The header deliberately discusses the CSV codes it does not
 * adopt, and the one unaccented value it rejects.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const index = line.indexOf("--");
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");
}

/**
 * The geography reference migration is applied to a database that already holds
 * the hierarchy, so the risks are different from a seed: it must be idempotent,
 * it must not re-code the dataset, and every column it adds must be constrained.
 *
 * A database-free guard is worth having because none of these failures throw in
 * TypeScript, and the local harness needs Postgres. Each assertion below pins a
 * decision that is cheap to undo by accident and expensive to notice.
 */
describe("geography reference migration", () => {
  const raw = readMigration("geography_reference_data");
  const sql = stripSqlComments(raw);

  it("is safely re-runnable", () => {
    // Every structural change must tolerate a second application.
    expect(sql).toContain("add column if not exists");
    expect(sql).toContain("drop constraint if exists");
    expect(sql).toContain("create index if not exists");
    expect(sql).toContain("or replace function");
    expect(sql).toContain("drop trigger if exists");
  });

  it("does not renumber the existing dataset codes", () => {
    // The CSVs use `CA-AD` style codes; adopting them would break every row that
    // already references the hierarchy and the `regions_code_format` check.
    expect(sql).not.toMatch(/update\s+public\.regions\s+set\s+code/i);
    expect(sql).not.toMatch(/update\s+public\.divisions\s+set\s+code/i);
    expect(sql).not.toMatch(/update\s+public\.subdivisions\s+set\s+code/i);
    expect(sql).not.toContain("CM-AD");
  });

  it("never changes a slug, so no URL moves", () => {
    // Slugs are what a filtered URL and a canonical link use, so a rename must
    // not touch them.
    expect(sql).not.toMatch(/set\s+[^;]*\bslug\s*=/i);
  });

  it("constrains every column it adds", () => {
    for (const table of [
      "electrical_projects",
      "agent_profiles",
      "inquiries",
      "profiles",
    ]) {
      expect(sql, `${table} division FK`).toMatch(
        new RegExp(`${table}_division_fkey`),
      );
      expect(sql, `${table} subdivision FK`).toMatch(
        new RegExp(`${table}_subdivision_fkey`),
      );
      // Without this, a subdivision could be stored with no division: a
      // composite FK is skipped when one of its columns is NULL.
      expect(sql, `${table} depth check`).toMatch(
        new RegExp(`${table}_geography_depth`),
      );
    }
  });

  it("uses composite foreign keys, not per-column references", () => {
    // A per-column FK cannot tell that a subdivision belongs to the chosen
    // division; the composite key is the whole point.
    expect(sql).toContain("foreign key (division_id, region_id)");
    expect(sql).toContain(
      "foreign key (subdivision_id, division_id, region_id)",
    );
  });

  it("keeps the depth contiguous when a region is cleared", () => {
    // `region_id` is `on delete set null`, which would otherwise leave a
    // dangling division behind.
    expect(sql).toContain("clear_deeper_geography_on_region_clear");
    for (const table of [
      "electrical_projects",
      "agent_profiles",
      "inquiries",
      "profiles",
    ]) {
      expect(sql, `${table} trigger`).toContain(`${table}_clear_geography`);
    }
  });

  it("exposes the reference tree to a browser, and only that", () => {
    expect(sql).toContain("create or replace function public.geography_reference_tree()");
    // Read-only and invoker-rights: RLS stays the access control.
    expect(sql).toContain("security invoker");
    expect(sql).toContain("grant execute on function public.geography_reference_tree() to anon, authenticated");
  });

  it("classifies every new function for the browser key", () => {
    // Supabase grants EXECUTE on a new function to anon/authenticated by default,
    // so each one must be deliberately revoked or granted. The trigger function
    // is revoked; the reference RPC is granted.
    const revokes = sql.match(/revoke all on function[\s\S]*?;/g) ?? [];
    expect(revokes.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain(
      "revoke all on function public.clear_deeper_geography_on_region_clear() from anon, authenticated",
    );
  });

  it("adopts the accented names without inventing corrections", () => {
    // Spot-checks across the three kinds of fix: a diacritic, a hyphen, and a
    // spelling change that is not merely cosmetic.
    expect(sql).toContain("'Ngaoundéré 1er'");
    expect(sql).toContain("'Ekondo-Titi'");
    expect(sql).toContain("'Upper-Bayang'");
    expect(sql).toContain("'Bangangté'");
    // The one CSV value that would LOSE a correct accent must not be applied.
    expect(sql).not.toContain("Lom-et-Djerem");
  });

  it("guards each name correction with its stale value", () => {
    // `where code = ... and name = <stale>` makes each update a no-op once
    // applied, and prevents clobbering a hand-edited name.
    const updates = sql.match(/update public\.\w+s set name = [\s\S]*?;/g) ?? [];
    expect(updates.length).toBe(34);
    for (const update of updates) {
      expect(update).toMatch(/where code = '[A-Z0-9]+' and name = /);
    }
  });

  it("leaves locality as free text", () => {
    // A neighbourhood is not an administrative level in the dataset; a
    // `neighbourhoods` table would be fabricated geography.
    expect(sql).not.toMatch(/create table public\.neighbourhoods/i);
  });
});
