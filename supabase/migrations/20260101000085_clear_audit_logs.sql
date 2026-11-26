-- =============================================================================
-- Super-admin clear for the system log.
--
-- The audit trail is append-only for every ordinary writer. A super
-- administrator may clear it from `/admin/logs`, and that is a deliberate,
-- narrow exception: the Server Action uses the cookie-bound client, so this
-- DELETE policy is the control. The action then writes one new audit row
-- (`audit_logs_cleared`) through the service-role client, so clearing the trail
-- is itself recorded rather than silent.
--
-- `authenticated` needs an explicit DELETE grant: the select policy is not a
-- table privilege, and a policy alone does not make `delete` reachable. A lesser
-- role may attempt the statement and is refused by the policy.
-- =============================================================================

drop policy if exists "audit_logs_delete_super_admin" on public.audit_logs;

create policy "audit_logs_delete_super_admin"
  on public.audit_logs for delete
  to authenticated
  using (public.is_super_admin());

grant delete on public.audit_logs to authenticated;

comment on table public.audit_logs is
  'Audit trail for privileged operations. Append-only for ordinary writers; a super administrator may clear it from the system-log console, and the clear itself is recorded as a new row.';
