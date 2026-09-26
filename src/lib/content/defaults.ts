import type { DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { DEFAULT_SERVICES } from "./services";
import { SERVICE_TRANSLATIONS_FR } from "./services.fr";
import type {
  AuthorRecord,
  CaseStudyRecord,
  CategoryRecord,
  InsightRecord,
  LocalizedCaseStudy,
  LocalizedCategory,
  LocalizedInsight,
  LocalizedService,
  ServiceRecord,
} from "./types";
import { resolveLocalized } from "./types";

/**
 * Bundled content defaults.
 *
 * These exist so the site renders correctly in an environment with no Supabase
 * credentials, which is the established convention in `site-content.ts`: the
 * database overrides these values when it is reachable, and its absence is never
 * allowed to blank a page. Nothing here is invented business fact — see
 * `services.ts` for the content rules that govern these strings.
 *
 * Insights and case studies are deliberately EMPTY. The business brief supplies
 * no articles and no client work, so seeding examples would put fabricated
 * content on a production path. Their surfaces render honest empty states until
 * an editor publishes real content, which is the behaviour the phase requires.
 */

/** Attach the French overlays to the canonical service records. */
function withTranslations(record: ServiceRecord): ServiceRecord {
  const fr = SERVICE_TRANSLATIONS_FR[record.slug];
  return fr ? { ...record, translations: { fr } } : record;
}

const SERVICES: readonly ServiceRecord[] = DEFAULT_SERVICES.map(withTranslations);

/** Insight categories from the brief's three subject areas. Names only. */
const CATEGORIES: readonly CategoryRecord[] = [
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    translations: { fr: { name: "Marketing digital" } },
  },
  {
    slug: "electrical-services",
    name: "Electrical Services",
    translations: { fr: { name: "Services électriques" } },
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    translations: { fr: { name: "Immobilier" } },
  },
];

const AUTHORS: readonly AuthorRecord[] = [];
const INSIGHTS: readonly InsightRecord[] = [];
const CASE_STUDIES: readonly CaseStudyRecord[] = [];

/**
 * Which departments have published service content.
 *
 * The service routes are nested under the department segment so the Digital
 * Marketing URLs are exactly `/[locale]/digital-marketing/services`. That route
 * shape is shared, so this gate is what keeps `/en/electrical-services/services`
 * from rendering an empty catalogue: a department with no published services is
 * treated as not having the surface yet, and returns 404 until its phase supplies
 * the content. The URL scheme does not need to change when it does.
 */
const DEPARTMENTS_WITH_SERVICES: readonly DepartmentSlug[] = ["digital-marketing"];

export function departmentHasServices(department: DepartmentSlug): boolean {
  return DEPARTMENTS_WITH_SERVICES.includes(department);
}

/** All bundled services, canonical form. */
export function allServiceRecords(): readonly ServiceRecord[] {
  return SERVICES;
}

/** Bundled services for one department. */
export function serviceRecordsFor(
  department: DepartmentSlug,
): readonly ServiceRecord[] {
  return SERVICES.filter((service) => service.department === department);
}

export function findServiceRecord(
  department: DepartmentSlug,
  slug: string,
): ServiceRecord | undefined {
  return SERVICES.find(
    (service) => service.department === department && service.slug === slug,
  );
}

/** Resolve one service into display-ready, locale-correct text. */
export function localizeService(
  record: ServiceRecord,
  locale: Locale,
): LocalizedService {
  const overlay = record.translations?.[locale];
  const { value, hasFallback } = resolveLocalized(
    {
      title: record.title,
      summary: record.summary,
      description: record.description,
      features: record.features,
      faqs: record.faqs,
      deliveryNotes: record.deliveryNotes,
    },
    overlay,
  );

  return {
    slug: record.slug,
    department: record.department,
    title: value.title,
    summary: value.summary,
    description: value.description,
    features: value.features ?? [],
    faqs: value.faqs ?? [],
    deliveryNotes: value.deliveryNotes,
    hasFallback,
    seo: record.seo?.[locale] ?? {},
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
  };
}

export function localizeServices(
  records: readonly ServiceRecord[],
  locale: Locale,
): LocalizedService[] {
  return records.map((record) => localizeService(record, locale));
}

export function allCategories(): readonly CategoryRecord[] {
  return CATEGORIES;
}

export function localizeCategory(
  record: CategoryRecord,
  locale: Locale,
): LocalizedCategory {
  const overlay = record.translations?.[locale];
  const name = overlay?.name?.trim();
  const description = overlay?.description?.trim();
  return {
    slug: record.slug,
    name: name && name.length > 0 ? name : record.name,
    description:
      description && description.length > 0 ? description : record.description,
  };
}

export function allAuthors(): readonly AuthorRecord[] {
  return AUTHORS;
}

export function findAuthor(slug: string): AuthorRecord | undefined {
  return AUTHORS.find((author) => author.slug === slug);
}

export function allInsightRecords(): readonly InsightRecord[] {
  return INSIGHTS;
}

export function localizeInsight(
  record: InsightRecord,
  locale: Locale,
): LocalizedInsight {
  const overlay = record.translations?.[locale];
  const { value } = resolveLocalized(
    {
      title: record.title,
      summary: record.summary,
      body: record.body,
    },
    overlay,
  );

  return {
    slug: record.slug,
    department: record.department,
    categorySlug: record.categorySlug,
    authorSlug: record.authorSlug,
    title: value.title,
    summary: value.summary,
    body: value.body,
    coverImagePath: record.coverImagePath,
    relatedServiceSlugs: record.relatedServiceSlugs,
    isFeatured: record.isFeatured ?? false,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
    seo: record.seo?.[locale] ?? {},
  };
}

export function allCaseStudyRecords(): readonly CaseStudyRecord[] {
  return CASE_STUDIES;
}

export function localizeCaseStudy(
  record: CaseStudyRecord,
  locale: Locale,
): LocalizedCaseStudy {
  const overlay = record.translations?.[locale];
  const { value } = resolveLocalized(
    {
      title: record.title,
      summary: record.summary,
      challenge: record.challenge,
      approach: record.approach,
      outcome: record.outcome,
    },
    overlay,
  );

  return {
    slug: record.slug,
    department: record.department,
    serviceSlug: record.serviceSlug,
    title: value.title,
    summary: value.summary,
    challenge: value.challenge,
    approach: value.approach,
    outcome: value.outcome,
    results: record.results,
    tags: record.tags,
    clientName: record.clientName,
    publishedAt: record.publishedAt,
  };
}
