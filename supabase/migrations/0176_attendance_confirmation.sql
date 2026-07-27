-- 0176: attendance confirmation — after the merchant accepts/schedules a
-- booking, the customer can confirm they're coming. A confirmed booking is a
-- strong no-show signal for the merchant (chip on the booking card/calendar).

alter table public.bookings
  add column if not exists attendance_confirmed_at timestamptz;

create or replace function public.confirm_booking_attendance(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_b record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;

  select b.* into v_b from public.bookings b
  where b.id = p_booking_id and b.customer_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_b.status not in ('accepted', 'scheduled') then
    return jsonb_build_object('ok', false, 'code', 'not_confirmable');
  end if;
  if v_b.attendance_confirmed_at is not null then
    return jsonb_build_object('ok', true); -- idempotent
  end if;

  update public.bookings
     set attendance_confirmed_at = now()
   where id = p_booking_id;

  insert into public.notifications (user_id, type, data)
  select s.owner_id, 'booking_attendance_confirmed',
         jsonb_build_object(
           'booking_id', p_booking_id,
           'store_id', v_b.store_id,
           'service_name', v_b.service_name,
           'customer_name', v_b.customer_name,
           'date', v_b.requested_date, 'time', v_b.requested_time)
  from public.stores s
  where s.id = v_b.store_id and s.owner_id is not null and s.owner_id <> v_uid;

  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.confirm_booking_attendance(uuid) from public, anon;
grant execute on function public.confirm_booking_attendance(uuid) to authenticated;
