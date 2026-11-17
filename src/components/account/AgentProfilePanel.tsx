"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  updateAgentProfileAction,
  type DashboardSimpleResult,
} from "@/lib/real-estate/dashboard-actions";
import type { DashboardAgentProfile } from "@/lib/real-estate/dashboard-loaders";
import type { RegionOption } from "@/lib/real-estate/membership-loaders";

const EMPTY: DashboardSimpleResult | null = null;

/**
 * The agent's own public profile.
 *
 * The record is what buyers see beside the listings the agent manages, so the
 * fields are the public ones only. `is_active` is deliberately not editable:
 * deactivating an agent is a staff decision, and the update policy would not stop
 * the account from setting it back.
 *
 * A missing record is not an error state the agent can fix — creating an agent is
 * what grants listing access, so it stays an administrative act. The panel says so
 * and points at the business contact rather than rendering a form whose save would
 * silently match no row.
 */
export function AgentProfilePanel({
  locale,
  profile,
  regions,
}: {
  locale: Locale;
  profile: DashboardAgentProfile | null;
  regions: readonly RegionOption[];
}) {
  const t = createTranslator(locale).t;
  const base = "account.dashboards.agent";

  if (!profile) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink-900">
          {t(`${base}.profileHeading`)}
        </h2>
        <div className="mt-4">
          <Notice tone="warning">{t(`${base}.profileMissing`)}</Notice>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink-900">
        {t(`${base}.profileHeading`)}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-body">
        {t(`${base}.profileIntro`)}
      </p>
      <ProfileForm locale={locale} profile={profile} regions={regions} />
    </Card>
  );
}

function ProfileForm({
  locale,
  profile,
  regions,
}: {
  locale: Locale;
  profile: DashboardAgentProfile;
  regions: readonly RegionOption[];
}) {
  const t = createTranslator(locale).t;
  const base = "account.dashboards.agent";

  const [state, formAction] = useActionState(
    async (_previous: DashboardSimpleResult | null, formData: FormData) =>
      updateAgentProfileAction(formData),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {state && !state.ok ? (
        <Notice tone="warning">{t(`errors.${state.error}`)}</Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{t(`${base}.profileSaved`)}</Notice>
      ) : null}

      <TextField
        id="displayName"
        name="displayName"
        label={t(`${base}.profileDisplayName`)}
        defaultValue={profile.displayName}
        required
      />

      <TextField
        id="title"
        name="title"
        label={t(`${base}.profileTitle`)}
        hint={t(`${base}.profileTitleHint`)}
        defaultValue={profile.title ?? ""}
      />

      <TextAreaField
        id="bio"
        name="bio"
        label={t(`${base}.profileBio`)}
        rows={5}
        defaultValue={profile.bio ?? ""}
      />

      <TextField
        id="publicPhone"
        name="publicPhone"
        label={t(`${base}.profilePublicPhone`)}
        defaultValue={profile.publicPhone ?? ""}
      />

      <TextField
        id="licenseNumber"
        name="licenseNumber"
        label={t(`${base}.profileLicense`)}
        defaultValue={profile.licenseNumber ?? ""}
      />

      <SelectField
        id="regionId"
        name="regionId"
        label={t(`${base}.profileRegion`)}
        defaultValue={profile.regionId ?? ""}
      >
        <option value="">—</option>
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        id="serviceAreas"
        name="serviceAreas"
        label={t(`${base}.profileServiceAreas`)}
        hint={t(`${base}.profileServiceAreasHint`)}
        rows={4}
        defaultValue={profile.serviceAreas.join("\n")}
      />

      <SaveButton
        label={t(`${base}.profileSave`)}
        pendingLabel={t(`${base}.profileSaving`)}
      />
    </form>
  );
}

function SaveButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
