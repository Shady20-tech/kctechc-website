"use client";

import { useActionState, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  createProductAction,
  updateProductAction,
  type CreateProductResult,
} from "@/lib/store/admin-actions";
import { MAX_PRODUCT_IMAGE_BYTES, megabytes } from "@/lib/uploads/limits";

/** The fields an edit pre-fills, mirroring `AdminProduct` from the loader. */
export type ProductFormInitial = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  brand: string;
  /** Database-issued, read-only. Present only when editing an existing row. */
  productReference?: string;
  priceMinor: number;
  stock: number;
  departmentSlug: string;
  seoTitle: string;
  seoDescription: string;
};

/**
 * Product create/edit form.
 *
 * A Client Component only so the action's result can be rendered inline and the
 * category list can follow the department picker. The action runs on the server,
 * and `useActionState` keeps the submitted values in the form when validation
 * fails — a user who typed a 200-word description does not lose it to a mistyped
 * slug.
 *
 * There is no client-side duplicate check and no client-side price arithmetic:
 * both are decided by the database and the action, so the form never claims
 * something is valid that the server would refuse.
 *
 * The department picker is the feature. A product's department is its category's,
 * so choosing a department narrows the category list to that department's; the
 * product is then created in that department and its staff can manage it. A
 * single-department editor sees one department and a pre-filtered list, while a
 * super admin can place a product anywhere.
 *
 * One component serves creation and editing: the fields, their rules and their
 * error messages are identical, and the only difference is which action runs and
 * which values pre-fill. A separate edit form would be a second place for the two
 * to drift.
 */

const EMPTY: CreateProductResult = { ok: false, error: "" };

