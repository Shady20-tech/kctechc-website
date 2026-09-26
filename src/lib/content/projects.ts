import type { Locale } from "@/lib/i18n/locales";
import type {
  LocalizedProject,
  LocalizedProjectMedia,
  ProjectMediaRecord,
  ProjectRecord,
} from "./types";
import { resolveLocalized } from "./types";

/** Trimmed non-empty text, or undefined. A blank overlay counts as absent. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Bundled Electrical Services project content.
 *
 * Deliberately EMPTY, and for the same reason `INSIGHTS` and `CASE_STUDIES` are
 * empty: the business brief supplies no completed project records and no project
 * photography. A project entry asserts that work was carried out at a named
 * place in a named year, and inventing one would be a fabricated claim about the
 * company's track record published on a production path. Stock imagery with an
 * invented caption is the specific failure this avoids.
 *
 * The gallery therefore renders an honest empty state. The record type, the
 * filter functions and the media model below are all built and typed, so an
 * editor who publishes a real project with real photography sees it appear with
 * no further code change — which is the behaviour the phase requires.
 */

const PROJECTS: readonly ProjectRecord[] = [];

export function allProjectRecords(): readonly ProjectRecord[] {
  return PROJECTS;
}

export function projectRecordsFor(
  department: string,
): readonly ProjectRecord[] {
  return PROJECTS.filter((project) => project.department === department);
}

export function findProjectRecord(
  department: string,
  slug: string,
): ProjectRecord | undefined {
  return PROJECTS.find(
    (project) => project.department === department && project.slug === slug,
  );
}

/**
 * Resolve a project into display-ready, locale-correct text.
 *
 * Media alt text and captions are localized separately from the project body,
 * because an image's description is content in its own right: a French page
 * needs French alt text even when the project title is a proper noun that does
 * not translate. A media item with no overlay keeps its canonical text.
 */
