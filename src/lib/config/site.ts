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

/**
 * The date the static page set last materially changed, as an ISO date.
 *
 * Used as the sitemap `lastmod` for routes that have no backing row to read a
 * timestamp from. It is a constant rather than `new Date()` on purpose: a
 * `lastmod` that changes on every request tells a crawler nothing and is ignored,
 * so the honest value is the last revision of the content those routes render.
 * Bump this when a change to any statically-listed page ships.
 */
export const SITE_REVISION_DATE = "2026-09-24";

/**
 * Brand colours, sampled from the supplied KC wordmark (black ink with a teal
 * accent). These mirror the CSS tokens in `globals.css`; the CSS is what
 * components actually consume, and this object exists so the values have a
 * single documented source for non-CSS consumers such as the web manifest.
 */
export const BRAND_COLORS = {
  ink: "#0D1216",
  teal: "#006E6A",
  tealBright: "#4ED9D4",
  digitalMarketing: "#1E6FD9",
  electricalServices: "#B45309",
  realEstate: "#127A5B",
  bodyText: "#414D57",
  mutedText: "#66717B",
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
  /** One-line value proposition shown on the gateway card. */
  summaryKey: string;
  /** Key into the icon map in `DepartmentIcon`. */
  icon: DepartmentSlug;
  /** Hero backdrop photo, served from `/public`. */
  heroImage: string;
};

/**
 * Departments share one corporate brand and are routed under the active locale,
 * e.g. `/en/digital-marketing`. Slugs stay stable across locales for SEO.
 *
 * Array order is the display order on the gateway and in the switcher, and the
 * three entries are deliberately equal weight — no department is promoted over
 * another on corporate surfaces.
 */
export const DEPARTMENTS: readonly DepartmentDefinition[] = [
  {
    slug: "digital-marketing",
    accent: BRAND_COLORS.digitalMarketing,
    labelKey: "departments.digitalMarketing.label",
    descriptionKey: "departments.digitalMarketing.description",
    summaryKey: "departments.digitalMarketing.summary",
    icon: "digital-marketing",
    heroImage: "/hero/digital-marketing-v2.jpg",
  },
  {
    slug: "electrical-services",
    accent: BRAND_COLORS.electricalServices,
    labelKey: "departments.electricalServices.label",
    descriptionKey: "departments.electricalServices.description",
    summaryKey: "departments.electricalServices.summary",
    icon: "electrical-services",
    heroImage: "/hero/electrical-services-v2.jpg",
  },
  {
    slug: "real-estate",
    accent: BRAND_COLORS.realEstate,
    labelKey: "departments.realEstate.label",
    descriptionKey: "departments.realEstate.description",
    summaryKey: "departments.realEstate.summary",
    icon: "real-estate",
    heroImage: "/hero/real-estate-v2.jpg",
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
