"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  createProductAction,
  type CreateProductResult,
} from "@/lib/store/admin-actions";

/**
 * Product creation form.
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
 */

const EMPTY: CreateProductResult = { ok: false, error: "" };

export function ProductForm({
  categories,
  departments,
  locale,
}: {
  categories: readonly { id: string; name: string; departmentSlug: string }[];
  departments: readonly { slug: string; name: string }[];
  locale: Locale;
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    async (_previous: CreateProductResult, formData: FormData) =>
      createProductAction(formData),
    EMPTY,
  );

  // A single department has nothing to choose, so it is preselected and the
  // category list is already narrow. With more than one, the category options
  // are filtered to the chosen department as a UI convenience; the action
  // re-reads the category's department regardless, so the filter is not a control.
  const onlyDepartment = departments.length === 1 ? departments[0]!.slug : "";
  const [department, setDepartment] = useState(onlyDepartment);
  const visibleCategories = department
    ? categories.filter((category) => category.departmentSlug === department)
    : categories;

  const fields = state.ok ? undefined : state.fields;
  const errorCode = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.ok ? (
        <Notice tone="success" title={t("admin.store.createdHeading")}>
          <p>{t("admin.store.createdBody")}</p>
          <p className="mt-1">
            {t("admin.store.translationCount", {
              count: state.translationKeyCount,
            })}
          </p>
          <p className="mt-1">
            {t("admin.store.syncQueued", { count: state.syncQueued })}
          </p>
          {state.syncWarning ? (
            <p className="mt-2">
              {t("admin.store.syncWarning", { reason: state.syncWarning })}
            </p>
          ) : null}
          {state.seoWarning ? (
            <p className="mt-2">{t("admin.store.seoWarning")}</p>
          ) : null}
        </Notice>
      ) : null}

      {errorCode && errorCode !== "invalid" ? (
        <Notice tone="warning" title={t("admin.store.errorHeading")}>
          <p>{t(`admin.store.errors.${errorCode}`)}</p>
        </Notice>
      ) : null}

      {errorCode === "invalid" ? (
        <Notice tone="warning" title={t("admin.store.errorHeading")}>
          <p>{t("admin.store.errors.invalid")}</p>
        </Notice>
      ) : null}

      <TextField
        id="title"
        name="title"
        label={t("admin.store.fieldTitle")}
        hint={t("admin.store.fieldTitleHint")}
        required
        requiredLabel={t("common.required")}
        error={fields?.title}
      />

      <TextField
        id="slug"
        name="slug"
        label={t("admin.store.fieldSlug")}
        hint={t("admin.store.fieldSlugHint")}
        required
        requiredLabel={t("common.required")}
        error={fields?.slug}
      />

      <TextField
        id="sku"
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
        name="categoryId"
        label={t("admin.store.fieldCategory")}
        required
        requiredLabel={t("common.required")}
        error={fields?.categoryId}
        defaultValue=""
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

      <TextAreaField
        id="shortDescription"
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
          name="brand"
          label={t("admin.store.fieldBrand")}
          error={fields?.brand}
        />
        <TextField
          id="gtin"
          name="gtin"
          label={t("admin.store.fieldGtin")}
          hint={t("admin.store.fieldGtinHint")}
          inputMode="numeric"
          error={fields?.gtin}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="priceMinor"
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
        name="seoTitle"
        label={t("admin.store.fieldSeoTitle")}
        hint={t("admin.store.fieldSeoTitleHint")}
        error={fields?.seoTitle}
      />

      <TextAreaField
        id="seoDescription"
        name="seoDescription"
        label={t("admin.store.fieldSeoDescription")}
        rows={3}
        error={fields?.seoDescription}
      />

      <Notice tone="info" title={t("admin.store.draftNoticeHeading")}>
        <p>{t("admin.store.draftNoticeBody")}</p>
      </Notice>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t("common.loading") : t("admin.store.submit")}
      </Button>
    </form>
  );
}
