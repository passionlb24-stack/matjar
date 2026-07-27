-- 0175: reschedule_booking — move a booking to a new date/time under the same
-- conflict rules as place_booking. Callers: the store team (any live booking)
-- or the booking's customer (pending only). Managers may deliberately book
-- outside provider hours (they know their floor); customers cannot. Overlap
-- is always enforced by the 0174 exclusion constraints — an UPDATE re-checks
-- them, and a row never conflicts with itself, so moving within the same slot
-- window is safe.

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_date date,
  p_time text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_b record;
  v_is_manager boolean := false;
  v_slot int;
  v_dur int;
  v_buf int;
  v_start timestamptz;
  v_end timestamptz;
  v_cnt int;
  v_cap int;
  v_rules_exist boolean;
  v_ok_window boolean;
  v_store_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  if p_date is null or p_time is null or length(trim(p_time)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_time');
  end if;

  select b.* into v_b from public.bookings b where b.id = p_booking_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_b.status not in ('pending', 'accepted', 'scheduled') then
    return jsonb_build_object('ok', false, 'code', 'not_reschedulable');
  end if;

  v_is_manager := public.can_manage_store(v_b.store_id);
  if not v_is_manager
     and not (v_b.customer_id = v_uid and v_b.status = 'pending') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  -- Duration comes from the service config (it may have changed since the
  -- booking was placed — reschedule uses the current contract), falling back
  -- to the booking's own span, then the store slot.
  select coalesce(p.duration_minutes,
                  (extract(epoch from (v_b.ends_at - v_b.starts_at)) / 60)::int
                    - coalesce(p.buffer_minutes, 0),
                  s.booking_slot_minutes, 30),
         coalesce(p.buffer_minutes, 0),
         coalesce(s.booking_slot_minutes, 30),
         s.name
    into v_dur, v_buf, v_slot, v_store_name
  from public.stores s
  left join public.products p on p.id = v_b.product_id
  where s.id = v_b.store_id;
  if v_dur is null or v_dur <= 0 then v_dur := v_slot; end if;

  v_start := (p_date + p_time::time) at time zone 'Asia/Beirut';
  v_end   := v_start + make_interval(mins => v_dur + v_buf);

  -- Customer moves respect the provider's hours; the merchant may override.
  if not v_is_manager and v_b.doctor_id is not null then
    select exists (select 1 from public.provider_availability_rules r
                   where r.doctor_id = v_b.doctor_id and r.active)
      into v_rules_exist;
    if v_rules_exist then
      select exists (
        select 1 from public.provider_availability_rules r
        where r.doctor_id = v_b.doctor_id and r.active
          and r.weekday = extract(dow from p_date)::int
          and p_time::time >= r.start_time
          and (p_time::time + make_interval(mins => v_dur))::time <= r.end_time
      ) into v_ok_window;
      if not v_ok_window then
        return jsonb_build_object('ok', false, 'code', 'outside_hours');
      end if;
    end if;
    if exists (
      select 1 from public.provider_availability_exceptions x
      where x.doctor_id = v_b.doctor_id and x.on_date = p_date
        and (x.start_time is null
             or (v_start, v_end) overlaps
                ((x.on_date + x.start_time) at time zone 'Asia/Beirut',
                 (x.on_date + x.end_time) at time zone 'Asia/Beirut'))
    ) then
      return jsonb_build_object('ok', false, 'code', 'outside_hours');
    end if;
  end if;

  -- Capacity mode: serialized count at the target slot, excluding this row.
  if v_b.allocation_mode = 'capacity_based' then
    perform pg_advisory_xact_lock(
      hashtext('booking_cap:' || v_b.product_id::text || ':' || v_start::text));
    select coalesce(p.capacity_per_slot, 1) into v_cap
      from public.products p where p.id = v_b.product_id;
    select count(*) into v_cnt
    from public.bookings b
    where b.product_id = v_b.product_id
      and b.id <> p_booking_id
      and b.status in ('pending', 'accepted', 'scheduled')
      and b.starts_at is not null
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_start, v_end);
    if v_cnt >= coalesce(v_cap, 1) then
      return jsonb_build_object('ok', false, 'code', 'capacity_full');
    end if;
  end if;

  begin
    update public.bookings set
      requested_date = p_date,
      requested_time = trim(p_time),
      starts_at = case when allocation_mode is null then starts_at else v_start end,
      ends_at   = case when allocation_mode is null then ends_at   else v_end end
    where id = p_booking_id;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'code', 'slot_taken');
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'slot_taken');
  end;

  -- Tell the other side. Merchant moved it → notify the customer; the
  -- customer moved it → notify the store owner.
  if v_is_manager then
    if v_b.customer_id is not null and v_b.customer_id <> v_uid then
      insert into public.notifications (user_id, type, data)
      values (v_b.customer_id, 'booking_rescheduled',
              jsonb_build_object(
                'booking_id', p_booking_id,
                'store_id', v_b.store_id,
                'store_name', v_store_name,
                'service_name', v_b.service_name,
                'date', p_date, 'time', trim(p_time)));
    end if;
  else
    insert into public.notifications (user_id, type, data)
    select s.owner_id, 'booking_rescheduled_merchant',
           jsonb_build_object(
             'booking_id', p_booking_id,
             'store_id', v_b.store_id,
             'service_name', v_b.service_name,
             'customer_name', v_b.customer_name,
             'date', p_date, 'time', trim(p_time))
    from public.stores s
    where s.id = v_b.store_id and s.owner_id is not null;
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.reschedule_booking(uuid, date, text) from public, anon;
grant execute on function public.reschedule_booking(uuid, date, text) to authenticated;
