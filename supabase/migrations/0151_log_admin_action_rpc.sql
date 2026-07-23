-- Universal admin audit logging. The audit trail was near-empty (only store
-- status/plan changes via a trigger). This RPC lets every admin mutation record
-- itself. SECURITY DEFINER so it can insert into audit_logs (no insert policy
-- exists) while staying admin-guarded; fire-and-forget from the client so it can
-- never break the underlying action.
create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Never an attack surface: non-admins are silently ignored, not errored.
  if not public.is_platform_admin() then
    return;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id,
          coalesce(p_metadata, '{}'::jsonb));
end; $$;

revoke execute on function public.log_admin_action(text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, uuid, jsonb) to authenticated;

-- Let audit-permitted sub-admins (not just super) read the log.
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (public.admin_can('audit'));
