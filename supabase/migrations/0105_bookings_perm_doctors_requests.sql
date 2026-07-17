-- Authz fix: the Doctors roster and Service-Requests workflow both belong to the
-- `bookings` staff permission (see sectors.ts + the OS-home tile gating), but
-- their write authorization only checked can_manage_store — true for ANY staff.
-- So a cashier granted orders+products but denied bookings could still navigate
-- to /doctors or /requests and add/edit/delete doctors or quote/complete/decline
-- jobs. Re-point both at public.staff_can(store_id,'bookings') — the same helper
-- the bookings table policies use (0024) — which already covers the owner path;
-- keep the super_admin path for the admin panel.

-- 1) Doctors write policies: require the 'bookings' permission (or super admin).
--    SELECT is left untouched (public storefront reads active stores' rosters).
drop policy doctors_insert on public.doctors;
create policy doctors_insert on public.doctors
  for insert to authenticated with check (
    public.staff_can(store_id, 'bookings') or public.is_super_admin()
  );
drop policy doctors_update on public.doctors;
create policy doctors_update on public.doctors
  for update to authenticated using (
    public.staff_can(store_id, 'bookings') or public.is_super_admin()
  ) with check (
    public.staff_can(store_id, 'bookings') or public.is_super_admin()
  );
drop policy doctors_delete on public.doctors;
create policy doctors_delete on public.doctors
  for delete to authenticated using (
    public.staff_can(store_id, 'bookings') or public.is_super_admin()
  );

-- 2) Service-request lifecycle: authorize providers via the 'bookings' permission
--    instead of can_manage_store. Everything else (status-transition guards,
--    customer paths, params, security definer, search_path) is preserved verbatim.
create or replace function public.manage_service_request(
  p_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid;
  v_customer uuid;
  v_status public.service_request_status;
  v_is_provider boolean;
  v_is_customer boolean;
begin
  select store_id, customer_id, status
  into v_store_id, v_customer, v_status
  from public.service_requests where id = p_id;
  if v_store_id is null then raise exception 'not_found'; end if;

  v_is_provider := public.staff_can(v_store_id, 'bookings') or public.is_super_admin();
  v_is_customer := v_customer is not null and v_customer = auth.uid();
  if not (v_is_provider or v_is_customer) then
    raise exception 'not_authorized';
  end if;

  if p_action = 'quote' and v_is_provider then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    update public.service_requests
      set status = 'quoted', quote_amount = p_amount,
          quote_note = nullif(trim(p_note), '')
      where id = p_id and status in ('pending', 'quoted');
  elsif p_action = 'decline' and v_is_provider then
    update public.service_requests set status = 'declined'
      where id = p_id and status in ('pending', 'quoted', 'accepted', 'in_progress');
  elsif p_action = 'start' and v_is_provider then
    update public.service_requests set status = 'in_progress'
      where id = p_id and status = 'accepted';
  elsif p_action = 'complete' and v_is_provider then
    update public.service_requests set status = 'completed'
      where id = p_id and status in ('accepted', 'in_progress');
  elsif p_action = 'accept' and v_is_customer then
    update public.service_requests set status = 'accepted'
      where id = p_id and status = 'quoted';
  elsif p_action = 'cancel' and v_is_customer then
    update public.service_requests set status = 'cancelled'
      where id = p_id and status in ('pending', 'quoted', 'accepted');
  else
    raise exception 'bad_action';
  end if;
end; $$;

revoke execute on function
  public.manage_service_request(uuid, text, numeric, text) from public, anon;
grant execute on function
  public.manage_service_request(uuid, text, numeric, text) to authenticated;
