import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260101000081_general_favorites.sql",
  ),
  "utf8",
);

describe("general favorites migration", () => {
  it("creates the product and insight favourite tables", () => {
    expect(sql).toMatch(/create table public\.product_favorites/i);
    expect(sql).toMatch(/create table public\.insight_favorites/i);
  });

  it("uses a real cascade foreign key per entity", () => {
    expect(sql).toMatch(
      /references public\.products \(id\) on delete cascade/i,
    );
    expect(sql).toMatch(
      /references public\.insights \(id\) on delete cascade/i,
    );
  });

  it("allows one row per user and entity", () => {
    expect(sql).toMatch(/unique \(user_id, product_id\)/i);
    expect(sql).toMatch(/unique \(user_id, insight_id\)/i);
  });

  it("enables RLS and only own-row select, insert and delete policies", () => {
    for (const table of ["product_favorites", "insight_favorites"]) {
      expect(sql).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          "i",
        ),
      );
      for (const action of ["select", "insert", "delete"]) {
        expect(sql).toMatch(
          new RegExp(
            `create policy "${table}_${action}_own"[\\s\\S]*?to authenticated[\\s\\S]*?auth\\.uid\\(\\) = user_id`,
            "i",
          ),
        );
      }
    }
    expect(sql).not.toMatch(/for update/i);
  });

  it("does not create a function that would need EXECUTE classification", () => {
    expect(sql).not.toMatch(/create (or replace )?function/i);
  });
});
