"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { ContentState } from "@/lib/content/admin-actions";

/**
 * Article editor form.
 *
 * Uncontrolled fields with `defaultValue`, so the browser keeps what the user
 * typed and the action's result repopulates only on a save. The publish-state
 * select drives which fields the browser marks required via `required`, and the
 * action re-checks the same rule on the server because `required` is a courtesy.
 *
 * The action is passed in rather than imported, so this one component serves both
 * create and edit without a mode flag — the page decides which Server Action to
 * bind.
 */
export function InsightForm({
  action,
  id,
  initial,
  options,
  labels,
}: {
  action: (formData: FormData) => Promise<ContentState>;
  /** Present on the edit page; omitted when creating. */
  id?: string;
  initial?: {
    slug: string;
    title: string;
    summary: string;
    body: string;
    categoryId: string | null;
    departmentId: string | null;
    authorId: string | null;
    isFeatured: boolean;
    publishState: string;
  };
  options: {
    categories: readonly { id: string; label: string }[];
    departments: readonly { id: string; label: string }[];
    authors: readonly { id: string; label: string }[];
  };
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ContentState | null, formData: FormData) => action(formData),
    null as ContentState | null,
  );

  const fieldError = (name: string) =>
    state && !state.ok && state.fields?.[name] ? (
      <p className="mt-1 text-sm text-danger">{state.fields[name]}</p>
    ) : null;

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"] ?? ""}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">
          {state.message === "created" ? labels.created : labels.updated}
        </Notice>
      ) : null}

      <div>
        <TextField
          id="title"
          name="title"
          label={labels.titleLabel ?? ""}
          defaultValue={initial?.title ?? ""}
          required
        />
        {fieldError("title")}
      </div>

      <div>
        <TextField
          id="slug"
          name="slug"
          label={labels.slugLabel ?? ""}
          hint={labels.slugHint ?? ""}
          defaultValue={initial?.slug ?? ""}
          required
        />
        {fieldError("slug")}
      </div>

      <div>
        <TextAreaField
          id="summary"
          name="summary"
          label={labels.summaryLabel ?? ""}
          hint={labels.summaryHint ?? ""}
          defaultValue={initial?.summary ?? ""}
          rows={3}
          required
        />
        {fieldError("summary")}
      </div>

      <div>
        <TextAreaField
          id="body"
          name="body"
          label={labels.bodyLabel ?? ""}
          defaultValue={initial?.body ?? ""}
          rows={14}
          required
        />
        {fieldError("body")}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <SelectField
          id="categoryId"
          name="categoryId"
          label={labels.categoryLabel ?? ""}
          defaultValue={initial?.categoryId ?? ""}
        >
          <option value="">—</option>
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="departmentId"
          name="departmentId"
          label={labels.departmentLabel ?? ""}
          defaultValue={initial?.departmentId ?? ""}
        >
          <option value="">—</option>
          {options.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </SelectField>

        <div>
          <SelectField
            id="authorId"
            name="authorId"
            label={labels.authorLabel ?? ""}
            defaultValue={initial?.authorId ?? ""}
          >
            <option value="">—</option>
            {options.authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </SelectField>
          {fieldError("authorId")}
        </div>
      </div>

      <SelectField
        id="publishState"
        name="publishState"
        label={labels.stateLabel ?? ""}
        defaultValue={initial?.publishState ?? "draft"}
      >
        <option value="draft">{labels["state.draft"] ?? "Draft"}</option>
        <option value="published">{labels["state.published"] ?? "Published"}</option>
        <option value="archived">{labels["state.archived"] ?? "Archived"}</option>
      </SelectField>

      <label className="flex items-center gap-3 text-sm text-body">
        <input
          type="checkbox"
          name="isFeatured"
          defaultChecked={initial?.isFeatured ?? false}
          className="h-4 w-4 rounded border-border-strong"
        />
        {labels.featuredLabel ?? ""}
      </label>

      <SubmitButton label={labels.save} pendingLabel={labels.saving} />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
