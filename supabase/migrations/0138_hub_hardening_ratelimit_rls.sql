-- Review hardening follow-ups.
-- Applied to production via Supabase migration `hub_hardening_ratelimit_rls`.

-- (6) Rate-limit business-leader submissions: cap pending (unpublished) rows per
-- user so a single account can't spam the admin queue.
create or replace function public.limit_leader_submissions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  if new.published = false and new.submitted_by is not null then
    select count(*) into c from public.business_leaders
      where submitted_by = new.submitted_by and published = false;
    if c >= 3 then raise exception 'submission_limit_reached'; end if;
  end if;
  return new;
end $$;
drop trigger if exists business_leaders_limit on public.business_leaders;
create trigger business_leaders_limit before insert on public.business_leaders
  for each row execute function public.limit_leader_submissions();

-- (7) Tools are Pro/dashboard-only now — no anonymous UI path. Drop anon's
-- ability to call the demand-sensing RPC directly (bloat guard).
revoke execute on function public.log_tool_use(text) from anon;

-- (8) Consolidate store_verifications' two overlapping ALL policies into one
-- (removes a multiple-permissive-policies finding; same effective access).
drop policy if exists store_verifications_admin on public.store_verifications;
drop policy if exists store_verifications_manage on public.store_verifications;
create policy store_verifications_manage on public.store_verifications
  for all using (can_manage_store(store_id) or is_super_admin())
  with check (can_manage_store(store_id) or is_super_admin());
