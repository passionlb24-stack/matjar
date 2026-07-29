-- 0196: Emergency hardening from the reliability/scalability audit (2026-07-29).
-- Additive/corrective only; no table drops. Closes 4 findings:
--   MJ-A01  store_verifications public read leaked unverified/rejected docs + enabled a fake "verified" badge
--   MJ-R01  membership/enrollment double-renew race (no unique constraint; TOCTOU)
--   MJ-R04  coupon over-redemption race (used_count bumped unconditionally)
--   MJ-R02/R03  anonymous stay/ticket RPCs had no rate limit
-- (MJ-A02 get_push_subs is intentionally NOT changed here — the push hook route
--  calls it as `anon`, so revoking that grant would break push; it requires a
--  service-role client + SUPABASE_SERVICE_ROLE_KEY env, tracked separately.)

-- ── MJ-A01: verifications public read → verified rows only ───────────────────
drop policy if exists store_verifications_public_read on public.store_verifications;
create policy store_verifications_public_read on public.store_verifications for select
  using (status = 'verified');
-- Owners/admins keep full access (incl. submitted/rejected + doc_url/number) via
-- the existing store_verifications_manage policy. Anonymous visitors now see only
-- verified rows, so a submitted/rejected row can never masquerade as a badge.

-- ── MJ-R01: uniqueness for active memberships / enrollments ──────────────────
-- (verified 0 existing duplicates before creating these)
create unique index if not exists store_memberships_active_uniq
  on public.store_memberships (plan_id, customer_id) where status = 'active';
create unique index if not exists course_enrollments_active_uniq
  on public.course_enrollments (course_id, customer_id) where status = 'enrolled';

-- Make the RPCs race-safe: the exists() fast-path stays for the common case, and
-- the INSERT now catches the unique_violation a concurrent caller would trigger.
create or replace function public.subscribe_membership(p_plan_id uuid, p_name text, p_phone text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_id uuid; v_store uuid; v_owner uuid; v_store_name text;
  v_period text; v_plan_name text; v_ends date;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login_required'; end if;
  select p.store_id, p.period, p.name into v_store, v_period, v_plan_name
    from public.store_membership_plans p where p.id = p_plan_id and p.active;
  if v_store is null then raise exception 'plan_not_found'; end if;

  if exists (select 1 from public.store_memberships
             where plan_id = p_plan_id and customer_id = v_uid and status = 'active') then
    raise exception 'already_subscribed';
  end if;

  v_ends := case v_period
    when 'monthly'   then current_date + interval '1 month'
    when 'quarterly' then current_date + interval '3 months'
    when 'yearly'    then current_date + interval '1 year'
    else null end;

  begin
    insert into public.store_memberships (store_id, plan_id, customer_id, customer_name, phone, ends_on)
    values (v_store, p_plan_id, v_uid, nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_phone,'')),''), v_ends)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_subscribed';
  end;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'membership_new', jsonb_build_object(
    'membership_id', v_id, 'store_id', v_store, 'store_name', v_store_name, 'plan_name', v_plan_name));
  return v_id;
end; $function$;

create or replace function public.enroll_course(p_course_id uuid, p_name text, p_phone text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_id uuid; v_store uuid; v_owner uuid; v_store_name text; v_course_name text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login_required'; end if;
  select c.store_id, c.name into v_store, v_course_name
    from public.store_courses c where c.id = p_course_id and c.active;
  if v_store is null then raise exception 'course_not_found'; end if;

  if exists (select 1 from public.course_enrollments
             where course_id = p_course_id and customer_id = v_uid and status = 'enrolled') then
    raise exception 'already_enrolled';
  end if;

  begin
    insert into public.course_enrollments (store_id, course_id, customer_id, customer_name, phone)
    values (v_store, p_course_id, v_uid, nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_phone,'')),''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_enrolled';
  end;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'enroll_new', jsonb_build_object(
    'enrollment_id', v_id, 'store_id', v_store, 'store_name', v_store_name, 'course_name', v_course_name));
  return v_id;
end; $function$;

-- ── MJ-R04: coupon increment is now atomic + rejects over-redemption ─────────
create or replace function public.bump_coupon_use()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.coupon_code is not null and new.coupon_code <> '' then
    update public.coupons
      set used_count = used_count + 1, updated_at = now()
      where store_id = new.store_id and code = new.coupon_code
        and (max_uses is null or used_count < max_uses);
    if not found then
      -- Either the coupon doesn't exist (stale code — ignore) or it's used up.
      if exists (select 1 from public.coupons
                 where store_id = new.store_id and code = new.coupon_code) then
        raise exception 'coupon_used_up';
      end if;
    end if;
  end if;
  return new;
