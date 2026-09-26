/**
 * Authoritative corporate facts. Every value here is supplied by the business
 * brief; nothing in this file may be invented. Anything not listed here belongs
 * in editable CMS content, not in code.
 */

export const SITE = {
  legalName: "KC Technology Corporation",
  shortName: "KC Technology",
  motto: "Innovating Technology. Powering Infrastructure. Transforming Futures.",
  email: "kctechc@gmail.com",
  phones: ["+237 679-202-265", "656-218-651"],
  address: {
    street: "Half-Mile",
    city: "Limbe",
    region: "Southwest Region",
    country: "Cameroon",
    countryCode: "CM",
  },
} as const;

export const BRAND_COLORS = {
  navy: "#0B2545",
  gold: "#B8892E",
  digitalMarketing: "#2E6FB8",
  electricalServices: "#D98E04",
  realEstate: "#1E7A5C",
  bodyText: "#3C4858",
} as const;

export type DepartmentSlug =
  | "digital-marketing"
  | "electrical-services"
  | "real-estate";

export type DepartmentDefinition = {
  slug: DepartmentSlug;
  /** Accent colour used for the department's visual identity. */
  accent: string;
  /** Static translation key prefix; labels resolve through Tolgee. */
  labelKey: string;
  descriptionKey: string;
};

/**
 * Departments share one corporate brand and are routed under the active locale,
 * e.g. `/en/digital-marketing`. Slugs stay stable across locales for SEO.
 */
export const DEPARTMENTS: readonly DepartmentDefinition[] = [
  {
    slug: "digital-marketing",
    accent: BRAND_COLORS.digitalMarketing,
    labelKey: "departments.digitalMarketing.label",
    descriptionKey: "departments.digitalMarketing.description",
  },
  {
    slug: "electrical-services",
    accent: BRAND_COLORS.electricalServices,
    labelKey: "departments.electricalServices.label",
    descriptionKey: "departments.electricalServices.description",
  },
  {
    slug: "real-estate",
    accent: BRAND_COLORS.realEstate,
    labelKey: "departments.realEstate.label",
    descriptionKey: "departments.realEstate.description",
  },
] as const;

export const DEPARTMENT_SLUGS: readonly DepartmentSlug[] = DEPARTMENTS.map(
  (department) => department.slug,
);

export function isDepartmentSlug(value: string): value is DepartmentSlug {
  return (DEPARTMENT_SLUGS as readonly string[]).includes(value);
}

export function getDepartment(
  slug: DepartmentSlug,
): DepartmentDefinition | undefined {
  return DEPARTMENTS.find((department) => department.slug === slug);
}

/** Primary store currency, per the business brief. */
export const STORE_CURRENCY = {
  code: "XAF",
  symbol: "FCFA",
  /** Intl locales used for money formatting. */
  locales: { en: "en-CM", fr: "fr-CM" },
} as const;
