import { LISTING_PROPERTY_KINDS, type ListingPropertyKind } from "./enums";

/**
 * Which listing fields make sense for a given property kind.
 *
 * A listing form that shows every column is wrong for most properties: bare land
 * has no bedrooms, a warehouse has no bedrooms either, and a plot has no building
 * area. Showing those inputs invites an owner to invent a number to get past a
 * field they think is required, which is worse than not asking.
 *
 * This module is the single rule. The dashboard form, the console form and the
 * tests all read it, so the three cannot drift into disagreeing about whether
 * bedrooms apply to a farm.
 *
 * Nothing here is a validation rule: every one of these columns is nullable and
 * the schema accepts them empty for every kind. This decides *presentation* only.
 * Hiding a field never makes a listing invalid, and a value already stored is
 * still shown when editing, so switching a listing's kind does not silently drop
 * data the owner entered earlier.
 */

/** Kinds that describe a building people live or work inside. */
const ROOM_KINDS: readonly ListingPropertyKind[] = [
  "house",
  "apartment",
  "villa",
  "duplex",
  "studio",
  "bungalow",
  "guesthouse",
];

/** Kinds where a year of construction is meaningful. */
const BUILT_KINDS: readonly ListingPropertyKind[] = [
  ...ROOM_KINDS,
  "office",
  "shop",
  "warehouse",
  "hotel",
  "restaurant",
  "mixed_use",
];

/** Kinds that are land rather than a structure. */
const LAND_KINDS: readonly ListingPropertyKind[] = ["land", "farm"];

export type FieldRelevance = {
  /** Bedrooms and bathrooms. */
  rooms: boolean;
  /** Building area, i.e. floor space under a roof. */
  buildingArea: boolean;
  /** Land area, i.e. the plot the structure sits on or the bare parcel. */
  landArea: boolean;
  /** Year of construction. */
  yearBuilt: boolean;
  /** Exact coordinates and street address. */
  coordinates: boolean;
};

const ALL: FieldRelevance = {
  rooms: true,
  buildingArea: true,
  landArea: true,
  yearBuilt: true,
  coordinates: true,
};

/**
 * Narrow a stored property kind to the enum.
 *
 * A listing read back from the database carries the column as a plain string, so
 * a form that seeds its state from it needs this rather than a cast: an
 * unrecognised value becomes `""`, which `fieldRelevanceFor` treats as "show
 * everything" instead of silently matching no branch.
 */
export function asListingPropertyKind(
  value: string | null | undefined,
): ListingPropertyKind | "" {
  return LISTING_PROPERTY_KINDS.includes(value as ListingPropertyKind)
    ? (value as ListingPropertyKind)
    : "";
}

/**
 * Resolve relevance for a property kind.
 *
 * Unknown kinds fall back to showing everything, because hiding a field the
 * operator needs is worse than showing one they can leave blank.
 */
export function fieldRelevanceFor(
  kind: ListingPropertyKind | "" | undefined,
): FieldRelevance {
  if (!kind) return ALL;

  if (LAND_KINDS.includes(kind)) {
    return {
      rooms: false,
      buildingArea: false,
      landArea: true,
      yearBuilt: false,
      // A parcel may genuinely have no coordinates: unsurveyed land, or an owner
      // who will only share the exact position after a viewing.
      coordinates: true,
    };
  }

  if (kind === "warehouse") {
    return {
      ...ALL,
      rooms: false,
    };
  }

  return {
    ...ALL,
    yearBuilt: BUILT_KINDS.includes(kind),
  };
}

/**
 * Whether a stored value must stay visible even when its field is hidden.
 *
 * Hiding a field that already holds a value would make the data unreachable: the
 * owner could neither see nor clear it, and the next save would silently drop it.
 * So a field is rendered when it is relevant *or* already populated.
 */
export function shouldRenderField(
  relevant: boolean,
  existingValue: string | number | null | undefined,
): boolean {
  if (relevant) return true;
  if (existingValue === null || existingValue === undefined) return false;
  return String(existingValue).trim() !== "";
}
