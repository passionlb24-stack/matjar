-- Section 10 — audit logs for sensitive operations.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_super_admin());

create or replace function public.log_store_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'store_status_changed', 'store', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.plan is distinct from old.plan then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'store_plan_changed', 'store', new.id,
            jsonb_build_object('from', old.plan, 'to', new.plan));
  end if;
  return new;
end; $$;
create trigger stores_audit_log
  after update on public.stores
  for each row execute function public.log_store_change();

revoke execute on function public.log_store_change() from public, anon, authenticated;
