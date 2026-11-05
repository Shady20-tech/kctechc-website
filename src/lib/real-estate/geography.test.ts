import { describe, expect, it } from "vitest";

import {
  buildGeographyTree,
  emptyGeographyCounts,
  type DivisionRow,
  type GeographyRow,
  type SubdivisionRow,
} from "./geography";

const region = (
  id: string,
  slug: string,
  name: string,
  name_fr: string | null = null,
): GeographyRow => ({ id, slug, name, name_fr });

const division = (
  id: string,
  region_id: string,
  slug: string,
  name: string,
  name_fr: string | null = null,
): DivisionRow => ({ id, region_id, slug, name, name_fr });

const subdivision = (
  id: string,
  division_id: string,
  slug: string,
  name: string,
  name_fr: string | null = null,
): SubdivisionRow => ({ id, division_id, slug, name, name_fr });

describe("buildGeographyTree", () => {
  it("nests subdivisions under divisions under regions", () => {
    const tree = buildGeographyTree({
      locale: "en",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "littoral", "Littoral")],
      divisions: [division("d1", "r1", "wouri", "Wouri")],
      subdivisions: [subdivision("s1", "d1", "douala-1", "Douala 1")],
    });

    expect(tree).toHaveLength(1);
    expect(tree[0]?.slug).toBe("littoral");
    expect(tree[0]?.divisions).toHaveLength(1);
    expect(tree[0]?.divisions[0]?.slug).toBe("wouri");
    expect(tree[0]?.divisions[0]?.subdivisions).toHaveLength(1);
    expect(tree[0]?.divisions[0]?.subdivisions[0]?.slug).toBe("douala-1");
  });

  it("keeps a level with no listings, at a count of zero", () => {
    // The whole point of the change: an empty branch stays selectable so the
    // hierarchy can be traversed, rather than disappearing until property exists.
    const tree = buildGeographyTree({
      locale: "en",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "centre", "Centre")],
      divisions: [division("d1", "r1", "mfoundi", "Mfoundi")],
      subdivisions: [subdivision("s1", "d1", "yaounde-1", "Yaounde 1")],
    });

    expect(tree[0]?.count).toBe(0);
    expect(tree[0]?.divisions[0]?.count).toBe(0);
    expect(tree[0]?.divisions[0]?.subdivisions[0]?.count).toBe(0);
  });

  it("applies the counts it is given, by row id", () => {
    const counts = emptyGeographyCounts();
    counts.regions.set("r1", 4);
    counts.divisions.set("d1", 3);
    counts.subdivisions.set("s1", 2);

    const tree = buildGeographyTree({
      locale: "en",
      counts,
      regions: [region("r1", "centre", "Centre")],
      divisions: [division("d1", "r1", "mfoundi", "Mfoundi")],
      subdivisions: [subdivision("s1", "d1", "yaounde-1", "Yaounde 1")],
    });

    expect(tree[0]?.count).toBe(4);
    expect(tree[0]?.divisions[0]?.count).toBe(3);
    expect(tree[0]?.divisions[0]?.subdivisions[0]?.count).toBe(2);
  });

  it("uses the French name when the locale is fr", () => {
    const tree = buildGeographyTree({
      locale: "fr",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "east", "East", "Est")],
      divisions: [
        division("d1", "r1", "haut-nyong", "Haut-Nyong", "Haut-Nyong"),
      ],
      subdivisions: [
        subdivision("s1", "d1", "abong-mbang", "Abong-Mbang", "Abong-Mbang"),
      ],
    });

    expect(tree[0]?.name).toBe("Est");
    expect(tree[0]?.divisions[0]?.name).toBe("Haut-Nyong");
    expect(tree[0]?.divisions[0]?.subdivisions[0]?.name).toBe("Abong-Mbang");
  });

  it("falls back to the English name when a French one is missing", () => {
    const tree = buildGeographyTree({
      locale: "fr",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "east", "East", null)],
      divisions: [],
      subdivisions: [],
    });

    expect(tree[0]?.name).toBe("East");
  });

  it("sorts divisions and subdivisions by name, preserving region order", () => {
    const tree = buildGeographyTree({
      locale: "en",
      counts: emptyGeographyCounts(),
      regions: [region("r2", "west", "West"), region("r1", "centre", "Centre")],
      divisions: [
        division("d2", "r1", "mbam-et-kim", "Mbam-et-Kim"),
        division("d1", "r1", "haute-sanaga", "Haute-Sanaga"),
      ],
      subdivisions: [
        subdivision("s2", "d1", "b", "B"),
        subdivision("s1", "d1", "a", "A"),
      ],
    });

    // Regions keep the order they are given: the loader orders them by the
    // curated `sort_order` column, so the filter lists the country in the
    // intended sequence rather than alphabetically.
    expect(tree.map((r) => r.name)).toEqual(["West", "Centre"]);
    expect(tree[1]?.divisions.map((d) => d.name)).toEqual([
      "Haute-Sanaga",
      "Mbam-et-Kim",
    ]);
    expect(tree[1]?.divisions[0]?.subdivisions.map((s) => s.name)).toEqual([
      "A",
      "B",
    ]);
  });

  it("leaves a region with no divisions as an empty list, not undefined", () => {
    const tree = buildGeographyTree({
      locale: "en",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "north", "North")],
      divisions: [],
      subdivisions: [],
    });

    expect(tree[0]?.divisions).toEqual([]);
  });

  it("does not attach a division to the wrong region", () => {
    const tree = buildGeographyTree({
      locale: "en",
      counts: emptyGeographyCounts(),
      regions: [region("r1", "centre", "Centre"), region("r2", "west", "West")],
      divisions: [division("d1", "r2", "bamboutos", "Bamboutos")],
      subdivisions: [],
    });

    expect(tree[0]?.divisions).toEqual([]);
    expect(tree[1]?.divisions.map((d) => d.slug)).toEqual(["bamboutos"]);
  });
});