export function localizeProject(
  record: ProjectRecord,
  locale: "en" | "fr",
): LocalizedProject {
  const overlay = record.translations?.[locale];
  const { value, hasFallback } = resolveLocalized(
    {
      title: record.title,
      summary: record.summary,
      description: record.description,
      scope: record.scope,
      outcome: record.outcome,
    },
    overlay,
  );

  return {
    slug: record.slug,
    department: record.department,
    title: value.title,
    summary: value.summary,
    description: value.description,
    scope: value.scope,
    outcome: value.outcome,
    serviceSlugs: record.serviceSlugs,
    regionSlug: record.regionSlug,
    location: record.location,
    propertyType: record.propertyType,
    completedYear: record.completedYear,
    media: record.media.map((item) => localizeProjectMedia(item, locale)),
    tags: record.tags,
    hasFallback,
    seo: record.seo?.[locale] ?? {},
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Apply a locale's alt/caption overlay to one image.
 *
 * The canonical text is kept when a locale supplies none, which is the same
 * fallback rule the rest of the content layer follows: an untranslated string
 * shows through rather than leaving an image with no description. A
 * whitespace-only override counts as absent so an empty translation cannot blank
 * an alt attribute.
 */
function localizeProjectMedia(
  item: ProjectMediaRecord,
  locale: Locale,
): LocalizedProjectMedia {
  const overlay = item.translations?.[locale];
  const alt = nonEmpty(overlay?.alt) ?? item.alt;
  const caption = nonEmpty(overlay?.caption) ?? item.caption;
  return {
    ...item,
    alt,
    caption,
    localized: overlay
      ? { alt: overlay.alt, caption: overlay.caption }
      : undefined,
  };
}

export type ProjectFilters = {
  /** Service slug, or empty for all services. */
  service?: string;
  /** Region slug, or empty for all regions. */
  region?: string;
  propertyType?: string;
};

/**
 * Filter a localized project list.
 *
 * Pure over an already-localized list, mirroring `src/lib/store/search.ts`, so
 * the gallery page and any future filtered view cannot implement subtly
 * different matching.
 *
 * An unrecognised filter value matches nothing rather than being ignored: the
 * values arrive from URL query parameters a visitor can edit, and silently
 * dropping a bad `?service=` would show the full gallery under a URL that claims
 * to be filtered, which is a confusing and non-canonical state.
 */
export function filterProjects(
  projects: readonly LocalizedProject[],
  filters: ProjectFilters,
): LocalizedProject[] {
  const service = filters.service?.trim() ?? "";
  const region = filters.region?.trim() ?? "";
  const propertyType = filters.propertyType?.trim() ?? "";

  return projects.filter((project) => {
    if (service && !project.serviceSlugs.includes(service)) return false;
    // A project with no recorded region is excluded by a region filter rather
    // than included by default: the filter is a claim that the results are in
    // that region, and an unknown region cannot support it.
    if (region && project.regionSlug !== region) return false;
    if (propertyType && project.propertyType !== propertyType) return false;
    return true;
  });
}

/**
 * Serialize a filter state as a project query string.
 *
 * Built from scratch so a key absent from the filters object is absent from the
 * URL. That keeps one filter state to one URL — `/projects` and
 * `/projects?service=` are not two addresses for the same page, which is the
 * duplicate-content concern that also governs locale routing.
 */
export function buildProjectQuery(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  if (filters.service && filters.service.length > 0) {
    params.set("service", filters.service);
  }
  if (filters.region && filters.region.length > 0) {
    params.set("region", filters.region);
  }
  if (filters.propertyType && filters.propertyType.length > 0) {
    params.set("propertyType", filters.propertyType);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * True when a filter combination is the unfiltered view.
 *
 * The gallery's canonical URL is the unfiltered path. A filtered view is a
 * navigational state, not a separate page, so it is marked `noindex` and points
 * its canonical at the unfiltered gallery — otherwise every filter permutation
 * would compete with the gallery itself in the index.
 */
export function isUnfiltered(filters: ProjectFilters): boolean {
  return (
    !filters.service?.trim() &&
    !filters.region?.trim() &&
    !filters.propertyType?.trim()
  );
}

/**
 * The service slugs that actually have projects, in catalogue order.
 *
 * Derived from the data rather than from the full service list, so the filter
 * offers only options that can return something. A filter control that produces
 * an empty result is worse than no control: it reads as a broken page.
 */
export function projectServiceFilterValues(
  projects: readonly LocalizedProject[],
  serviceOrder: readonly string[],
): string[] {
  const present = new Set<string>();
  for (const project of projects) {
    for (const slug of project.serviceSlugs) present.add(slug);
  }
  return serviceOrder.filter((slug) => present.has(slug));
}

/** The region slugs that actually have projects, in the supplied order. */
export function projectRegionFilterValues(
  projects: readonly LocalizedProject[],
  regionOrder: readonly string[],
): string[] {
  const present = new Set<string>();
  for (const project of projects) {
    if (project.regionSlug) present.add(project.regionSlug);
  }
  return regionOrder.filter((slug) => present.has(slug));
}

/** The property types that actually have projects, in the supplied order. */
export function projectPropertyTypeFilterValues(
  projects: readonly LocalizedProject[],
  order: readonly string[],
): string[] {
  const present = new Set<string>();
  for (const project of projects) {
    if (project.propertyType) present.add(project.propertyType);
  }
  return order.filter((value) => present.has(value));
}

/** Split a project's media into its before/after pair and its general views. */
export function splitProjectMedia(project: LocalizedProject): {
  before: LocalizedProject["media"][number] | undefined;
  after: LocalizedProject["media"][number] | undefined;
  general: LocalizedProject["media"];
} {
  return {
    before: project.media.find((item) => item.role === "before"),
    after: project.media.find((item) => item.role === "after"),
    general: project.media.filter((item) => item.role === "general"),
  };
}
