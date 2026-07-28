-- Merchant-set cancellation window: a customer can't cancel within N hours of
-- the appointment (0 = cancel anytime, the default). The merchant can always
-- cancel from the dashboard. Enforced in cancel_my_booking (the customer path).
alter table public.stores
  add column if not exists booking_cancel_hours integer not null default 0;

create or replace function public.cancel_my_booking(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_b record; v_hours int; v_appt timestamptz;
begin
  select b.status, b.starts_at, b.requested_date, b.requested_time,
         s.booking_cancel_hours as cancel_hours
    into v_b
  from public.bookings b join public.stores s on s.id = b.store_id
  where b.id = p_id and b.customer_id = auth.uid()
    and b.status in ('pending','accepted','scheduled');
  if not found then
    raise exception 'cannot_cancel' using errcode = '42501';
  end if;

  v_hours := coalesce(v_b.cancel_hours, 0);
  if v_hours > 0 then
    v_appt := coalesce(
      v_b.starts_at,
      case when v_b.requested_time is not null
                and length(trim(v_b.requested_time)) > 0
        then (v_b.requested_date + v_b.requested_time::time)
               at time zone 'Asia/Beirut'
        else (v_b.requested_date::timestamp) at time zone 'Asia/Beirut'
      end);
    if v_appt is not null
       and now() > v_appt - make_interval(hours => v_hours) then
      raise exception 'cancel_too_late' using errcode = '53400';
    end if;
  end if;

  update public.bookings set status = 'cancelled', updated_at = now()
   where id = p_id;
end $$;
