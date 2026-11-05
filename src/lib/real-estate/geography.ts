import type { Locale } from "@/lib/i18n/locales";

/**
 * The Cameroon geography hierarchy for the real-estate filter, as plain data.
 *
 * This module has no imports beyond the locale type and no database access: the
 * loaders fetch the rows and the counts, and `buildGeographyTree` arranges them.
 * Keeping the arrangement pure is what makes it testable without a live Supabase
 * — the shape of a 360-subdivision cascade is worth asserting directly rather
 * than inferring from a page render.
 */

export type GeographySubdivisionOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
};

export type GeographyDivisionOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
  subdivisions: readonly GeographySubdivisionOption[];
};

export type GeographyOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
  divisions: readonly GeographyDivisionOption[];
};

/** Published listing counts per geography level, keyed by the row id. */
export type GeographyCounts = {
  regions: Map<string, number>;
  divisions: Map<string, number>;
  subdivisions: Map<string, number>;
};

export function emptyGeographyCounts(): GeographyCounts {
  return { regions: new Map(), divisions: new Map(), subdivisions: new Map() };
}

export type GeographyRow = {
  id: string;
  slug: string;
  name: string;
  name_fr: string | null;
};

export type DivisionRow = GeographyRow & { region_id: string };
export type SubdivisionRow = GeographyRow & { division_id: string };

/**
 * The stored `name` is the English name and `name_fr` the French one, so the
 * selector shows the visitor's own language. Falling back to the English name
 * keeps a level visible if a translation is ever missing, rather than rendering
 * an option with no label.
 */
function localize(row: GeographyRow, locale: Locale): string {
  return locale === "fr" ? (row.name_fr ?? row.name) : row.name;
}

/**
 * Arrange flat region/division/subdivision rows into the cascade the filter
 * renders.
 *
 * Every row is kept, and a level with no published listing gets a count of `0`
 * rather than being dropped. The brief's filter is "choose the region, division
 * and subdivision" — a hierarchy the visitor should be able to see and traverse,
 * not a list that appears only where inventory happens to exist today. Hiding
 * empty branches also made the selectors look broken: with no divisions seeded at
 * all, both lower selects were permanently disabled and there was nothing to
 * choose. The count beside an option is what tells the visitor where the property
 * is.
 *
 * Names are sorted in the visitor's locale, so French accents order as a French
 * reader expects rather than by code point.
 */
export function buildGeographyTree(input: {
  locale: Locale;
  counts: GeographyCounts;
  regions: readonly GeographyRow[];
  divisions: readonly DivisionRow[];
  subdivisions: readonly SubdivisionRow[];
}): readonly GeographyOption[] {
  const { locale, counts, regions, divisions, subdivisions } = input;

  const byName = (a: { name: string }, b: { name: string }): number =>
    a.name.localeCompare(b.name, locale);

  const subdivisionsByDivision = new Map<
    string,
    GeographySubdivisionOption[]
  >();
  for (const subdivision of subdivisions) {
    const list = subdivisionsByDivision.get(subdivision.division_id) ?? [];
    list.push({
      id: subdivision.id,
      slug: subdivision.slug,
      name: localize(subdivision, locale),
      count: counts.subdivisions.get(subdivision.id) ?? 0,
    });
    subdivisionsByDivision.set(subdivision.division_id, list);
  }

  const divisionsByRegion = new Map<string, GeographyDivisionOption[]>();
  for (const division of divisions) {
    const list = divisionsByRegion.get(division.region_id) ?? [];
    list.push({
      id: division.id,
      slug: division.slug,
      name: localize(division, locale),
      count: counts.divisions.get(division.id) ?? 0,
      subdivisions: (subdivisionsByDivision.get(division.id) ?? []).sort(
        byName,
      ),
    });
    divisionsByRegion.set(division.region_id, list);
  }

  return regions.map((region) => ({
    id: region.id,
    slug: region.slug,
    name: localize(region, locale),
    count: counts.regions.get(region.id) ?? 0,
    divisions: (divisionsByRegion.get(region.id) ?? []).sort(byName),
  }));
}