end; $function$;

-- ── MJ-R02/R03: rate-limit anonymous stay + ticket writes (mirror create_lead) ──
create or replace function public.place_stay_booking(p_unit_id uuid, p_check_in date, p_check_out date, p_adults integer, p_children integer, p_name text, p_phone text, p_notes text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_unit public.accommodation_units;
  v_id uuid; v_owner uuid; v_store_name text;
  v_nights int; v_base numeric;
  v_uid uuid := auth.uid();
begin
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_phone),'')='' then
    raise exception 'missing_fields';
  end if;
  if p_check_out <= p_check_in or p_check_in < current_date then
    raise exception 'invalid_range';
  end if;
  -- Abuse guard: cap unpaid stay requests per phone/hour so an anonymous caller
  -- cannot blanket-block inventory via the overlap-exclusion constraint.
  if (select count(*) from public.stay_bookings
      where phone = trim(p_phone) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;
  select * into v_unit from public.accommodation_units where id = p_unit_id and active;
  if v_unit.id is null then raise exception 'unit_not_found'; end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < v_unit.min_nights then raise exception 'min_stay'; end if;
  if greatest(coalesce(p_adults,1),1) + greatest(coalesce(p_children,0),0) > v_unit.max_guests then
    raise exception 'over_capacity';
  end if;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_unit.store_id;
  v_base := public.stay_base_total(v_unit, p_check_in, p_check_out);

  begin
    insert into public.stay_bookings (
      store_id, unit_id, customer_id, guest_name, phone, check_in, check_out,
      nights, adults, children, base_total, cleaning_fee, deposit_amount,
      grand_total, notes)
    values (
      v_unit.store_id, p_unit_id, v_uid, trim(p_name), trim(p_phone),
      p_check_in, p_check_out, v_nights,
      greatest(coalesce(p_adults,1),1), greatest(coalesce(p_children,0),0),
      v_base, v_unit.cleaning_fee, v_unit.security_deposit,
      v_base + v_unit.cleaning_fee, nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'dates_taken';
  end;

  insert into public.notifications (user_id, type, data)
  values (v_owner, 'stay_new', jsonb_build_object(
    'stay_id', v_id, 'store_id', v_unit.store_id, 'store_name', v_store_name,
    'unit_name', v_unit.name, 'check_in', p_check_in, 'check_out', p_check_out));

  return v_id;
end; $function$;

create or replace function public.buy_tickets(
  p_type_id uuid, p_quantity int, p_name text, p_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_store uuid; v_type_name text; v_owner uuid; v_store_name text;
  v_qty int := greatest(coalesce(p_quantity, 1), 1);
  v_uid uuid := auth.uid();
  v_cap int; v_updated uuid;
begin
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_phone),'')='' then
    raise exception 'missing_fields';
  end if;
  -- Abuse guard: cap ticket purchases per phone/hour so an anonymous caller
  -- cannot exhaust capacity by holding 'reserved' rows.
  if (select count(*) from public.event_tickets
      where phone = trim(p_phone) and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;

  select store_id, name, capacity into v_store, v_type_name, v_cap
    from public.event_ticket_types where id = p_type_id and active;
  if v_store is null then raise exception 'type_not_found'; end if;

  if v_cap is null then
    update public.event_ticket_types set sold = sold + v_qty, updated_at = now()
      where id = p_type_id returning id into v_updated;
  else
    update public.event_ticket_types set sold = sold + v_qty, updated_at = now()
      where id = p_type_id and sold + v_qty <= capacity returning id into v_updated;
    if v_updated is null then raise exception 'sold_out'; end if;
  end if;

  insert into public.event_tickets (store_id, ticket_type_id, customer_id, attendee_name, phone, quantity)
  values (v_store, p_type_id, v_uid, trim(p_name), trim(p_phone), v_qty)
  returning id into v_id;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'ticket_new', jsonb_build_object(
    'ticket_id', v_id, 'store_id', v_store, 'store_name', v_store_name,
    'type_name', v_type_name, 'quantity', v_qty));

  return v_id;
end; $$;
