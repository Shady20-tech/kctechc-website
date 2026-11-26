import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260101000083_restore_department_editor_execute.sql",
);

describe("is_department_editor EXECUTE grant", () => {
  it("grants the predicate to every role its policies run as", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.is_department_editor\(text\)\s+to\s+anon,\s*authenticated,\s*service_role/i,
    );
  });

  it("proves the grant inside the migration", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("has_function_privilege('anon'");
    expect(sql).toContain("has_function_privilege('authenticated'");
    expect(sql).toContain("has_function_privilege('service_role'");
  });
});
