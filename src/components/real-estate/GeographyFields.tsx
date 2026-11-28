"use client";

import { useState } from "react";

import { SelectField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

type GeographyOption = {
  id: string;
  name: string;
  code: string;
  divisions: readonly {
    id: string;
    name: string;
    code: string;
    subdivisions: readonly { id: string; name: string; code: string }[];
  }[];
};

/**
 * Cascading administrative location for a listing.
 *
 * A division belongs to one region and a subdivision to one division, so the
 * lower lists are built from the current selection rather than from the whole
 * tree. Changing a parent clears its children: a division left behind under a new
 * region would describe a place that does not exist.
 *
 * `locality` is still posted because the public card and search read it, but it is
 * derived from the selected administrative level. Asking an owner to type a
 * locality beside the same hierarchy was duplicate data entry and let the two
 * disagree.
 */
export function GeographyFields({
  geography,
  locale,
  initialRegionId = "",
  initialDivisionId = "",
  initialSubdivisionId = "",
  initialLocality = "",
  errors,
}: {
  geography: readonly GeographyOption[];
  locale: Locale;
  initialRegionId?: string;
  initialDivisionId?: string;
  initialSubdivisionId?: string;
  initialLocality?: string;
  errors?: {
    regionId?: string;
    divisionId?: string;
    subdivisionId?: string;
  };
}) {
  const t = createTranslator(locale).t;
  const [regionId, setRegionId] = useState(initialRegionId);
  const [divisionId, setDivisionId] = useState(initialDivisionId);
  const [subdivisionId, setSubdivisionId] = useState(initialSubdivisionId);
  const [locality, setLocality] = useState(initialLocality);

  const region = geography.find((entry) => entry.id === regionId);
  const division = region?.divisions.find((entry) => entry.id === divisionId);
  const subdivisions = division?.subdivisions ?? [];

  function selectRegion(value: string) {
    const next = geography.find((entry) => entry.id === value);
    setRegionId(value);
    setDivisionId("");
    setSubdivisionId("");
    setLocality(next?.name ?? "");
  }

  function selectDivision(value: string) {
    const next = region?.divisions.find((entry) => entry.id === value);
    setDivisionId(value);
    setSubdivisionId("");
    setLocality(next?.name ?? region?.name ?? "");
  }

  function selectSubdivision(value: string) {
    const next = division?.subdivisions.find((entry) => entry.id === value);
    setSubdivisionId(value);
    setLocality(next?.name ?? division?.name ?? region?.name ?? "");
  }

  return (
    <>
      <input type="hidden" name="locality" value={locality} />
      <SelectField
        id="regionId"
        name="regionId"
        label={t("realEstate.admin.fieldRegion")}
        value={regionId}
        onChange={(event) => selectRegion(event.target.value)}
        required
        requiredLabel={t("validation.required")}
        error={errors?.regionId}
      >
        <option value="">{t("realEstate.admin.selectPlaceholder")}</option>
        {geography.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="divisionId"
        name="divisionId"
        label={t("realEstate.admin.fieldDivision")}
        value={divisionId}
        onChange={(event) => selectDivision(event.target.value)}
        disabled={!region}
        error={errors?.divisionId}
      >
        <option value="">—</option>
        {(region?.divisions ?? []).map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="subdivisionId"
        name="subdivisionId"
        label={t("realEstate.admin.fieldSubdivision")}
        value={subdivisionId}
        onChange={(event) => selectSubdivision(event.target.value)}
        disabled={!division}
        error={errors?.subdivisionId}
      >
        <option value="">—</option>
        {subdivisions.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </SelectField>
    </>
  );
}
