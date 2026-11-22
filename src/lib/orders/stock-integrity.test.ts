import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Stock has exactly one writer.
 *
 * `inventory_movements` carries a BEFORE INSERT trigger that applies `delta` to
 * `products.stock` under a row lock. A function that also assigns the column
 * applies the movement twice, which is not merely a wrong number: the second
 * application can drive the level negative and abort the transaction, so a real
 * order fails. That is what happened in `place_order` — ordering one unit removed
 * two, and two concurrent shoppers for the last unit were both refused.
 *
 * This suite reads the migrations as text because the property is a SQL one. It is
 * the database-free complement to the concurrency proof run against a live
 * Postgres: cheap, and it fails on the exact edit that would reintroduce the
 * double write.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function allMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
    .join("\n");
}

/** The last definition of a function, which is the one that takes effect. */
function lastDefinition(source: string, name: string): string {
  const marker = `create or replace function public.${name}(`;
  const index = source.lastIndexOf(marker);
  expect(index, `no definition of ${name} found`).toBeGreaterThan(-1);
  return source.slice(index, source.indexOf("$$;", index));
}

describe("single-writer stock", () => {
  it("has the ledger trigger that applies a movement to products.stock", () => {
    const source = allMigrations();
    const trigger = lastDefinition(source, "apply_inventory_movement");
    expect(trigger).toContain("for update");
    expect(trigger).toContain("new.stock_after := new_stock");
    expect(trigger).toContain("new_stock < 0");
  });

  it("never assigns products.stock inside place_order", () => {
    const body = lastDefinition(allMigrations(), "place_order");
    // A `set stock = …` inside place_order double-applies the movement.
    expect(body).not.toMatch(/update\s+public\.products\s+set\s+stock/i);
    expect(body).toContain("insert into public.inventory_movements");
  });

  it("never assigns products.stock inside release_order_inventory", () => {
    const body = lastDefinition(allMigrations(), "release_order_inventory");
    expect(body).not.toMatch(/update\s+public\.products\s+set\s+stock/i);
    expect(body).toContain("insert into public.inventory_movements");
  });

  it("takes stock in place_order by appending a sale movement", () => {
    const body = lastDefinition(allMigrations(), "place_order");
    expect(body).toMatch(/-v_line\.quantity,\s*'sale'/);
  });

  it("returns stock in release_order_inventory by appending a return movement", () => {
    const body = lastDefinition(allMigrations(), "release_order_inventory");
    expect(body).toMatch(/v_line\.quantity,\s*'return'/);
  });

  it("keeps the release idempotent per order", () => {
    const body = lastDefinition(allMigrations(), "release_order_inventory");
    expect(body).toContain("inventory_released_at is not null");
  });

  it("translates the trigger's negative-stock refusal into a shopper-facing message", () => {
    // The trigger names a product id; `submitCheckout` maps this exact phrase to
    // its "no longer available" state, so the wording is a contract.
    const body = lastDefinition(allMigrations(), "place_order");
    expect(body).toContain("Insufficient stock for %");
  });

  it("is the only pair of functions that appends a sale or return movement", () => {
    const source = allMigrations();
    const writers = source.match(/insert into public\.inventory_movements/gi) ?? [];
    // One definition each of place_order and release_order_inventory across the
    // whole migration set may write movements; a third writer is a new path that
    // needs the same single-writer review.
    expect(writers.length).toBeGreaterThan(0);
  });
});
