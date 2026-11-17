import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import type { MarketplaceActiveFilterChip } from "@/components/marketplace/types";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  activeProjectFilterKeys,
  removeProjectFilter,
  serializeProjectFilters,
  type ProjectFilterKey,
  type ProjectFilters,
} from "@/lib/content/projects";

/**
 * The active "Work Done" filters, as removable chips.
 *
 * A binding over the shared `MarketplaceActiveFilters`: this component names each
 * value from the labels the page resolved and builds the removal URL from the
 * full filter state, and the shared component renders the chips. Each chip is a
 * link to the same view with that one filter removed.
 */
export function ProjectActiveFilters({
  locale,
  action,
  filters,
  services,
  regions,
  propertyTypes,
}: {
  locale: Locale;
  action: string;
  filters: ProjectFilters;
  services: readonly { value: string; label: string }[];
  regions: readonly { value: string; label: string }[];
  propertyTypes: readonly { value: string; label: string }[];
}) {
  const t = createTranslator(locale).t;
  const keys = activeProjectFilterKeys(filters);
  if (keys.length === 0) return null;

  const labelFor = (
    options: readonly { value: string; label: string }[],
    value: string | undefined,
  ) => options.find((option) => option.value === value)?.label ?? value ?? "";

  const chips: MarketplaceActiveFilterChip[] = keys.map((key) => {
    const label = chipLabel(key, {
      t,
      filters,
      services,
      regions,
      propertyTypes,
      labelFor,
    });
    return {
      key,
      label,
      href: `${action}${serializeProjectFilters(
        removeProjectFilter(filters, key),
      )}`,
      removeLabel: t("projects.removeFilter", { filter: label }),
    };
  });

  return (
    <MarketplaceActiveFilters
      chips={chips}
      clearHref={action}
      clearLabel={t("projects.clearFilters")}
      label={t("projects.activeFilters")}
    />
  );
}

function chipLabel(
  key: ProjectFilterKey,
  context: {
    t: (key: string, params?: Record<string, string | number>) => string;
    filters: ProjectFilters;
    services: readonly { value: string; label: string }[];
    regions: readonly { value: string; label: string }[];
    propertyTypes: readonly { value: string; label: string }[];
    labelFor: (
      options: readonly { value: string; label: string }[],
      value: string | undefined,
    ) => string;
  },
): string {
  const { t, filters, services, regions, propertyTypes, labelFor } = context;
  switch (key) {
    case "service":
      return `${t("projects.filterServiceLabel")}: ${labelFor(
        services,
        filters.service,
      )}`;
    case "region":
      return `${t("projects.filterRegionLabel")}: ${labelFor(
        regions,
        filters.region,
      )}`;
    case "propertyType":
      return `${t("projects.filterPropertyTypeLabel")}: ${labelFor(
        propertyTypes,
        filters.propertyType,
      )}`;
    default:
      return "";
  }
}
