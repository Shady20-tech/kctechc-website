import { MarketplaceFilterSection } from "@/components/marketplace/MarketplaceFilterSection";
import { MarketplaceFilterSidebar } from "@/components/marketplace/MarketplaceFilterSidebar";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { ProjectFilters } from "@/lib/content/projects";
import { activeProjectFilterKeys } from "@/lib/content/projects";

/**
 * The "Work Done" gallery's filter form.
 *
 * The same shell Real Estate and the store use — a collapsible section stack
 * inside a plain GET form — with this department's own three fields. The options
 * are derived from the projects that actually exist (`projectServiceFilterValues`
 * and friends), so the sidebar never offers a filter that would return nothing.
 *
 * A Server Component: the gallery's filters are three selects submitted with the
 * form, so there is no control here that needs to react before a submit.
 */
export function ProjectFilterSidebar({
  locale,
  action,
  filters,
  services,
  regions,
  propertyTypes,
  variant = "sidebar",
  onClose,
}: {
  locale: Locale;
  action: string;
  filters: ProjectFilters;
  /** `{ value, label }` options, already localized by the page. */
  services: readonly { value: string; label: string }[];
  regions: readonly { value: string; label: string }[];
  propertyTypes: readonly { value: string; label: string }[];
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}) {
  const t = createTranslator(locale).t;
  const activeCount = activeProjectFilterKeys(filters).length;

  return (
    <MarketplaceFilterSidebar
      action={action}
      variant={variant}
      onClose={onClose}
      activeCount={activeCount}
      labels={{
        submit: t("projects.filterApply"),
        clear: t("projects.clearFilters"),
        close: t("projects.closeFilters"),
        activeCount: t("projects.filtersActiveCount", {
          count: activeCount,
        }),
      }}
    >
      <MarketplaceFilterSection title={t("projects.filterServiceLabel")}>
        <FilterSelect
          id="filter-service"
          name="service"
          label={t("projects.filterServiceLabel")}
          allLabel={t("projects.filterAll")}
          options={services}
          value={filters.service}
        />
      </MarketplaceFilterSection>

      <MarketplaceFilterSection title={t("projects.filterRegionLabel")}>
        <FilterSelect
          id="filter-region"
          name="region"
          label={t("projects.filterRegionLabel")}
          allLabel={t("projects.filterAll")}
          options={regions}
          value={filters.region}
        />
      </MarketplaceFilterSection>

      <MarketplaceFilterSection title={t("projects.filterPropertyTypeLabel")}>
        <FilterSelect
          id="filter-property-type"
          name="propertyType"
          label={t("projects.filterPropertyTypeLabel")}
          allLabel={t("projects.filterAll")}
          options={propertyTypes}
          value={filters.propertyType}
        />
      </MarketplaceFilterSection>
    </MarketplaceFilterSidebar>
  );
}

/**
 * One labelled select.
 *
 * The visible label is a real `<label>` bound to the select, so the control is
 * named for a screen reader and clicking the text focuses it; the options come
 * from the page already localized.
 */
function FilterSelect({
  id,
  name,
  label,
  allLabel,
  options,
  value,
}: {
  id: string;
  name: string;
  label: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink-900">
      {label}
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
