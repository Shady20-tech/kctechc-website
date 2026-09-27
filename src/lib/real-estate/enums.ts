/**
 * The real-estate enum vocabularies, mirrored from the database.
 *
 * These are the values the import validator and the admin forms accept. They are
 * declared here rather than fetched from the database because a form needs them
 * synchronously, and they are asserted against the migration that defines them by
 * `enums.test.ts` — so the two cannot drift silently. Without that test this file
 * would be a second source of truth that goes stale the first time an enum gains
 * a member, and the failure would be a confusing "invalid value" on a value the
 * database accepts.
 */

export const LISTING_TYPES = ["sale", "rent", "lease", "short_term"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "under_offer",
  "sold",
  "rented",
  "archived",
  "rejected",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_PROPERTY_KINDS = [
  "house",
  "apartment",
  "villa",
  "duplex",
  "studio",
  "bungalow",
  "land",
  "farm",
  "office",
  "shop",
  "warehouse",
  "hotel",
  "guesthouse",
  "restaurant",
  "mixed_use",
  "other",
] as const;
export type ListingPropertyKind = (typeof LISTING_PROPERTY_KINDS)[number];

/** The broad class, reused from the electrical domain. */
export const PROPERTY_TYPES = ["residential", "commercial", "industrial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PRICE_PERIODS = [
  "total",
  "monthly",
  "quarterly",
  "yearly",
  "weekly",
  "nightly",
] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];

export const LISTING_SOURCES = [
  "admin",
  "agent",
  "owner_submission",
  "import",
] as const;
export type ListingSource = (typeof LISTING_SOURCES)[number];

export const SUBMISSION_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * The price periods that are valid for a listing type.
 *
 * Mirrors the `property_listings_period_matches_type` constraint. Exported so the
 * admin form can narrow its options and the import can reject a bad pair with the
 * same message the database would produce, rather than letting the insert fail
 * with a constraint name.
 */
export const PRICE_PERIODS_BY_LISTING_TYPE: Record<ListingType, readonly PricePeriod[]> = {
  sale: ["total"],
  rent: ["monthly", "quarterly", "yearly"],
  lease: ["monthly", "quarterly", "yearly"],
  short_term: ["nightly", "weekly", "monthly"],
};

/**
 * The fields indexed for translation.
 *
 * Must match `property_translatable_fields()` in
 * `20260101000022_listing_translation_index.sql`; asserted by
 * `src/lib/translation/keys.test.ts`.
 */
export const PROPERTY_TRANSLATABLE_FIELDS = [
  "title",
  "description",
  "highlights",
  "slug",
  "seo_title",
  "seo_description",
] as const;

/** The listing statuses a visitor may see. */
export const PUBLIC_LISTING_STATUSES = [
  "published",
  "under_offer",
  "sold",
  "rented",
] as const satisfies readonly ListingStatus[];
