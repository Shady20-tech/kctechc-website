import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/lib/favorites/actions.ts"),
  "utf8",
);

describe("toggleFavoriteAction", () => {
  it("writes through the session client, never the service-role client", () => {
    expect(source).toContain("createClient");
    expect(source).not.toContain("createAdminClient");
  });

  it("maps each entity type to its own table and foreign key", () => {
    for (const [table, column] of [
      ["listing_favorites", "listing_id"],
      ["product_favorites", "product_id"],
      ["insight_favorites", "insight_id"],
    ]) {
      expect(source).toContain(table);
      expect(source).toContain(column);
    }
  });

  it("validates the entity type before reading the session", () => {
    expect(
      source.indexOf("if (!isFavoriteEntityType(entityType)"),
    ).toBeLessThan(source.indexOf("const auth = await getAuthState()"));
  });
});
