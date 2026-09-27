import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LISTING_PROPERTY_KINDS,
  LISTING_SOURCES,
  LISTING_STATUSES,
  LISTING_TYPES,
  PRICE_PERIODS,
  PRICE_PERIODS_BY_LISTING_TYPE,
  PROPERTY_TRANSLATABLE_FIELDS,
  PROPERTY_TYPES,
  SUBMISSION_STATUSES,
} from "./enums";

/**
 * Guards against the TypeScript enum mirrors drifting from the database.
 *
 * `enums.ts` duplicates the migration's vocabularies so a form can use them
 * synchronously. That duplication is only safe if it is checked: a value added to
 * a migration but not to the mirror means a form rejects a value the database
 * accepts, and a value in the mirror that is not in the database means an import
 * that fails on a constraint after passing validation.
 *
 * These tests read the migration files as text. That is deliberately not a
 * database connection — a unit test should not require a running Postgres — but
 * it does mean the parse is simple and must be kept simple. It asserts the
 * specific migrations that define these enums.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) =>
    f.includes(nameFragment),
  );
  if (!file) {
    throw new Error(`No migration matching "${nameFragment}" in ${MIGRATIONS_DIR}`);
  }
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

/**
 * Extract the members of `create type public.<name> as enum (...)`.
 *
 * A migration may add values later with `alter type ... add value`, so callers
 * pass every source that contributes members.
 */
function enumMembers(sql: string, typeName: string): string[] {
  const createPattern = new RegExp(
    `create type public\\.${typeName} as enum\\s*\\(([^)]*)\\)`,
    "i",
  );
  const create = sql.match(createPattern);
  const members: string[] = [];

  const createBody = create?.[1];
  if (createBody) {
    for (const match of createBody.matchAll(/'([^']+)'/g)) {
      if (match[1]) members.push(match[1]);
    }
  }

  // Values appended after the initial definition.
  const alterPattern = new RegExp(
    `alter type public\\.${typeName} add value(?: if not exists)? '([^']+)'`,
    "gi",
  );
  for (const match of sql.matchAll(alterPattern)) {
    if (match[1]) members.push(match[1]);
  }

  return members;
}

/** Strip SQL comments so a commented-out example is not read as a member. */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

const realEstateEnums = stripSqlComments(
  readMigration("real_estate_enums"),
);
const allMigrations = stripSqlComments(
  readdirSync(MIGRATIONS_DIR)
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n"),
);

describe("enum mirrors match the migrations", () => {
  it("listing_type", () => {
    expect([...LISTING_TYPES]).toEqual(
      enumMembers(realEstateEnums, "listing_type"),
    );
  });

  it("listing_status", () => {
    expect([...LISTING_STATUSES]).toEqual(
      enumMembers(realEstateEnums, "listing_status"),
    );
  });

  it("listing_property_kind", () => {
    expect([...LISTING_PROPERTY_KINDS]).toEqual(
      enumMembers(realEstateEnums, "listing_property_kind"),
    );
  });

  it("price_period", () => {
    expect([...PRICE_PERIODS]).toEqual(
      enumMembers(realEstateEnums, "price_period"),
    );
  });

  it("listing_source", () => {
    expect([...LISTING_SOURCES]).toEqual(
      enumMembers(realEstateEnums, "listing_source"),
    );
  });

  it("submission_status", () => {
    expect([...SUBMISSION_STATUSES]).toEqual(
      enumMembers(realEstateEnums, "submission_status"),
    );
  });

  it("property_type, defined in an earlier phase", () => {
    expect([...PROPERTY_TYPES]).toEqual(enumMembers(allMigrations, "property_type"));
  });

  it("user_role includes real_estate_admin", () => {
    const roles = enumMembers(allMigrations, "user_role");
    expect(roles).toContain("real_estate_admin");
    // The role that must NOT be treated as a real-estate administrator.
    expect(roles).toContain("real_estate_agent");
  });

  it("translatable_entity_type includes the property entities", () => {
    const types = enumMembers(allMigrations, "translatable_entity_type");
    expect(types).toContain("property_listing");
    expect(types).toContain("property_media");
  });
});

describe("property translatable fields", () => {
  it("matches property_translatable_fields() in the migration", () => {
    const sql = readMigration("listing_translation_index");
    const fn = sql.match(
      /create or replace function public\.property_translatable_fields\(\)[\s\S]*?select array\[([^\]]*)\]/i,
    );
    const fieldList = fn?.[1];
    expect(fieldList, "property_translatable_fields() not found").toBeDefined();

    const fields: string[] = [];
    for (const match of (fieldList as string).matchAll(/'([^']+)'/g)) {
      if (match[1]) fields.push(match[1]);
    }

    expect([...PROPERTY_TRANSLATABLE_FIELDS].sort()).toEqual(fields.sort());
  });
});

describe("price period / listing type agreement", () => {
  it("matches the property_listings_period_matches_type constraint", () => {
    const sql = readMigration("property_listings");
    const constraint = sql.match(
      /property_listings_period_matches_type check \(\s*case listing_type\s*([\s\S]*?)end\s*\)/i,
    );
    const body = constraint?.[1];
    expect(body, "period constraint not found").toBeDefined();

    // Each `when '<type>' then price_period in ('a', 'b')` clause.
    for (const clause of (body as string).matchAll(
      /when '([^']+)' then price_period in \(([^)]*)\)/g,
    )) {
      const listingType = clause[1] as keyof typeof PRICE_PERIODS_BY_LISTING_TYPE;
      const periods = [...(clause[2] ?? "").matchAll(/'([^']+)'/g)]
        .map((m) => m[1])
        .filter((p): p is string => p !== undefined);
      expect([...PRICE_PERIODS_BY_LISTING_TYPE[listingType]].sort()).toEqual(
        periods.sort(),
      );
    }
  });
});
