import type { RegionRecord } from "./types";

/**
 * The ten Regions of Cameroon.
 *
 * These are the only administrative level supplied by the business brief, and
 * they mirror the `regions` rows seeded in `supabase/seed.sql` exactly — same
 * slugs, same names, same French names. Divisions and subdivisions are
 * deliberately absent: the brief does not supply them, and guessing an
 * administrative hierarchy would put invented geography on a production path.
 *
 * This module exists so the project filter and the quote form's location field
 * have a region list to offer when Supabase is unconfigured, and so the two
 * cannot drift from each other or from the seed.
 */
export const REGIONS: readonly RegionRecord[] = [
  { slug: "adamawa", name: "Adamawa", nameFr: "Adamaoua" },
  { slug: "centre", name: "Centre", nameFr: "Centre" },
  { slug: "east", name: "East", nameFr: "Est" },
  { slug: "far-north", name: "Far North", nameFr: "Extrême-Nord" },
  { slug: "littoral", name: "Littoral", nameFr: "Littoral" },
  { slug: "north", name: "North", nameFr: "Nord" },
  { slug: "northwest", name: "Northwest", nameFr: "Nord-Ouest" },
  { slug: "west", name: "West", nameFr: "Ouest" },
  { slug: "south", name: "South", nameFr: "Sud" },
  { slug: "southwest", name: "Southwest", nameFr: "Sud-Ouest" },
];

export const REGION_SLUGS: readonly string[] = REGIONS.map(
  (region) => region.slug,
);

export function isRegionSlug(value: string): boolean {
  return REGION_SLUGS.includes(value);
}

export function findRegion(slug: string): RegionRecord | undefined {
  return REGIONS.find((region) => region.slug === slug);
}

/**
 * The corporate home region.
 *
 * The brief places the company in Half-Mile, Limbe, Southwest Region. Used to
 * order the region list so the home region is offered first, which is where most
 * requests originate — not as a default, because guessing a visitor's location
 * is exactly the kind of assumption the language-neutral gateway exists to avoid.
 */
export const HOME_REGION_SLUG = "southwest";

/** Regions with the home region first, then the rest in their seeded order. */
export function regionsHomeFirst(): readonly RegionRecord[] {
  const home = REGIONS.find((region) => region.slug === HOME_REGION_SLUG);
  if (!home) return REGIONS;
  return [home, ...REGIONS.filter((region) => region.slug !== HOME_REGION_SLUG)];
}
