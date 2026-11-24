/**
 * What a customer can save.
 *
 * A leaf module with no imports so the Client Component that renders the heart
 * and the Server Action that writes the row share one closed list. The database
 * keeps one table per type rather than a polymorphic pair, which is what lets
 * each favourite carry a real foreign key and cascade.
 */
export const FAVORITE_ENTITY_TYPES = ["listing", "product", "insight"] as const;

export type FavoriteEntityType = (typeof FAVORITE_ENTITY_TYPES)[number];

export function isFavoriteEntityType(
  value: unknown,
): value is FavoriteEntityType {
  return (
    typeof value === "string" &&
    (FAVORITE_ENTITY_TYPES as readonly string[]).includes(value)
  );
}

export type FavoriteActionResult =
  | { status: "ok"; saved: boolean }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "error" };
