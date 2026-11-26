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
 * Invalid image references are data, so TypeScript cannot see them. The migration
 * is what repairs rows written before the media tables constrained their paths.
 * These assertions pin the table coverage that makes the cleanup complete across
 * every admin surface, and the assertion block that makes a partial repair fail.
 */
describe("invalid image reference cleanup migration", () => {
  const sql = stripSqlComments(
    readMigration("invalid_image_reference_cleanup"),
  );

  it("cleans every media and single-image table an admin surface renders", () => {
    for (const table of [
      "product_media",
      "listing_media",
      "project_media",
      "insight_media",
      "profiles",
      "agent_profiles",
      "insights",
      "listing_submissions",
      "entity_seo",
      "seo_metadata",
      "site_settings",
    ]) {
      expect(sql, `cleanup for ${table}`).toContain(table);
    }
  });

  it("recognises an absolute URL as well as the reported Imgur value", () => {
    expect(sql).toContain("^[a-z][a-z0-9+.-]*://");
    expect(sql).toContain("imgur\\.com/undefined");
  });

  it("does not demote a published product that still has a valid image", () => {
    expect(sql).toContain("not exists");
    expect(sql).toMatch(/set publish_state = 'draft'/);
  });

  it("guards the unconstrained image columns after cleaning them", () => {
    expect(sql).toContain("profiles_avatar_path_not_imgur_undefined");
    expect(sql).toContain("agent_profiles_photo_path_not_imgur_undefined");
    expect(sql).toContain("insights_cover_path_not_imgur_undefined");
    expect(sql).toContain("entity_seo_og_image_not_imgur_undefined");
    expect(sql).toContain("seo_metadata_og_image_not_imgur_undefined");
    expect(sql).toContain("site_settings_no_imgur_undefined");
  });

  it("fails rather than recording a partial repair", () => {
    expect(sql).toMatch(/raise exception 'invalid image references remain/i);
  });
});