export function ProductForm({
  categories,
  departments,
  locale,
  initial,
}: {
  categories: readonly { id: string; name: string; departmentSlug: string }[];
  departments: readonly { slug: string; name: string }[];
  locale: Locale;
  /** Present when editing; absent when creating. */
  initial?: ProductFormInitial;
}) {
  const editing = Boolean(initial);
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    async (_previous: CreateProductResult, formData: FormData) =>
      editing ? updateProductAction(formData) : createProductAction(formData),
    EMPTY,
  );

  // A single department has nothing to choose, so it is preselected and the
  // category list is already narrow. With more than one, the category options
  // are filtered to the chosen department as a UI convenience; the action
  // re-reads the category's department regardless, so the filter is not a control.
  const onlyDepartment = departments.length === 1 ? departments[0]!.slug : "";
  const [department, setDepartment] = useState(
    initial?.departmentSlug ?? onlyDepartment,
  );
  const visibleCategories = department
    ? categories.filter((category) => category.departmentSlug === department)
    : categories;

  const fields = state.ok ? undefined : state.fields;
  const errorCode = state.ok ? undefined : state.error;
  const errorDetail = state.ok ? undefined : state.detail;

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {initial ? (
        <input type="hidden" name="productId" value={initial.id} />
      ) : null}

      {!editing ? (
        <Notice tone="info">{t("admin.store.imageUploadNotice")}</Notice>
      ) : null}

      {state.ok ? (
        <Notice
          tone="success"
          title={t(
            editing
              ? "admin.store.updatedHeading"
              : "admin.store.createdHeading",
          )}
        >
          <p>
            {editing
              ? t("admin.store.updatedBody")
              : state.published
                ? t("admin.store.publishedNow")
                : t("admin.store.createdBody")}
          </p>
          {!editing ? (
            <>
              <p className="mt-1">
                {t("admin.store.translationCount", {
                  count: state.translationKeyCount,
                })}
              </p>
              <p className="mt-1">
                {t("admin.store.syncQueued", { count: state.syncQueued })}
              </p>
            </>
          ) : null}
          {state.syncWarning ? (
            <p className="mt-2">
              {t("admin.store.syncWarning", { reason: state.syncWarning })}
            </p>
          ) : null}
          {state.seoWarning ? (
            <p className="mt-2">{t("admin.store.seoWarning")}</p>
          ) : null}
          {state.mediaCount ? (
            <p className="mt-2">
              {t("admin.store.imagesAdded", { count: state.mediaCount })}
            </p>
          ) : null}
          {state.mediaWarning ? (
            <p className="mt-2">
              {t(`admin.store.mediaWarnings.${state.mediaWarning}`)}
            </p>
          ) : null}
          {state.publishWarning ? (
            <p className="mt-2">
              {t(`admin.store.publishWarnings.${state.publishWarning}`)}
            </p>
          ) : null}
          <p className="mt-4">
            <ButtonLink
              href={`/admin/store/${state.productId}`}
              variant="accent"
              size="sm"
            >
              {t("admin.store.goToImage")}
            </ButtonLink>
          </p>
        </Notice>
      ) : null}

      {errorCode && errorCode !== "invalid" ? (
        <Notice tone="warning" title={t("admin.store.errorHeading")}>
          <p>{t(`admin.store.errors.${errorCode}`)}</p>
          {errorDetail ? (
            <p className="mt-2 break-words font-mono text-xs">{errorDetail}</p>
          ) : null}
        </Notice>
      ) : null}

      {errorCode === "invalid" ? (
        <Notice tone="warning" title={t("admin.store.errorHeading")}>
          <p>{t("admin.store.errors.invalid")}</p>
          {errorDetail ? (
            <p className="mt-2 break-words font-mono text-xs">{errorDetail}</p>
          ) : null}
        </Notice>
      ) : null}

      <TextField
        id="title"
        defaultValue={initial?.title ?? ""}
        name="title"
        label={t("admin.store.fieldTitle")}
        hint={t("admin.store.fieldTitleHint")}
        required
        requiredLabel={t("common.required")}
        error={fields?.title}
      />

      <TextField
        id="slug"
        defaultValue={initial?.slug ?? ""}
        name="slug"
        label={t("admin.store.fieldSlug")}
        hint={t("admin.store.fieldSlugHint")}
        required
        requiredLabel={t("common.required")}
        error={fields?.slug}
      />

      <TextField
        id="sku"
        defaultValue={initial?.sku ?? ""}
        name="sku"
        label={t("admin.store.fieldSku")}
        hint={t("admin.store.fieldSkuHint")}
        required
        requiredLabel={t("common.required")}
        error={fields?.sku}
      />

      {/* A single department has nothing to choose, so the control is rendered
          only when there is a genuine choice to make. */}
      {departments.length > 1 ? (
        <SelectField
          id="department"
          name="department"
          label={t("admin.store.fieldDepartment")}
          hint={t("admin.store.fieldDepartmentHint")}
          required
          requiredLabel={t("common.required")}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          <option value="" disabled>
            {t("admin.store.fieldDepartmentPlaceholder")}
          </option>
          {departments.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="department" value={department} />
      )}

      <SelectField
        id="categoryId"
        defaultValue={initial?.categoryId ?? ""}
        name="categoryId"
        label={t("admin.store.fieldCategory")}
        required
        requiredLabel={t("common.required")}
        error={fields?.categoryId}
      >
        <option value="" disabled>
          {t("admin.store.fieldCategoryPlaceholder")}
        </option>
        {visibleCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>

      {!editing ? (
        <ImageUploadField
          name="image"
          label={t("admin.store.fieldImages")}
          hint={t("admin.store.fieldImagesHint", {
            size: megabytes(MAX_PRODUCT_IMAGE_BYTES),
          })}
          tooLargeMessage={t("admin.store.errors.too_large")}
          maxBytes={MAX_PRODUCT_IMAGE_BYTES}
          removeLabel={t("actions.remove")}
        />
      ) : null}

      <TextAreaField
        id="shortDescription"
        defaultValue={initial?.shortDescription ?? ""}
        name="shortDescription"
        label={t("admin.store.fieldShortDescription")}
        hint={t("admin.store.fieldShortDescriptionHint")}
        required
        requiredLabel={t("common.required")}
        rows={3}
        error={fields?.shortDescription}
      />

      <TextAreaField
        id="description"
        defaultValue={initial?.description ?? ""}
        name="description"
        label={t("admin.store.fieldDescription")}
        required
        requiredLabel={t("common.required")}
        rows={10}
        error={fields?.description}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="brand"
          defaultValue={initial?.brand ?? ""}
          name="brand"
          label={t("admin.store.fieldBrand")}
          error={fields?.brand}
        />
      </div>

      {initial?.productReference ? (
        <div className="rounded-field border border-border bg-surface-alt px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("admin.store.fieldProductReference")}
          </p>
          <p className="mt-1 font-mono text-sm text-ink-900">
            {initial.productReference}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("admin.store.fieldProductReferenceHint")}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="priceMinor"
          defaultValue={initial?.priceMinor ?? ""}
          name="priceMinor"
          type="number"
          min={1}
          step={1}
          label={t("admin.store.fieldPrice")}
          hint={t("admin.store.fieldPriceHint")}
          required
          requiredLabel={t("common.required")}
          error={fields?.priceMinor}
        />
        <TextField
          id="stock"
          defaultValue={initial?.stock ?? ""}
          name="stock"
          type="number"
          min={0}
          step={1}
          label={t("admin.store.fieldStock")}
          hint={t("admin.store.fieldStockHint")}
          required
          requiredLabel={t("common.required")}
          error={fields?.stock}
        />
      </div>

      <TextField
        id="seoTitle"
        defaultValue={initial?.seoTitle ?? ""}
        name="seoTitle"
        label={t("admin.store.fieldSeoTitle")}
        hint={t("admin.store.fieldSeoTitleHint")}
        error={fields?.seoTitle}
      />

      <TextAreaField
        id="seoDescription"
        defaultValue={initial?.seoDescription ?? ""}
        name="seoDescription"
        label={t("admin.store.fieldSeoDescription")}
        rows={3}
        error={fields?.seoDescription}
      />

      {!editing ? (
        <SelectField
          id="publishState"
          name="publishState"
          label={t("admin.store.fieldPublishState")}
          hint={t("admin.store.fieldPublishStateHint")}
          defaultValue="draft"
        >
          <option value="draft">{t("admin.store.publishStateDraft")}</option>
          <option value="published">
            {t("admin.store.publishStatePublished")}
          </option>
        </SelectField>
      ) : null}

      <Notice tone="info" title={t("admin.store.draftNoticeHeading")}>
        <p>{t("admin.store.draftNoticeBody")}</p>
      </Notice>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending
          ? t("common.loading")
          : editing
            ? t("admin.store.saveChanges")
            : t("admin.store.submit")}
      </Button>
    </form>
  );
}
