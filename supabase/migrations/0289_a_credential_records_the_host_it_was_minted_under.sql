-- MP-014's schema half. The app half (an allow-list for the WebAuthn host, instead
-- of trusting the x-forwarded-host header) already landed in src/lib/webauthn.ts.
--
-- Be precise about what this does and does not buy, because it is easy to oversell:
-- WebAuthn already binds a credential to the relying party it was created for, so
-- a credential minted on a preview host simply fails to verify against the
-- production one. This does not close an authentication hole. What it buys is that
-- such a device becomes IDENTIFIABLE instead of just failing opaquely — an employee
-- whose fingerprint "stopped working" can be told why — and it makes any future
-- rpID change an auditable migration rather than a silent mass invalidation.
--
-- The signature change is the delicate part, and it was tested before applying
-- rather than reasoned about. A plain `create or replace` with an extra parameter
-- does NOT replace the old function: the signature differs, so Postgres keeps both,
-- and a 5-argument call then matches the old exact function AND the new defaulted
-- one — ambiguous, which is an error, on the live employee clock-in path. Hence the
-- explicit drop in the same transaction.
--
-- Verified in a rolled-back transaction against production before applying:
--   * a 5-named-argument call, exactly as the currently DEPLOYED /api/clock/register
--     makes it, still resolves and stores rp_id null;
--   * the 6-argument call stores the host;
--   * exactly one overload remains, so nothing is ambiguous.
-- That ordering matters: the deployed build is the one that has to keep working,
-- and adding a defaulted parameter is safe in a way that removing or retyping one
-- never is.
--
-- The conflict branch coalesces rather than overwrites, so a re-registration from
-- an older client that sends no host does not erase a host already recorded.

alter table public.employee_devices add column if not exists rp_id text;

drop function if exists public.register_employee_device(uuid,text,text,bigint,text);

create or replace function public.register_employee_device(
  p_employee_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_label text default null,
  p_rp_id text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_store uuid; v_id uuid;
begin
  select store_id into v_store from public.store_employees where id = p_employee_id;
  if v_store is null then raise exception 'employee_not_found'; end if;

  insert into public.employee_devices
    (employee_id, store_id, credential_id, public_key, counter, label, rp_id)
  values (p_employee_id, v_store, p_credential_id, p_public_key, p_counter, p_label, p_rp_id)
  on conflict (credential_id) do update
    set employee_id = excluded.employee_id,
        store_id = excluded.store_id,
        public_key = excluded.public_key,
        counter = excluded.counter,
        label = excluded.label,
        rp_id = coalesce(excluded.rp_id, public.employee_devices.rp_id)
  returning id into v_id;

  return v_id;
end
$function$;

revoke all on function public.register_employee_device(uuid,text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.register_employee_device(uuid,text,text,bigint,text,text) to service_role;

-- The two existing devices were enrolled on the live domain; nothing else was
-- reachable when they were created. Stamped rather than left null so the column
-- means "the host this credential is bound to" from day one instead of
-- "unknown, or nobody has re-registered since".
update public.employee_devices set rp_id = 'matjarlb.com' where rp_id is null;
