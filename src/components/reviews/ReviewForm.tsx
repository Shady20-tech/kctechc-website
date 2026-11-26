"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Loading";
import { submitReviewAction, type ReviewSubmitResult } from "@/lib/reviews/actions";
import { StarRatingInput } from "./StarRating";

/**
 * Review submission form.
 *
 * A Client Component only so the action's result renders inline and the fields can
 * show per-field errors. All copy arrives as serializable labels — the translator
 * function cannot cross the Server/Client boundary, so the page resolves the
 * strings and passes them in. `client-boundary.test.ts` enforces that.
 */

export type ReviewFormLabels = {
  ratingLabel: string;
  ratingHint: string;
  nameLabel: string;
  nameHint: string;
  titleLabel: string;
  titleHint: string;
  bodyLabel: string;
  bodyHint: string;
  departmentLabel: string;
  departmentHint: string;
  departmentNone: string;
  consentLabel: string;
  consentHint: string;
  submit: string;
  submitting: string;
  submittedTitle: string;
  submittedBody: string;
  errors: {
    rating: string;
    authorName: string;
    body: string;
    publishConsent: string;
    unauthenticated: string;
    generic: string;
  };
};

export type ReviewFormDepartment = { slug: string; name: string };

/** The form has not been submitted yet. Distinct from every action result. */
type FormState = ReviewSubmitResult | { status: "idle" };

const INITIAL: FormState = { status: "idle" };

/**
 * `submitReviewAction` returns a result object rather than a form state, so the
 * reducer adapts it for `useActionState`. Returning the result unchanged keeps the
 * action itself free of presentation concerns.
 */
async function reduce(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitReviewAction(formData);
}

export function ReviewForm({
  labels,
  departments,
  defaultName,
}: {
  labels: ReviewFormLabels;
  departments: ReviewFormDepartment[];
  defaultName?: string;
}) {
  const [result, formAction, pending] = useActionState(reduce, INITIAL);

  if (result.status === "ok") {
    return (
      <Alert tone="success" title={labels.submittedTitle}>
        {labels.submittedBody}
      </Alert>
    );
  }

  const fields = result.status === "invalid" ? result.fields : {};

  return (
    <form action={formAction} className="space-y-6">
      {result.status === "unauthenticated" ? (
        <Alert tone="error">{labels.errors.unauthenticated}</Alert>
      ) : null}
      {result.status === "error" ? (
        <Alert tone="error">{labels.errors.generic}</Alert>
      ) : null}

      <StarRatingInput name="rating" label={labels.ratingLabel} />
      <p className="-mt-4 text-xs text-muted">{labels.ratingHint}</p>
      {fields.rating ? (
        <p className="-mt-4 text-xs text-red-700">{labels.errors.rating}</p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="authorName"
          name="authorName"
          label={labels.nameLabel}
          hint={labels.nameHint}
          defaultValue={defaultName}
          maxLength={120}
          required
          requiredLabel="*"
          error={fields.authorName ? labels.errors.authorName : undefined}
        />
        <TextField
          id="title"
          name="title"
          label={labels.titleLabel}
          hint={labels.titleHint}
          maxLength={160}
          error={fields.title}
        />
      </div>

      <TextAreaField
        id="body"
        name="body"
        label={labels.bodyLabel}
        hint={labels.bodyHint}
        rows={6}
        required
        requiredLabel="*"
        error={fields.body ? labels.errors.body : undefined}
      />

      {departments.length > 0 ? (
        <SelectField
          id="departmentSlug"
          name="departmentSlug"
          label={labels.departmentLabel}
          hint={labels.departmentHint}
          defaultValue=""
        >
          <option value="">{labels.departmentNone}</option>
          {departments.map((department) => (
            <option key={department.slug} value={department.slug}>
              {department.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div>
        <label className="flex items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            name="publishConsent"
            required
            className="mt-0.5 h-4 w-4 rounded border-border text-teal-700 focus:ring-teal-700"
          />
          <span>{labels.consentLabel}</span>
        </label>
        <p className="mt-1 text-xs text-muted">{labels.consentHint}</p>
        {fields.publishConsent ? (
          <p className="mt-1 text-xs text-red-700">{labels.errors.publishConsent}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> {labels.submitting}
          </>
        ) : (
          labels.submit
        )}
      </Button>
    </form>
  );
}
