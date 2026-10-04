"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { ProjectState } from "@/lib/content/project-admin-actions";

/**
 * Completed-work editor.
 *
 * The department select is only rendered when the caller may author more than one
 * department (a super admin or cross-department staff). For a department editor it
 * is a fixed hidden field, because offering a choice the database would refuse
 * would be a control that lies.
 *
 * The action is passed in, so one component serves create and edit without a mode
 * flag — the page decides which Server Action to bind.
 */
export function ProjectForm({
  action,
  id,
  departments,
  services,
  initial,
  labels,
}: {
  action: (formData: FormData) => Promise<ProjectState>;
  /** Present on the edit page; omitted when creating. */
  id?: string;
  departments: readonly { id: string; slug: string; label: string }[];
  services: readonly { id: string; label: string }[];
  initial?: {
    slug: string;
    title: string;
    summary: string;
    description: string | null;
    scope: string | null;
    outcome: string | null;
    departmentId: string;
    location: string | null;
    propertyType: string | null;
    completedYear: number | null;
    publishState: string;
    serviceIds: string[];
  };
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ProjectState | null, formData: FormData) => action(formData),
    null as ProjectState | null,
  );

  const fieldError = (name: string) =>
    state && !state.ok && state.fields?.[name] ? (
      <p className="mt-1 text-sm text-danger">{state.fields[name]}</p>
    ) : null;

  const singleDepartment =
    departments.length === 1 ? departments[0] : undefined;
  const defaultDepartment = initial?.departmentId ?? singleDepartment?.id ?? "";
  const selectedServices = new Set(initial?.serviceIds ?? []);

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ??
            labels["errors.write_failed"] ??
            ""}
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
          id="description"
          name="description"
          label={labels.descriptionLabel ?? ""}
          defaultValue={initial?.description ?? ""}
          rows={8}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <TextAreaField
            id="scope"
            name="scope"
            label={labels.scopeLabel ?? ""}
            defaultValue={initial?.scope ?? ""}
            rows={3}
          />
        </div>
        <div>
          <TextAreaField
            id="outcome"
            name="outcome"
            label={labels.outcomeLabel ?? ""}
            defaultValue={initial?.outcome ?? ""}
            rows={3}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {singleDepartment ? (
          <input
            type="hidden"
            name="departmentId"
            value={singleDepartment.id}
          />
        ) : (
          <SelectField
            id="departmentId"
            name="departmentId"
            label={labels.departmentLabel ?? ""}
            defaultValue={defaultDepartment}
            required
          >
            <option value="">—</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.label}
              </option>
            ))}
          </SelectField>
        )}

        <SelectField
          id="propertyType"
          name="propertyType"
          label={labels.propertyTypeLabel ?? ""}
          defaultValue={initial?.propertyType ?? ""}
        >
          <option value="">—</option>
          <option value="residential">
            {labels["propertyType.residential"]}
          </option>
          <option value="commercial">
            {labels["propertyType.commercial"]}
          </option>
          <option value="industrial">
            {labels["propertyType.industrial"]}
          </option>
        </SelectField>

        <div>
          <TextField
            id="completedYear"
            name="completedYear"
            type="number"
            label={labels.completedYearLabel ?? ""}
            defaultValue={initial?.completedYear?.toString() ?? ""}
          />
          {fieldError("completedYear")}
        </div>
      </div>

      <div>
        <TextField
          id="location"
          name="location"
          label={labels.locationLabel ?? ""}
          hint={labels.locationHint ?? ""}
          defaultValue={initial?.location ?? ""}
        />
      </div>

      <fieldset className="rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-ink-900">
          {labels.servicesLabel ?? ""}
        </legend>
        {services.length === 0 ? (
          <p className="text-sm text-muted">{labels.servicesEmpty ?? ""}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex items-center gap-3 text-sm text-body"
              >
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  defaultChecked={selectedServices.has(service.id)}
                  className="h-4 w-4 rounded border-border-strong"
                />
                {service.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <SelectField
        id="publishState"
        name="publishState"
        label={labels.stateLabel ?? ""}
        defaultValue={initial?.publishState ?? "draft"}
      >
        <option value="draft">{labels["state.draft"] ?? "Draft"}</option>
        <option value="published">
          {labels["state.published"] ?? "Published"}
        </option>
        <option value="archived">
          {labels["state.archived"] ?? "Archived"}
        </option>
      </SelectField>

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
