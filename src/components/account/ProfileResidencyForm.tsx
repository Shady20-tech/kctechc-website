"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextField } from "@/components/ui/Form";
import {
  updateProfileResidencyAction,
  type ProfileResidencyState,
} from "@/lib/real-estate/profile-actions";

/**
 * Residency and contact details.
 *
 * The region selector is only meaningful for a Cameroon resident — the database
 * enforces that (`profiles_region_requires_cameroon`) and the field is hidden for
 * any other country so the constraint is rarely reached. Hiding it in local state
 * rather than unmounting the whole subtree keeps the country and ISO inputs
 * uncontrolled, so the browser keeps the user's edits across a re-render.
 *
 * The country ISO code drives the visibility, not the country name, because the
 * name is free text and "Cameroon", "Cameroun" and "CM" all occur. The code is the
 * stable key the database constraint uses.
 */
export function ProfileResidencyForm({
  profile,
  regions,
  labels,
}: {
  profile: {
    fullName: string | null;
    phone: string | null;
    countryOfResidence: string | null;
    countryIsoCode: string | null;
    city: string | null;
    regionId: string | null;
    permanentResidency: boolean | null;
  };
  regions: readonly { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    updateProfileResidencyAction,
    null as ProfileResidencyState | null,
  );

  // Initialised from the stored value so an existing Cameroon resident sees the
  // selector on first paint, and updated as the user edits the code.
  const [isoCode, setIsoCode] = useState(profile.countryIsoCode ?? "");
  const isCameroon = isoCode.trim().toUpperCase() === "CM";

  const fieldError = (field: string): string | undefined => {
    const key = state && !state.ok ? state.fields?.[field] : undefined;
    return key
      ? (labels[`errors.${key}`] ?? labels["errors.invalid"])
      : undefined;
  };

  return (
    <section aria-labelledby="residency-heading" className="space-y-4">
      <div>
        <h2
          id="residency-heading"
          className="text-lg font-semibold text-ink-900"
        >
          {labels.residencyHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.residencyIntro}</p>
      </div>

      <form action={formAction} className="max-w-xl space-y-5">
        {state && !state.ok ? (
          <Notice tone="error">
            {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
          </Notice>
        ) : null}
        {state?.ok ? <Notice tone="success">{labels.updated}</Notice> : null}

        <TextField
          id="fullName"
          name="fullName"
          label={labels.nameLabel ?? ""}
          defaultValue={profile.fullName ?? ""}
          autoComplete="name"
          required
          error={fieldError("fullName")}
        />

        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={labels.phoneLabel ?? ""}
          hint={labels.phoneHint ?? ""}
          defaultValue={profile.phone ?? ""}
          autoComplete="tel"
          error={fieldError("phone")}
        />

        <TextField
          id="countryOfResidence"
          name="countryOfResidence"
          label={labels.countryLabel ?? ""}
          defaultValue={profile.countryOfResidence ?? ""}
          autoComplete="country-name"
          required
          error={fieldError("countryOfResidence")}
        />

        <TextField
          id="countryIsoCode"
          name="countryIsoCode"
          label={labels.countryCodeLabel ?? ""}
          hint={labels.countryCodeHint ?? ""}
          defaultValue={profile.countryIsoCode ?? ""}
          autoComplete="country"
          maxLength={2}
          onChange={(event) => setIsoCode(event.target.value)}
          error={fieldError("countryIsoCode")}
        />

        <TextField
          id="city"
          name="city"
          label={labels.cityLabel ?? ""}
          defaultValue={profile.city ?? ""}
          autoComplete="address-level2"
          error={fieldError("city")}
        />

        {isCameroon ? (
          <SelectField
            id="regionId"
            name="regionId"
            label={labels.regionLabel ?? ""}
            hint={labels.regionHint ?? ""}
            defaultValue={profile.regionId ?? ""}
            error={fieldError("regionId")}
          >
            <option value="">{labels.regionPlaceholder}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </SelectField>
        ) : null}

        <div>
          <SelectField
            id="permanentResidency"
            name="permanentResidency"
            label={labels.permanentResidencyLabel ?? ""}
            hint={labels.permanentResidencyHint}
            defaultValue={
              profile.permanentResidency === null
                ? ""
                : String(profile.permanentResidency)
            }
          >
            <option value="">{labels.permanentResidencyUnstated}</option>
            <option value="true">{labels.permanentResidencyYes}</option>
            <option value="false">{labels.permanentResidencyNo}</option>
          </SelectField>
        </div>

        <SaveButton label={labels.save} pendingLabel={labels.saving} />
      </form>
    </section>
  );
}

function SaveButton({
  label,
  pendingLabel,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
