import { describe, expect, it } from "vitest";
import {
  filterProjects,
  isUnfiltered,
  buildProjectQuery,
  localizeProject,
  projectPropertyTypeFilterValues,
  projectRegionFilterValues,
  projectServiceFilterValues,
  splitProjectMedia,
} from "@/lib/content/projects";
import type { LocalizedProject, ProjectRecord } from "@/lib/content/types";

/**
 * Project records are bundled as empty, so the record fixtures below stand in for
 * rows the loader would return from the database. These exercise the pure
 * functions the gallery and the project page call, including the media
 * localization that turns a stored overlay into the alt text a French page
 * renders.
 */

function record(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    slug: "solar-installation-buea",
    department: "electrical-services",
    title: "Solar installation in Buea",
    summary: "A rooftop array for a family home.",
    description: "Full narrative.",
    scope: "Array, inverter and battery.",
    outcome: "Reliable power through the rainy season.",
    serviceSlugs: ["solar-energy-systems"],
    regionSlug: "southwest",
    location: "Buea",
    propertyType: "residential",
    completedYear: 2025,
    media: [],
    tags: ["solar"],
    ...overrides,
  };
}

function localized(
  overrides: Partial<LocalizedProject> = {},
): LocalizedProject {
  return {
    slug: "p",
    department: "electrical-services",
    title: "P",
    summary: "s",
    serviceSlugs: [],
    media: [],
    tags: [],
    hasFallback: false,
    seo: {},
    ...overrides,
  };
}

describe("localizeProject media text", () => {
  it("uses the French overlay for alt text when one exists", () => {
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Rooftop solar array",
            caption: "Installed in June",
            role: "general",
            translations: {
              fr: {
                alt: "Panneau solaire sur le toit",
                caption: "Installé en juin",
              },
            },
          },
        ],
      }),
      "fr",
    );

    expect(project.media[0]!.alt).toBe("Panneau solaire sur le toit");
    expect(project.media[0]!.caption).toBe("Installé en juin");
  });

  it("keeps the canonical alt text when no overlay exists", () => {
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Rooftop solar array",
            role: "general",
          },
        ],
      }),
      "fr",
    );

    // An image with no translation keeps its English description rather than
    // rendering with no alt text at all.
    expect(project.media[0]!.alt).toBe("Rooftop solar array");
  });

  it("treats a whitespace-only overlay as absent", () => {
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Rooftop solar array",
            role: "general",
            translations: { fr: { alt: "   " } },
          },
        ],
      }),
      "fr",
    );

    expect(project.media[0]!.alt).toBe("Rooftop solar array");
  });

  it("leaves the English page on the canonical text", () => {
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Rooftop solar array",
            role: "general",
            translations: { fr: { alt: "Panneau solaire" } },
          },
        ],
      }),
      "en",
    );

    expect(project.media[0]!.alt).toBe("Rooftop solar array");
  });

  it("translates each image independently", () => {
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Before",
            role: "before",
            translations: { fr: { alt: "Avant" } },
          },
          { storagePath: "abc/2.jpg", alt: "After", role: "after" },
        ],
      }),
      "fr",
    );

    expect(project.media[0]!.alt).toBe("Avant");
    expect(project.media[1]!.alt).toBe("After");
  });

  it("applies the French body overlay alongside the media one", () => {
    const project = localizeProject(
      record({
        translations: {
          fr: {
            title: "Installation solaire à Buea",
            summary: "Une installation.",
            description: "Récit complet.",
            scope: "Panneau, onduleur et batterie.",
            outcome: "Énergie fiable pendant la saison des pluies.",
          },
        },
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Array",
            role: "general",
            translations: { fr: { alt: "Panneau" } },
          },
        ],
      }),
      "fr",
    );

    expect(project.title).toBe("Installation solaire à Buea");
    expect(project.media[0]!.alt).toBe("Panneau");
    // Every translatable field is covered, so nothing falls back.
    expect(project.hasFallback).toBe(false);
  });

  it("reports a fallback when only some body fields are translated", () => {
    // The media alt is translated but the body is not, and the two are
    // independent: an image overlay must not make an untranslated body read as
    // fully localized.
    const project = localizeProject(
      record({
        media: [
          {
            storagePath: "abc/1.jpg",
            alt: "Array",
            role: "general",
            translations: { fr: { alt: "Panneau" } },
          },
        ],
      }),
      "fr",
    );

    expect(project.media[0]!.alt).toBe("Panneau");
    expect(project.hasFallback).toBe(true);
  });
});

