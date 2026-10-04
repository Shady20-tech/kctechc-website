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
  digitalMarketing: "#0066CC",
  electricalServices: "#C2410C",
  realEstate: "#1E5631",
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

/**
 * Department micro-theme tokens.
 *
 * Each department repaints the whole shared surface palette, not just the accent:
 * canvas (`surface*`), body/muted copy, headings (`ink-*`), borders and the
 * accent. `globals.css` maps `html[data-theme="<slug>"]` onto these values, so a
 * page only has to set one attribute for the header, cards, forms, links and
 * buttons to adopt the department's theme together.
 *
 * Every value is chosen for an older, low-vision audience and is asserted by
 * `theme-contrast.test.ts`: body copy clears 4.5:1 on the department canvas, the
 * accent clears 4.5:1 both as text on the canvas and as a fill behind white text,
 * and the dark ink bands stay dark so white nav and footer type keeps its
 * contrast. The `ink*` steps are ramps (50 is the lightest, 950 the darkest),
 * which is what lets a single `text-ink-900` render correctly on light and dark
 * surfaces in every theme.
 *
 * `accent` mirrors `BRAND_COLORS.<department>` and must stay in step with it and
 * with the `--color-dept-*` values in `globals.css`.
 */
export type DepartmentThemeTokens = {
  /** Page canvas. */
  surface: string;
  /** Alternate band, e.g. a `SectionBand tone="alt"`. */
  surfaceAlt: string;
  surfaceSunken: string;
  /** Body copy on `surface`; must clear 4.5:1. */
  body: string;
  /** Secondary copy; must clear 4.5:1 on `surface` and `surfaceAlt`. */
  muted: string;
  /** Lightest ink step — hover washes, quiet fills. */
  ink50: string;
  ink100: string;
  ink200: string;
  /** Mid ink step — used by the neutral social-link hover. */
  ink500: string;
  /** Primary text on light surfaces. */
  ink900: string;
  /** Darker ink for hover states on light surfaces. */
  ink700: string;
  /** Light-surface hairline and stronger hairline. */
  border: string;
  borderStrong: string;
  /** Dark band fill; white text must clear 4.5:1 on it. */
  ink950: string;
  /** Dark band hover step and menu panel fill. */
  ink800: string;
  ink600: string;
  /** Department accent; clears 4.5:1 as text on the canvas and behind white. */
  accent: string;
  /**
   * Bright accent for the dark ink bands, where `accent` would fall below 4.5:1.
   * Also drives the header's active language link and the footer column headings,
   * which are the two places corporate teal is read as brand rather than as a
   * department colour.
   */
  accentBright: string;
};

export const DEPARTMENT_THEME_TOKENS: Record<
  DepartmentSlug,
  DepartmentThemeTokens
> = {
  "digital-marketing": {
    surface: "#FDFBF7",
    surfaceAlt: "#F6F1E7",
    surfaceSunken: "#EFE8DA",
    body: "#3A3F63",
    muted: "#5B5F82",
    ink50: "#F1EFE9",
    ink100: "#E9E5DC",
    ink200: "#D6D2C7",
    ink500: "#5B5F82",
    ink900: "#101438",
    ink700: "#1E2348",
    border: "#E6DECB",
    borderStrong: "#CBBFA3",
    ink950: "#0A0C22",
    ink800: "#171B38",
    ink600: "#2A2F55",
    accent: "#0066CC",
    accentBright: "#6FA8F5",
  },
  "electrical-services": {
    surface: "#FFFFFF",
    surfaceAlt: "#F6F6F6",
    surfaceSunken: "#EDEDED",
    body: "#3D3D3D",
    muted: "#5A5A5A",
    ink50: "#F2F2F2",
    ink100: "#E8E8E8",
    ink200: "#D2D2D2",
    ink500: "#5A5A5A",
    ink900: "#222222",
    ink700: "#3A3A3A",
    border: "#E2E2E2",
    borderStrong: "#C6C6C6",
    ink950: "#141414",
    ink800: "#2B2B2B",
    ink600: "#333333",
    accent: "#C2410C",
    accentBright: "#F0A94A",
  },
  "real-estate": {
    surface: "#F4F7F5",
    surfaceAlt: "#E9EFEB",
    surfaceSunken: "#DEE7E1",
    body: "#2E4A38",
    muted: "#4A6B55",
    ink50: "#EDF3EF",
    ink100: "#E2EBE5",
    ink200: "#C9D8CE",
    ink500: "#4A6B55",
    ink900: "#133322",
    ink700: "#1E4A32",
    border: "#D6E0D9",
    borderStrong: "#C6D3C9",
    ink950: "#0A1F14",
    ink800: "#10291A",
    ink600: "#1A4029",
    accent: "#1E5631",
    accentBright: "#4FD1A5",
  },
};

/** CSS custom-property name for a camelCase token key (`surfaceAlt` → `surface-alt`,
    `ink950` → `ink-950`). */
function cssTokenName(key: keyof DepartmentThemeTokens): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

/**
 * Flatten one department's tokens into the CSS custom-property names Tailwind
 * emits (`surfaceAlt` → `--color-surface-alt`). This is the single mapping shared
 * by the generated `html[data-theme=…]` block in `globals.css` and by the
 * contrast test, so the stylesheet and the assertion can never read two
 * different sets of values.
 */
export function departmentThemeCssVars(
  slug: DepartmentSlug,
): Record<string, string> {
  const tokens = DEPARTMENT_THEME_TOKENS[slug];
  return Object.fromEntries(
    (Object.keys(tokens) as (keyof DepartmentThemeTokens)[]).map((key) => [
      `--color-${cssTokenName(key)}`,
      tokens[key],
    ]),
  );
}
