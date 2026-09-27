"use client";

import { useActionState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { LISTING_PROPERTY_KINDS, LISTING_TYPES, PRICE_PERIODS, PROPERTY_TYPES } from "@/lib/real-estate/enums";
import {
  createListingAction,
  updateListingAction,
  type ListingActionResult,
} from "@/lib/real-estate/admin-actions";
import type { AdminListingRecord } from "@/lib/real-estate/types";

export type GeographyOptions = readonly {
  id: string;
  name: string;
  code: string;
  divisions: readonly {
    id: string;
    name: string;
    code: string;
    subdivisions: readonly { id: string; name: string; code: string }[];
  }[];
}[];

const EMPTY: ListingActionResult = { ok: false, error: "" };

/**
 * Create or edit a listing.
 *
 * One component for both, because the fields are identical and the difference is
 * only which action runs and which values are prefilled. Two near-copies would
 * drift, and the field a form omits is exactly the field an operator can never
 * set.
 *
 * The coordinates and owner contact are in a visibly separate section. They are
 * written through a different RPC to a different table, and grouping them makes
 * that boundary visible rather than leaving an administrator to discover it.
 */
export function ListingForm({
  locale,
  geography,
  listing,
}: {
  locale: Locale;
  geography: GeographyOptions;
  listing?: AdminListingRecord;
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const editing = Boolean(listing);

  const [state, formAction, pending] = useActionState(
    async (_previous: ListingActionResult, formData: FormData) =>
      listing
        ? updateListingAction(listing.id, formData)
        : createListingAction(formData),
    EMPTY,
  );

  const fields = state.ok ? undefined : state.fields;
  const errorCode = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {state.ok ? (
        <Notice
          tone="success"
          title={
            editing ? t("realEstate.admin.updatedHeading") : t("realEstate.admin.createdHeading")
          }
        >
          <p>
            {editing
              ? t("realEstate.admin.updatedBody")
              : t("realEstate.admin.createdBody")}
          </p>
          {state.warning ? (
            <p className="mt-2">{t("realEstate.admin.detailWarning")}</p>
          ) : null}
        </Notice>
      ) : null}

      {errorCode && errorCode !== "invalid" ? (
        <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
          <p>{t(`realEstate.admin.errors.${errorCode}`)}</p>
        </Notice>
      ) : null}

      {errorCode === "invalid" ? (
        <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
          <p>{t("realEstate.admin.errors.invalid")}</p>
        </Notice>
      ) : null}

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.identity")}
        </legend>

        <TextField
          id="title"
          name="title"
          label={t("realEstate.admin.fieldTitle")}
          hint={t("realEstate.admin.fieldTitleHint")}
          defaultValue={listing?.title ?? ""}
          error={fields?.title}
          required
          requiredLabel={t("validation.required")}
        />
        <TextField
          id="slug"
          name="slug"
          label={t("realEstate.admin.fieldSlug")}
          hint={t("realEstate.admin.fieldSlugHint")}
          defaultValue={listing?.slug ?? ""}
          error={fields?.slug}
          required
          requiredLabel={t("validation.required")}
        />
        <TextAreaField
          id="description"
          name="description"
          label={t("realEstate.admin.fieldDescription")}
          hint={t("realEstate.admin.fieldDescriptionHint")}
          defaultValue={listing?.description ?? ""}
          error={fields?.description}
          rows={8}
          required
          requiredLabel={t("validation.required")}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.classification")}
        </legend>

        <SelectField
          id="listingType"
          name="listingType"
          label={t("realEstate.admin.fieldListingType")}
          defaultValue={listing?.listingType ?? ""}
          error={fields?.listingType}
          required
          requiredLabel={t("validation.required")}
        >
          <option value="">{t("realEstate.admin.fieldListingTypePlaceholder")}</option>
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`realEstate.types.${type}`)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="propertyKind"
          name="propertyKind"
          label={t("realEstate.admin.fieldPropertyKind")}
          defaultValue={listing?.propertyKind ?? ""}
          error={fields?.propertyKind}
          required
          requiredLabel={t("validation.required")}
        >
          <option value="">{t("realEstate.admin.fieldPropertyKindPlaceholder")}</option>
          {LISTING_PROPERTY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`realEstate.kinds.${kind}`)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="propertyType"
          name="propertyType"
          label={t("realEstate.admin.fieldPropertyType")}
          defaultValue={listing?.propertyType ?? ""}
          error={fields?.propertyType}
          required
          requiredLabel={t("validation.required")}
        >
          <option value="">{t("realEstate.admin.fieldPropertyTypePlaceholder")}</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`realEstate.propertyTypes.${type}`)}
            </option>
          ))}
        </SelectField>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.location")}
        </legend>

        <SelectField
          id="regionId"
          name="regionId"
          label={t("realEstate.admin.fieldRegion")}
          defaultValue={listing?.regionId ?? ""}
          error={fields?.regionId}
          required
          requiredLabel={t("validation.required")}
        >
          <option value="">{t("realEstate.admin.selectPlaceholder")}</option>
          {geography.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="locality"
          name="locality"
          label={t("realEstate.admin.fieldLocality")}
          hint={t("realEstate.admin.fieldLocalityHint")}
          defaultValue={listing?.locality ?? ""}
          error={fields?.locality}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.pricing")}
        </legend>

        <TextField
          id="price"
          name="price"
          label={t("realEstate.admin.fieldPrice")}
          hint={t("realEstate.admin.fieldPriceHint")}
          defaultValue={
            listing?.priceMinor != null ? String(listing.priceMinor) : ""
          }
          error={fields?.price}
        />

        <SelectField
          id="pricePeriod"
          name="pricePeriod"
          label={t("realEstate.admin.fieldPricePeriod")}
          defaultValue={listing?.pricePeriod ?? "total"}
          error={fields?.pricePeriod}
        >
          {PRICE_PERIODS.map((period) => (
            <option key={period} value={period}>
              {t(`realEstate.periods.${period}`)}
            </option>
          ))}
        </SelectField>

        <div>
          <label htmlFor="priceOnRequest" className="flex items-start gap-3 text-sm">
            <input
              id="priceOnRequest"
              name="priceOnRequest"
              type="checkbox"
              defaultChecked={listing?.priceOnRequest ?? false}
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
            />
            <span className="text-body">
              {t("realEstate.admin.fieldPriceOnRequest")}
              <span className="mt-1 block text-xs text-muted">
                {t("realEstate.admin.fieldPriceOnRequestHint")}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.size")}
        </legend>

        <TextField
          id="landAreaSqm"
          name="landAreaSqm"
          label={t("realEstate.admin.fieldLandArea")}
          defaultValue={listing?.landAreaSqm != null ? String(listing.landAreaSqm) : ""}
          error={fields?.landAreaSqm}
        />
        <TextField
          id="buildingAreaSqm"
          name="buildingAreaSqm"
          label={t("realEstate.admin.fieldBuildingArea")}
          defaultValue={
            listing?.buildingAreaSqm != null ? String(listing.buildingAreaSqm) : ""
          }
          error={fields?.buildingAreaSqm}
        />
        <TextField
          id="bedrooms"
          name="bedrooms"
          label={t("realEstate.admin.fieldBedrooms")}
          defaultValue={listing?.bedrooms != null ? String(listing.bedrooms) : ""}
          error={fields?.bedrooms}
        />
        <TextField
          id="bathrooms"
          name="bathrooms"
          label={t("realEstate.admin.fieldBathrooms")}
          defaultValue={listing?.bathrooms != null ? String(listing.bathrooms) : ""}
          error={fields?.bathrooms}
        />
        <TextField
          id="yearBuilt"
          name="yearBuilt"
          label={t("realEstate.admin.fieldYearBuilt")}
          defaultValue={listing?.yearBuilt != null ? String(listing.yearBuilt) : ""}
          error={fields?.yearBuilt}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.content")}
        </legend>

        <TextAreaField
          id="highlights"
          name="highlights"
          label={t("realEstate.admin.fieldHighlights")}
          hint={t("realEstate.admin.fieldHighlightsHint")}
          defaultValue={listing?.highlights.join("\n") ?? ""}
          error={fields?.highlights}
          rows={4}
        />
        <TextAreaField
          id="amenities"
          name="amenities"
          label={t("realEstate.admin.fieldAmenities")}
          hint={t("realEstate.admin.fieldAmenitiesHint")}
          defaultValue={listing?.amenities.join("\n") ?? ""}
          error={fields?.amenities}
          rows={4}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.private")}
        </legend>
        <p className="text-sm text-muted">
          {t("realEstate.admin.sections.privateNotice")}
        </p>

        <TextField
          id="exactAddress"
          name="exactAddress"
          label={t("realEstate.admin.fieldExactAddress")}
          hint={t("realEstate.admin.fieldExactAddressHint")}
          error={fields?.exactAddress}
        />
        <TextField
          id="longitude"
          name="longitude"
          label={t("realEstate.admin.fieldLongitude")}
          hint={t("realEstate.admin.fieldCoordinatesHint")}
          error={fields?.longitude}
        />
        <TextField
          id="latitude"
          name="latitude"
          label={t("realEstate.admin.fieldLatitude")}
          error={fields?.latitude}
        />
        <TextField
          id="ownerName"
          name="ownerName"
          label={t("realEstate.admin.fieldOwnerName")}
          error={fields?.ownerName}
        />
        <TextField
          id="ownerPhone"
          name="ownerPhone"
          label={t("realEstate.admin.fieldOwnerPhone")}
          error={fields?.ownerPhone}
        />
        <TextField
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          label={t("realEstate.admin.fieldOwnerEmail")}
          error={fields?.ownerEmail}
        />
        <TextAreaField
          id="internalNotes"
          name="internalNotes"
          label={t("realEstate.admin.fieldInternalNotes")}
          hint={t("realEstate.admin.fieldInternalNotesHint")}
          error={fields?.internalNotes}
          rows={4}
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending
            ? editing
              ? t("realEstate.admin.saving")
              : t("realEstate.admin.creating")
            : editing
              ? t("realEstate.admin.saveSubmit")
              : t("realEstate.admin.createSubmit")}
        </Button>
        <ButtonLink href="/admin/real-estate/listings" variant="secondary">
          {t("realEstate.admin.backToListings")}
        </ButtonLink>
      </div>
    </form>
  );
}