describe("filterProjects", () => {
  const projects: LocalizedProject[] = [
    localized({
      slug: "a",
      serviceSlugs: ["solar-energy-systems"],
      regionSlug: "southwest",
      propertyType: "residential",
    }),
    localized({
      slug: "b",
      serviceSlugs: ["cctv-security"],
      regionSlug: "littoral",
      propertyType: "commercial",
    }),
    localized({
      slug: "c",
      serviceSlugs: ["solar-energy-systems"],
      regionSlug: undefined,
      propertyType: "industrial",
    }),
  ];

  it("returns everything for an empty filter", () => {
    expect(filterProjects(projects, {}).map((p) => p.slug)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("matches a service slug", () => {
    expect(
      filterProjects(projects, { service: "solar-energy-systems" }).map(
        (p) => p.slug,
      ),
    ).toEqual(["a", "c"]);
  });

  it("excludes a project with no region when a region is filtered", () => {
    // Project "c" has no region, so it cannot be claimed as being in the
    // Southwest even though it is not in any other region either.
    expect(
      filterProjects(projects, { region: "southwest" }).map((p) => p.slug),
    ).toEqual(["a"]);
  });

  it("matches a property type", () => {
    expect(
      filterProjects(projects, { propertyType: "commercial" }).map(
        (p) => p.slug,
      ),
    ).toEqual(["b"]);
  });

  it("matches nothing for an unrecognised filter value", () => {
    // A hand-edited `?service=nonsense` must not silently show the full gallery.
    expect(filterProjects(projects, { service: "nonsense" })).toEqual([]);
    expect(filterProjects(projects, { region: "nonsense" })).toEqual([]);
  });

  it("combines filters as an intersection", () => {
    expect(
      filterProjects(projects, {
        service: "solar-energy-systems",
        propertyType: "industrial",
      }).map((p) => p.slug),
    ).toEqual(["c"]);
  });
});

describe("buildProjectQuery and isUnfiltered", () => {
  it("omits empty filters from the query string", () => {
    expect(
      buildProjectQuery({ service: "", region: "", propertyType: "" }),
    ).toBe("");
    expect(buildProjectQuery({})).toBe("");
  });

  it("serializes only the set filters", () => {
    expect(buildProjectQuery({ service: "seo" })).toBe("?service=seo");
    expect(buildProjectQuery({ service: "seo", region: "littoral" })).toBe(
      "?service=seo&region=littoral",
    );
  });

  it("treats only an all-empty filter as unfiltered", () => {
    expect(isUnfiltered({})).toBe(true);
    expect(isUnfiltered({ service: "  " })).toBe(true);
    expect(isUnfiltered({ service: "seo" })).toBe(false);
  });
});

describe("filter value derivation", () => {
  const projects: LocalizedProject[] = [
    localized({
      serviceSlugs: ["solar-energy-systems"],
      regionSlug: "southwest",
      propertyType: "residential",
    }),
    localized({
      serviceSlugs: ["cctv-security", "solar-energy-systems"],
      regionSlug: "littoral",
      propertyType: "commercial",
    }),
  ];

  it("offers only services that have a project, in catalogue order", () => {
    const order = [
      "solar-energy-systems",
      "cctv-security",
      "safety-inspections",
    ];
    expect(projectServiceFilterValues(projects, order)).toEqual([
      "solar-energy-systems",
      "cctv-security",
    ]);
  });

  it("offers only regions that have a project", () => {
    expect(
      projectRegionFilterValues(projects, [
        "southwest",
        "littoral",
        "northwest",
      ]),
    ).toEqual(["southwest", "littoral"]);
  });

  it("offers only property types that have a project", () => {
    expect(
      projectPropertyTypeFilterValues(projects, [
        "residential",
        "commercial",
        "industrial",
      ]),
    ).toEqual(["residential", "commercial"]);
  });
});

describe("splitProjectMedia", () => {
  it("separates the before/after pair from the general views", () => {
    const project = localized({
      media: [
        { storagePath: "1.jpg", alt: "before", role: "before" },
        { storagePath: "2.jpg", alt: "after", role: "after" },
        { storagePath: "3.jpg", alt: "other", role: "general" },
      ],
    });

    const { before, after, general } = splitProjectMedia(project);
    expect(before?.storagePath).toBe("1.jpg");
    expect(after?.storagePath).toBe("2.jpg");
    expect(general.map((m) => m.storagePath)).toEqual(["3.jpg"]);
  });

  it("returns undefined for a missing half of the pair", () => {
    const { before, after } = splitProjectMedia(
      localized({
        media: [{ storagePath: "1.jpg", alt: "before", role: "before" }],
      }),
    );
    expect(before?.storagePath).toBe("1.jpg");
    expect(after).toBeUndefined();
  });
});
