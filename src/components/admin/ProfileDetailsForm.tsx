"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextField } from "@/components/ui/Form";
import { updateProfileAction, type ProfileUpdateState } from "@/lib/admin/profile-actions";

/**
 * Account details form.
 *
 * `defaultValue`, not `value`: the fields are uncontrolled so the browser keeps
 * the user's edits, and `useActionState` repopulates them from the action's
 * result only when it succeeds. The email is rendered disabled because changing a
 * sign-in address is an identity operation that belongs to the auth provider, not
 * to this form.
 */
export function ProfileDetailsForm({
  profile,
  labels,
}: {
  profile: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    locale: string | null;
    role: string;
  };
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    null as ProfileUpdateState | null,
  );

  return (
    <section aria-labelledby="details-heading" className="space-y-4">
      <div>
        <h2 id="details-heading" className="text-lg font-semibold text-ink-900">
          {labels.detailsHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.detailsIntro}</p>
      </div>

      <form action={formAction} className="max-w-xl space-y-5">
        {state && !state.ok ? (
          <Notice tone="error">
            {labels[`errors.${state.error}`] ?? labels["errors.update_failed"]}
          </Notice>
        ) : null}
        {state?.ok ? <Notice tone="success">{labels.updated}</Notice> : null}

        <TextField
          id="fullName"
          name="fullName"
          label={labels.nameLabel ?? ""}
          hint={labels.nameHint ?? ""}
          defaultValue={profile.fullName ?? ""}
          autoComplete="name"
        />

        <TextField
          id="emailDisplay"
          name="emailDisplay"
          label={labels.emailLabel ?? ""}
          hint={labels.emailHint ?? ""}
          defaultValue={profile.email ?? ""}
          disabled
          readOnly
        />

        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={labels.phoneLabel ?? ""}
          hint={labels.phoneHint ?? ""}
          defaultValue={profile.phone ?? ""}
          autoComplete="tel"
        />

        <SelectField
          id="locale"
          name="locale"
          label={labels.localeLabel ?? ""}
          defaultValue={profile.locale === "fr" ? "fr" : "en"}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </SelectField>

        <TextField
          id="roleDisplay"
          name="roleDisplay"
          label={labels.roleLabel ?? ""}
          defaultValue={labels[`role.${profile.role}`] ?? profile.role}
          disabled
          readOnly
        />

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
