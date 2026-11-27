"use client";

import { useActionState, useState } from "react";

import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  createDashboardListingAction,
  updateDashboardListingAction,
  type DashboardActionResult,
} from "@/lib/real-estate/dashboard-actions";
import type { DashboardListing } from "@/lib/real-estate/dashboard-loaders";
import {
  asListingPropertyKind,
  fieldRelevanceFor,
  shouldRenderField,
} from "@/lib/real-estate/field-relevance";
import {
  LISTING_PROPERTY_KINDS,
  LISTING_TYPES,
  PRICE_PERIODS,
  PROPERTY_TYPES,
  type ListingPropertyKind,
} from "@/lib/real-estate/enums";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import { MAX_PROPERTY_IMAGE_BYTES, megabytes } from "@/lib/uploads/limits";

export type DashboardGeographyOptions = readonly {
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

const EMPTY: DashboardActionResult = { ok: false, error: "" };

/**
 * Create or edit a listing from a dashboard.
 *
 * One component for both dashboards and for both modes, because the fields are
 * the same and only the action and the prefilled values differ. It is deliberately
 * a *separate* component from the console's `ListingForm` rather than a shared
 * one: the console form carries the administrator's vocabulary (import source,
 * internal notes, "create a listing"), and the dashboard's user is the owner of
 * one property, not an operator working a portfolio. Sharing it would mean either
 * leaking operator concepts into a customer-facing form or adding mode flags to
 * the console's.
 *
 * The field labels ARE shared — they come from `realEstate.admin.field*`, which
 * already describes each field well. Duplicating them would be two spellings of
 * "URL slug" waiting to drift.
 *
 * Coordinates and the owner's contact sit in a separate section because they are
 * written through a different RPC to a different table (`listing_private_details`),
 * and grouping them makes that boundary visible.
 */
export type DashboardPrivateDetails = {
  exactAddress?: string | null;
  exactLongitude?: number | null;
  exactLatitude?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
};

export function DashboardListingForm({
  kind,
  locale,
  geography,
  listing,
  privateDetails,
}: {
  kind: DashboardKind;
  locale: Locale;
  geography: DashboardGeographyOptions;
  listing?: DashboardListing;
  privateDetails?: DashboardPrivateDetails | null;
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const editing = Boolean(listing);
  const base = `account.dashboards.${kind}`;

  const [state, formAction, pending] = useActionState(
    async (_previous: DashboardActionResult, formData: FormData) =>
      listing
        ? updateDashboardListingAction(kind, listing.id, formData)
        : createDashboardListingAction(kind, formData),
    EMPTY,
  );

  // The kind drives which characteristic fields are worth asking for. It is
  // controlled so the form adapts the moment the owner picks "Land" rather than
  // only after a save.
  const [propertyKind, setPropertyKind] = useState<ListingPropertyKind | "">(
    asListingPropertyKind(listing?.propertyKind),
  );
  const relevance = fieldRelevanceFor(propertyKind);

  const fields = state.ok ? undefined : state.fields;
  const errorCode = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {state.ok ? (
        <Notice
          tone="success"
          title={
            editing
              ? t(`${base}.updatedHeading`)
              : state.submitted
                ? t(`${base}.createdSubmittedHeading`)
                : t(`${base}.createdHeading`)
          }
        >
          <p>
            {editing
              ? t(`${base}.updatedBody`)
              : state.submitted
                ? t(`${base}.createdSubmittedBody`)
                : t(`${base}.createdBody`)}
          </p>
          {state.message === "details_warning" ? (
            <p className="mt-2">{t(`${base}.detailsWarning`)}</p>
          ) : null}
          {state.mediaCount ? (
            <p className="mt-2">
              {t(`${base}.imagesAdded`, { count: state.mediaCount })}
            </p>
          ) : null}
          {state.mediaWarning ? (
            <p className="mt-2">
              {t(`${base}.mediaWarnings.${state.mediaWarning}`)}
            </p>
          ) : null}
          {state.publishWarning ? (
            <p className="mt-2">{t(`${base}.publishWarnings.failed`)}</p>
          ) : null}
          {!editing ? (
            <p className="mt-4">
              <ButtonLink
                href={`/${locale}/account/${kind}/${state.listingId}`}
                variant="accent"
                size="sm"
              >
                {t(`${base}.addImageCta`)}
              </ButtonLink>
            </p>
          ) : null}
        </Notice>
      ) : null}

      {errorCode && errorCode !== "invalid" ? (
        <Notice tone="warning" title={t(`${base}.editHeading`)}>
          <p>{t(`errors.${errorCode}`)}</p>
        </Notice>
      ) : null}

      {errorCode === "invalid" ? (
        <Notice tone="warning" title={t(`${base}.editHeading`)}>
          <p>{t("errors.invalid")}</p>
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
        />

        <TextField
          id="slug"
          name="slug"
          label={t("realEstate.admin.fieldSlug")}
          hint={t("realEstate.admin.fieldSlugHint")}
          defaultValue={listing?.slug ?? ""}
          error={fields?.slug}
          required
        />

        <TextAreaField
          id="description"
          name="description"
          label={t("realEstate.admin.fieldDescription")}
          hint={t("realEstate.admin.fieldDescriptionHint")}
          rows={6}
          defaultValue={listing?.description ?? ""}
          error={fields?.description}
          required
        />

        <SelectField
          id="listingType"
          name="listingType"
          label={t("realEstate.admin.fieldListingType")}
          defaultValue={listing?.listingType ?? "sale"}
          error={fields?.listingType}
        >
          {LISTING_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`realEstate.types.${value}`)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="propertyKind"
          name="propertyKind"
          label={t("realEstate.admin.fieldPropertyKind")}
          defaultValue={listing?.propertyKind ?? "house"}
          error={fields?.propertyKind}
          onChange={(event) =>
            setPropertyKind(event.target.value as ListingPropertyKind)
          }
        >
          {LISTING_PROPERTY_KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`realEstate.kinds.${value}`)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="propertyType"
          name="propertyType"
          label={t("realEstate.admin.fieldPropertyType")}
          defaultValue={listing?.propertyType ?? "residential"}
          error={fields?.propertyType}
        >
          {PROPERTY_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`realEstate.propertyTypes.${value}`)}
            </option>
          ))}
        </SelectField>
      </fieldset>

      {!editing ? (
        <>
          <ImageUploadField
            name="image"
            label={t("realEstate.admin.fieldImages")}
            hint={t("realEstate.admin.fieldImagesHint", {
              size: megabytes(MAX_PROPERTY_IMAGE_BYTES),
            })}
            tooLargeMessage={t("realEstate.admin.errors.too_large")}
            maxBytes={MAX_PROPERTY_IMAGE_BYTES}
          />
          <SelectField
            id="publishState"
            name="publishState"
            label={t(`${base}.fieldPublishState`)}
            hint={t(`${base}.fieldPublishStateHint`)}
            defaultValue="draft"
          >
            <option value="draft">{t(`${base}.publishStateDraft`)}</option>
            <option value="review">{t(`${base}.publishStateReview`)}</option>
          </SelectField>
        </>
      ) : null}

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
        >
          <option value="">{t("account.regionPlaceholder")}</option>
          {geography.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="divisionId"
          name="divisionId"
          label={t("realEstate.admin.fieldDivision")}
          defaultValue={listing?.divisionId ?? ""}
          error={fields?.divisionId}
        >
          <option value="">—</option>
          {geography.flatMap((region) =>
            region.divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {region.name} · {division.name}
              </option>
            )),
          )}
        </SelectField>

        <SelectField
          id="subdivisionId"
          name="subdivisionId"
          label={t("realEstate.admin.fieldSubdivision")}
          defaultValue={listing?.subdivisionId ?? ""}
          error={fields?.subdivisionId}
        >
          <option value="">—</option>
          {geography.flatMap((region) =>
            region.divisions.flatMap((division) =>
              division.subdivisions.map((subdivision) => (
                <option key={subdivision.id} value={subdivision.id}>
                  {division.name} · {subdivision.name}
                </option>
              )),
            ),
          )}
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
        <p className="text-sm text-muted">
          {t("realEstate.admin.fieldsOptionalNote")}
        </p>

        <TextField
          id="price"
          name="price"
          label={t("realEstate.admin.fieldPrice")}
          hint={t("realEstate.admin.fieldPriceHint")}
          inputMode="numeric"
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
          {PRICE_PERIODS.map((value) => (
            <option key={value} value={value}>
              {t(`realEstate.periods.${value}`)}
            </option>
          ))}
        </SelectField>

        <label
          htmlFor="priceOnRequest"
          className="flex items-start gap-3 text-sm"
        >
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

        {shouldRenderField(relevance.landArea, listing?.landAreaSqm) ? (
          <TextField
            id="landAreaSqm"
            name="landAreaSqm"
            label={t("realEstate.admin.fieldLandArea")}
            hint={t("realEstate.admin.fieldLandAreaHint")}
            inputMode="numeric"
            defaultValue={
              listing?.landAreaSqm != null ? String(listing.landAreaSqm) : ""
            }
            error={fields?.landAreaSqm}
          />
        ) : null}

        {shouldRenderField(relevance.buildingArea, listing?.buildingAreaSqm) ? (
          <TextField
            id="buildingAreaSqm"
            name="buildingAreaSqm"
            label={t("realEstate.admin.fieldBuildingArea")}
            hint={t("realEstate.admin.fieldBuildingAreaHint")}
            inputMode="numeric"
            defaultValue={
              listing?.buildingAreaSqm != null
                ? String(listing.buildingAreaSqm)
                : ""
            }
            error={fields?.buildingAreaSqm}
          />
        ) : null}

        {shouldRenderField(relevance.rooms, listing?.bedrooms) ? (
          <TextField
            id="bedrooms"
            name="bedrooms"
            label={t("realEstate.admin.fieldBedrooms")}
            hint={t("realEstate.admin.fieldBedroomsHint")}
            inputMode="numeric"
            defaultValue={
              listing?.bedrooms != null ? String(listing.bedrooms) : ""
            }
            error={fields?.bedrooms}
          />
        ) : null}

        {shouldRenderField(relevance.rooms, listing?.bathrooms) ? (
          <TextField
            id="bathrooms"
            name="bathrooms"
            label={t("realEstate.admin.fieldBathrooms")}
            hint={t("realEstate.admin.fieldBathroomsHint")}
            inputMode="numeric"
            defaultValue={
              listing?.bathrooms != null ? String(listing.bathrooms) : ""
            }
            error={fields?.bathrooms}
          />
        ) : null}

        {shouldRenderField(relevance.yearBuilt, listing?.yearBuilt) ? (
          <TextField
            id="yearBuilt"
            name="yearBuilt"
            label={t("realEstate.admin.fieldYearBuilt")}
            hint={t("realEstate.admin.fieldYearBuiltHint")}
            inputMode="numeric"
            defaultValue={
              listing?.yearBuilt != null ? String(listing.yearBuilt) : ""
            }
            error={fields?.yearBuilt}
          />
        ) : null}
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
          rows={4}
          defaultValue={(listing?.highlights ?? []).join("\n")}
        />

        <TextAreaField
          id="amenities"
          name="amenities"
          label={t("realEstate.admin.fieldAmenities")}
          hint={t("realEstate.admin.fieldAmenitiesHint")}
          rows={3}
          defaultValue={(listing?.amenities ?? []).join("\n")}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="font-display text-lg font-semibold text-ink-900">
          {t("realEstate.admin.sections.private")}
        </legend>
        <p className="text-sm text-muted">
          {t("realEstate.admin.fieldCoordinatesHint")}
        </p>

        <TextField
          id="longitude"
          name="longitude"
          label={t("realEstate.admin.fieldLongitude")}
          hint={t("realEstate.admin.fieldLongitudeHint")}
          inputMode="decimal"
          defaultValue={
            privateDetails?.exactLongitude != null
              ? String(privateDetails.exactLongitude)
              : ""
          }
          error={fields?.longitude}
        />

        <TextField
          id="latitude"
          name="latitude"
          label={t("realEstate.admin.fieldLatitude")}
          hint={t("realEstate.admin.fieldLatitudeHint")}
          inputMode="decimal"
          defaultValue={
            privateDetails?.exactLatitude != null
              ? String(privateDetails.exactLatitude)
              : ""
          }
          error={fields?.latitude}
        />

        <TextField
          id="exactAddress"
          name="exactAddress"
          label={t("realEstate.admin.fieldExactAddress")}
          hint={t("realEstate.admin.fieldExactAddressHint")}
          defaultValue={privateDetails?.exactAddress ?? ""}
          error={fields?.exactAddress}
        />

        <TextField
          id="ownerName"
          name="ownerName"
          label={t("realEstate.admin.fieldOwnerName")}
          defaultValue={privateDetails?.ownerName ?? ""}
          error={fields?.ownerName}
        />

        <TextField
          id="ownerPhone"
          name="ownerPhone"
          label={t("realEstate.admin.fieldOwnerPhone")}
          defaultValue={privateDetails?.ownerPhone ?? ""}
          error={fields?.ownerPhone}
        />

        <TextField
          id="ownerEmail"
          name="ownerEmail"
          label={t("realEstate.admin.fieldOwnerEmail")}
          type="email"
          defaultValue={privateDetails?.ownerEmail ?? ""}
          error={fields?.ownerEmail}
        />
      </fieldset>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending
          ? t(`${base}.saving`)
          : editing
            ? t(`${base}.saveSubmit`)
            : t(`${base}.createSubmit`)}
      </Button>
    </form>
  );
}
