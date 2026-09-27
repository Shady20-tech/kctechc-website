"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField } from "@/components/ui/Form";
import { updateInquiryAction, type CrmUpdateState } from "@/lib/crm/actions";

/**
 * Enquiry update form.
 *
 * One form for the four things a staff member changes on an enquiry, submitted
 * together. A per-field save would produce a burst of writes and a timeline full
 * of single-property events; one save produces one coherent event.
 */
export function InquiryUpdateForm({
  id,
  current,
  assignees,
  labels,
}: {
  id: string;
  current: {
    status: string;
    priority: string;
    inquiryType: string;
    assignedTo: string | null;
  };
  assignees: readonly { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    updateInquiryAction,
    null as CrmUpdateState | null,
  );

  return (
    <section aria-labelledby="update-heading" className="space-y-4">
      <div>
        <h2 id="update-heading" className="text-lg font-semibold text-ink-900">
          {labels.updateHeading ?? ""}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.updateIntro ?? ""}</p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={id} />

        {state && !state.ok ? (
          <Notice tone="error">{labels[`errors.${state.error}`] ?? labels["errors.update_failed"] ?? ""}</Notice>
        ) : null}
        {state?.ok ? (
          <Notice tone="success">
            {state.message === "no_change" ? (labels.noChange ?? "") : (labels.applied ?? "")}
          </Notice>
        ) : null}

        <SelectField id="status" name="status" label={labels.statusLabel ?? ""} defaultValue={current.status}>
          {["new", "assigned", "in_progress", "responded", "closed", "spam"].map((value) => (
            <option key={value} value={value}>
              {labels[`status.${value}`] ?? value}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="priority"
          name="priority"
          label={labels.priorityLabel ?? ""}
          defaultValue={current.priority}
        >
          {["low", "normal", "high", "urgent"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="type"
          name="type"
          label={labels.typeLabel ?? ""}
          defaultValue={current.inquiryType}
        >
          {["general", "quote", "property", "viewing", "service", "support"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="assignedTo"
          name="assignedTo"
          label={labels.assignLabel ?? ""}
          defaultValue={current.assignedTo ?? ""}
        >
          <option value="">{labels.assignUnassigned ?? ""}</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          id="note"
          name="note"
          label={labels.noteLabel ?? ""}
          hint={labels.noteHint ?? ""}
          rows={3}
        />

        <SubmitButton label={labels.applyUpdate ?? ""} />
      </form>
    </section>
  );
}

function SubmitButton({ label }: { label: string | undefined }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "…" : label}
    </Button>
  );
}
