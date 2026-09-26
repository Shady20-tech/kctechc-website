import type { DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Content contracts for Phase 3 dynamic content (services, portfolio, insights).
 *
 * Canonical text is the source locale (English). A localized overlay carries the
 * translated fields for one locale, and `resolveLocalized` merges the two with a
 * per-field fallback to canonical. Modelling the overlay as a partial map rather
 * than a full record means a translation that only covers some fields still
 * contributes those fields instead of being discarded wholesale.
 *
 * Both sources of content produce this shape:
 *   - Supabase, where the overlay comes from `content_translations`
 *   - the bundled defaults, where the overlay is authored inline
 * so every page renders through one code path regardless of where content lives.
 */

/** A localized overlay for one locale. Every field is optional: partial translations are valid. */
export type LocalizedOverlay = Partial<{
  title: string;
  summary: string;
  description: string;
  body: string;
  deliveryNotes: string;
  features: readonly string[];
  faqs: readonly FaqItem[];
  /** Electrical project fields. Absent for other entity types. */
  scope: string;
  outcome: string;
}>;

export type FaqItem = {
  question: string;
  answer: string;
};

export type ServiceRecord = {
  slug: string;
  department: DepartmentSlug;
  /** Canonical (source-locale) fields. */
  title: string;
  summary: string;
  description: string;
  features: readonly string[];
  faqs: readonly FaqItem[];
  deliveryNotes?: string;
  /** Per-locale overrides keyed by locale. */
  translations?: Partial<Record<Locale, LocalizedOverlay>>;
  /** Per-locale SEO overrides. */
  seo?: Partial<Record<Locale, SeoOverlay>>;
  publishedAt?: string;
  updatedAt?: string;
};

export type SeoOverlay = {
  title?: string;
  description?: string;
  canonicalOverride?: string;
  ogImagePath?: string;
  noindex?: boolean;
};

/** A service resolved for one locale: every display field is populated. */
export type LocalizedService = {
  slug: string;
  department: DepartmentSlug;
  title: string;
  summary: string;
  description: string;
  features: readonly string[];
  faqs: readonly FaqItem[];
  deliveryNotes?: string;
  /** True when at least one field fell back to canonical for this locale. */
  hasFallback: boolean;
  seo: SeoOverlay;
  publishedAt?: string;
  updatedAt?: string;
};

export type CategoryRecord = {
  slug: string;
  name: string;
  description?: string;
  translations?: Partial<
    Record<Locale, { name?: string; description?: string }>
  >;
};

export type LocalizedCategory = {
  slug: string;
  name: string;
  description?: string;
};

export type AuthorRecord = {
  slug: string;
  /** A person's name is a proper noun and is never localized. */
  displayName: string;
  roleTitle?: string;
  bio?: string;
};

/**
 * Author identity is deliberately not localizable. Translating a person's name
 * would misrepresent them; only the surrounding role and bio could legitimately
 * be localized, and those stay canonical until an 'author' entity type exists.
 */
export type Author = AuthorRecord;

export type InsightRecord = {
  slug: string;
  /** Absent when the article is corporate-wide rather than department-specific. */
  department?: DepartmentSlug;
  categorySlug?: string;
  authorSlug?: string;
  title: string;
  summary: string;
  body: string;
  coverImagePath?: string;
  relatedServiceSlugs: readonly string[];
  isFeatured?: boolean;
  translations?: Partial<Record<Locale, LocalizedOverlay>>;
  seo?: Partial<Record<Locale, SeoOverlay>>;
  publishedAt: string;
  updatedAt?: string;
};

export type LocalizedInsight = {
  slug: string;
  department?: DepartmentSlug;
  categorySlug?: string;
  authorSlug?: string;
  title: string;
  summary: string;
  body: string;
  coverImagePath?: string;
  relatedServiceSlugs: readonly string[];
  isFeatured: boolean;
  publishedAt: string;
  updatedAt?: string;
  seo: SeoOverlay;
};

export type CaseStudyRecord = {
  slug: string;
  department: DepartmentSlug;
  serviceSlug?: string;
  title: string;
  summary: string;
  challenge?: string;
  approach?: string;
  outcome?: string;
  /** Empty unless the client approved publication and supplied real figures. */
  results: readonly CaseStudyResult[];
  tags: readonly string[];
  clientName?: string;
  publishedAt: string;
  translations?: Partial<Record<Locale, LocalizedOverlay>>;
};

export type CaseStudyResult = {
  label: string;
  value: string;
  /** How the figure was measured. A metric with no basis is not rendered. */
  basis: string;
};

export type LocalizedCaseStudy = {
  slug: string;
  department: DepartmentSlug;
  serviceSlug?: string;
  title: string;
  summary: string;
  challenge?: string;
  approach?: string;
  outcome?: string;
  results: readonly CaseStudyResult[];
  tags: readonly string[];
  clientName?: string;
  publishedAt: string;
};

/**
 * Electrical project media.
 *
 * `alt` is required rather than optional: an image without alternative text is
 * inaccessible, and making it optional is how it ends up empty. `caption` and
 * `credit` are separate because they are different claims — a caption describes
 * the image, a credit attributes it — and conflating them means one of the two is
 * always wrong.
 *
 * `before`/`after` marks the image's role in a pair. A project may have neither
 * (a single view) or a matched pair, which is what the detail page renders as a
 * comparison. Modelling it as an explicit role rather than by array position
 * means a pair cannot be silently broken by reordering.
 */
export type ProjectMediaRole = "before" | "after" | "general";

export type ProjectMediaRecord = {
  /** Storage-relative object path, matching the `project_media` constraint. */
  storagePath: string;
  alt: string;
  caption?: string;
  credit?: string;
  role: ProjectMediaRole;
  width?: number;
  height?: number;
  /**
   * Per-locale alt/caption overrides for this image, keyed by locale.
   *
   * Media text is translated through the same `content_translations` index as
   * the project body, with `entity_type = 'project_media'` and the media row's
   * own id as the entity. It is held on the media item rather than on the
   * project because two images on one project are translated independently.
   */
  translations?: Partial<Record<Locale, ProjectMediaOverlay>>;
};

/** The translatable text of one project image. */
export type ProjectMediaOverlay = {
  alt?: string;
  caption?: string;
};

export type LocalizedProjectMedia = ProjectMediaRecord & {
  /** Per-locale alt/caption overrides, keyed by locale. */
  localized?: {
    alt?: string;
    caption?: string;
  };
};

/**
 * An electrical project.
 *
 * `serviceSlugs` is a list rather than a single slug because a project routinely
 * spans several service areas (an installation that included solar, say), and the
 * gallery filter has to find it under each. It is also what the project detail
 * page links back to.
 *
 * `regionSlug` is optional: a project's region is only recorded when it is known,
 * and the region filter must not invent one to fill the gap.
 */
export type ProjectRecord = {
  slug: string;
  department: DepartmentSlug;
  title: string;
  summary: string;
  /** Longer narrative, rendered as rich text. */
  description?: string;
  scope?: string;
  outcome?: string;
  serviceSlugs: readonly string[];
  regionSlug?: string;
  /** Human-readable location, e.g. a town. Never a precise coordinate. */
  location?: string;
  propertyType?: PropertyType;
  /** Year completed. A number, not a date: the brief supplies no exact dates. */
  completedYear?: number;
  media: readonly ProjectMediaRecord[];
  tags: readonly string[];
  translations?: Partial<Record<Locale, LocalizedOverlay>>;
  seo?: Partial<Record<Locale, SeoOverlay>>;
  publishedAt?: string;
  updatedAt?: string;
};

export type LocalizedProject = {
  slug: string;
  department: DepartmentSlug;
  title: string;
  summary: string;
  description?: string;
  scope?: string;
  outcome?: string;
  serviceSlugs: readonly string[];
  regionSlug?: string;
  location?: string;
  propertyType?: PropertyType;
  completedYear?: number;
  media: readonly LocalizedProjectMedia[];
  tags: readonly string[];
  hasFallback: boolean;
  seo: SeoOverlay;
  publishedAt?: string;
  updatedAt?: string;
};

/**
 * Property type for a quote request and for a project.
 *
 * Shared between the two because a quote is scoped differently for a house, a
 * shop and a plant, and the project gallery filters on the same distinction.
 */
export type PropertyType = "residential" | "commercial" | "industrial";

export const PROPERTY_TYPES: readonly PropertyType[] = [
  "residential",
  "commercial",
  "industrial",
];

export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

/** A region, for the project filter and the quote form's location field. */
export type RegionRecord = {
  slug: string;
  name: string;
  nameFr?: string;
};

export function localizeRegion(
  record: RegionRecord,
  locale: Locale,
): { slug: string; name: string } {
  const localized = locale === "fr" ? record.nameFr?.trim() : undefined;
  return {
    slug: record.slug,
    name: localized && localized.length > 0 ? localized : record.name,
  };
}

/**
 * Merge a localized overlay onto canonical fields, per field.
 *
 * A blank or whitespace-only translation is treated as absent rather than
 * accepted: an empty string in the database would otherwise render a blank
 * heading instead of the canonical text.
 *
 * `hasFallback` counts only fields that *have* canonical content but no usable
 * translation. An optional field that is simply absent everywhere (a service with
 * no delivery notes, say) is not a fallback and must not be reported as one.
 */
export function resolveLocalized<T extends Record<string, unknown>>(
  canonical: T,
  overlay: LocalizedOverlay | undefined,
): { value: T; hasFallback: boolean } {
  const hasContent = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };

  let hasFallback = false;
  const merged: Record<string, unknown> = { ...canonical };

  const assign = (key: keyof LocalizedOverlay) => {
    const candidate = overlay?.[key];
    if (hasContent(candidate)) {
      merged[key as string] = candidate;
      return;
    }
    if (hasContent(canonical[key])) hasFallback = true;
  };

  for (const key of [
    "title",
    "summary",
    "description",
    "body",
    "deliveryNotes",
    "features",
    "faqs",
    "scope",
    "outcome",
  ] as const) {
    assign(key);
  }

  return { value: merged as T, hasFallback };
}
