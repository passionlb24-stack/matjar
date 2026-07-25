-- Hardening for transfer_store_ownership (0169), from live adversarial testing:
--
-- 1) NULL-propagation hole in the owner guard: with auth.uid() = null,
--    `not (v_owner = auth.uid() or is_super_admin())` evaluates to NULL, so the
--    IF fell through and the transfer ran. Unreachable in practice (EXECUTE is
--    revoked from anon; authenticated always has a uid) — but a guard must not
--    depend on grants. Rewritten null-safe with IS DISTINCT FROM.
--
-- 2) The customer→merchant promotion was silently reverted by the 0004
--    prevent_role_change trigger (any role change by a signed-in non-admin is
--    undone). The trigger now honors a transaction-local escape hatch
--    (app.allow_role_change) that only trusted SECURITY DEFINER code sets —
--    users still cannot self-escalate through PostgREST.

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    -- Trusted definer-side flows (ownership transfer) opt in for the current
    -- transaction only; missing setting → NULL → coalesce keeps the guard on.
    if coalesce(current_setting('app.allow_role_change', true), '') = '1' then
      return new;
    end if;
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.transfer_store_ownership(
  p_store_id uuid,
  p_email text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_target uuid;
  v_store_name text;
begin
  select owner_id, name into v_owner, v_store_name
    from public.stores where id = p_store_id;
  if v_owner is null then return 'not_found_store'; end if;

  -- Owner-only, null-safe: a missing auth.uid() must REFUSE, never fall through.
  if v_owner is distinct from auth.uid()
     and not coalesce(public.is_super_admin(), false) then
    return 'not_owner';
  end if;

  select id into v_target from auth.users
    where lower(email) = lower(btrim(p_email)) limit 1;
  if v_target is null then return 'not_found'; end if;
  if v_target = v_owner then return 'self'; end if;

  update public.stores set owner_id = v_target where id = p_store_id;

  delete from public.store_staff
    where store_id = p_store_id and user_id = v_target;

  -- Owning a store makes you a merchant. Opt out of the role-escalation guard
  -- for this transaction only (see prevent_role_change above).
  perform set_config('app.allow_role_change', '1', true);
  update public.profiles set role = 'merchant'
    where id = v_target and role = 'customer';
  perform set_config('app.allow_role_change', '0', true);

  insert into public.notifications (user_id, type, data)
  values (v_target, 'store_transferred',
          jsonb_build_object('store_id', p_store_id, 'store_name', v_store_name));

  return 'ok';
end $$;

revoke execute on function public.transfer_store_ownership(uuid, text) from public, anon;
grant execute on function public.transfer_store_ownership(uuid, text) to authenticated;
