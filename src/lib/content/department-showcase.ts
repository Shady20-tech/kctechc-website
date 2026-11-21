import type { DepartmentSlug } from "@/lib/config/site";
import { localizeService, serviceRecordsFor } from "@/lib/content/defaults";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * The services showcase shown on the corporate gateway and the localized home.
 *
 * This module is deliberately a *projection of content that already exists*, not
 * a second catalogue. Digital Marketing and Electrical Services each contribute
 * their real service records (the same records the department pages and the
 * sitemap use), and Real Estate contributes the property categories it actually
 * supports. Nothing here invents a service, a claim or an inventory figure: the
 * titles, summaries and category names all resolve through the same localizers
 * the dedicated pages call.
 *
 * Why Real Estate is presented as categories rather than services: the department
 * has no services in the database (`departmentHasServices` is false for it, which
 * is why it has no `/services` route). Presenting invented "services" for it
 * would be the exact fabrication the brief forbids. Its genuine offering is the
 * marketplace, so the showcase names the categories a visitor can actually browse
 * and links them to the live filtered listing URLs.
 *
 * A department whose content is missing is omitted rather than shown with a
 * placeholder, so an unseeded deployment degrades to two panels instead of
 * rendering an empty one.
 */

export type ShowcaseItem = {
  /** Stable key, used as the React key. */
  key: string;
  title: string;
  summary: string;
  /** Destination for the item. */
  href: string;
};

export type ShowcasePanel = {
  department: DepartmentSlug;
  /** Heading for the panel, from the department's own label. */
  label: string;
  /** One-line framing sentence for the panel. */
  intro: string;
  /** Destination for the panel's primary action. */
  href: string;
  actionLabel: string;
  items: readonly ShowcaseItem[];
};

/**
 * How many items each panel shows.
 *
 * A showcase is a sample, not the catalogue: six cards per department is enough
 * to communicate range and still fits one scroll-stop on a phone. The full set is
 * one click away on the department page, which is where a visitor who wants the
 * complete list already is.
 */
const SHOWCASE_LIMIT = 6;

/**
 * Real Estate category shortcuts.
 *
 * These map onto the filter values `ListingFilters` already understands
 * (`type`, `kind`, `propertyType`), so each shortcut opens the listings page with
 * a working, shareable, server-side-filtered search. The labels come from
 * `realEstate.categories`, which is the same dictionary the filter sidebar reads
 * — one spelling per category.
 */
const REAL_ESTATE_SHORTCUTS: readonly {
  key: string;
  labelKey: string;
  summaryKey: string;
  query: string;
}[] = [
  {
    key: "forSale",
    labelKey: "forSale",
    summaryKey: "realEstate.showcase.forSaleSummary",
    query: "type=sale",
  },
  {
    key: "forRent",
    labelKey: "forRent",
    summaryKey: "realEstate.showcase.forRentSummary",
    query: "type=rent",
  },
  {
    key: "landSale",
    labelKey: "landSale",
    summaryKey: "realEstate.showcase.landSaleSummary",
    query: "type=sale&kind=land",
  },
  {
    key: "shortTerm",
    labelKey: "shortTerm",
    summaryKey: "realEstate.showcase.shortTermSummary",
    query: "type=short_term",
  },
  {
    key: "commercial",
    labelKey: "commercial",
    summaryKey: "realEstate.showcase.commercialSummary",
    query: "propertyType=commercial",
  },
  {
    key: "apartment",
    labelKey: "apartment",
    summaryKey: "realEstate.showcase.apartmentSummary",
    query: "kind=apartment",
  },
];

const LISTINGS_PATH = "/real-estate/listings";

function servicesPanel(
  department: DepartmentSlug,
  locale: Locale,
  labelKey: string,
  introKey: string,
): ShowcasePanel | null {
  const records = serviceRecordsFor(department);
  if (records.length === 0) return null;

  const { t } = createTranslator(locale);
  const items = records.slice(0, SHOWCASE_LIMIT).map((record) => {
    const service = localizeService(record, locale);
    return {
      key: service.slug,
      title: service.title,
      summary: service.summary,
      href: `/${locale}/${department}/services/${service.slug}`,
    };
  });

  return {
    department,
    label: t(labelKey),
    intro: t(introKey),
    href: `/${locale}/${department}`,
    actionLabel: t("actions.exploreDepartment"),
    items,
  };
}

function realEstatePanel(locale: Locale): ShowcasePanel {
  const { t } = createTranslator(locale);
  const items = REAL_ESTATE_SHORTCUTS.map((shortcut) => ({
    key: shortcut.key,
    title: t(`realEstate.categories.${shortcut.labelKey}`),
    summary: t(shortcut.summaryKey),
    href: `/${locale}${LISTINGS_PATH}?${shortcut.query}`,
  }));

  return {
    department: "real-estate",
    label: t("departments.realEstate.label"),
    intro: t("realEstate.showcase.intro"),
    href: `/${locale}${LISTINGS_PATH}`,
    actionLabel: t("realEstate.marketplace.browseAll"),
    items,
  };
}

/**
 * Build the showcase panels for a locale.
 *
 * Order follows `DEPARTMENTS` so the gateway, the localized home and the
 * department pages all present the departments in the same sequence.
 */
export function buildShowcasePanels(locale: Locale): ShowcasePanel[] {
  const panels: (ShowcasePanel | null)[] = [
    servicesPanel(
      "digital-marketing",
      locale,
      "departments.digitalMarketing.label",
      "home.showcase.digitalMarketingIntro",
    ),
    servicesPanel(
      "electrical-services",
      locale,
      "departments.electricalServices.label",
      "home.showcase.electricalServicesIntro",
    ),
    realEstatePanel(locale),
  ];
  return panels.filter((panel): panel is ShowcasePanel => panel !== null);
}
