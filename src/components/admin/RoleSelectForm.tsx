"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/Form";
import { ASSIGNABLE_ROLES } from "@/lib/auth/role-assignment";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  changeUserRoleAction,
  type RoleChangeState,
} from "@/lib/admin/role-actions";

const INITIAL: RoleChangeState | null = null;

/**
 * Change one account's role.
 *
 * The select offers every assignable role rather than only the "plausible" ones
 * for the current value. Narrowing the list here would put the promotion rules in
 * the browser, where they are advice rather than a control; the action validates
 * against the same list on the server and RLS refuses anything else.
 *
 * `defaultValue` is only read on mount, and no `key` is set, so after a
 * successful change the select keeps the value the user submitted — which is the
 * role that was written, so the control and the badge beside it agree without a
 * remount. A remount would discard the `useActionState` result and the
 * confirmation would never be seen.
 */
export function RoleSelectForm({
  profileId,
  currentRole,
  isSelf,
  locale,
}: {
  profileId: string;
  currentRole: string;
  isSelf: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    changeUserRoleAction,
    INITIAL,
  );

  if (isSelf) {
    return <p className="text-xs text-muted">{t("adminUsers.selfNote")}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profileId" value={profileId} />

      <SelectField
        id={`role-${profileId}`}
        name="role"
        label={t("adminUsers.changeRoleLabel")}
        defaultValue={currentRole}
        className="min-w-44"
      >
        {ASSIGNABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {t(`roleName.${role}`)}
          </option>
        ))}
      </SelectField>

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? t("adminUsers.savingRole") : t("adminUsers.saveRole")}
      </Button>

      {state && !state.ok ? (
        <Notice tone="warning" title={t("adminUsers.roleErrorHeading")}>
          <p>{t(`adminUsers.roleErrors.${state.error}`)}</p>
        </Notice>
      ) : null}

      {state?.ok ? (
        <Notice tone="success" title={t("adminUsers.roleUpdated")} />
      ) : null}
    </form>
  );
}
