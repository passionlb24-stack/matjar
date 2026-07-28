-- Reject any new booking whose date/time is already in the past (Asia/Beirut).
-- A BEFORE INSERT trigger is the catch-all: it covers every path — place_booking,
-- the resource/court insert, classes, reservations, the legacy booking panel.
-- Engine rows carry starts_at; legacy rows carry requested_date + requested_time;
-- date-only rows compare the calendar day. Existing rows are untouched (INSERT
-- only), and merchant reschedules (UPDATE) are intentionally not blocked.
create or replace function public.reject_past_booking()
returns trigger language plpgsql set search_path = '' as $$
declare v_ts timestamptz;
begin
  if new.starts_at is not null then
    v_ts := new.starts_at;
  elsif new.requested_time is not null
        and length(trim(new.requested_time)) > 0 then
    v_ts := (new.requested_date + new.requested_time::time)
              at time zone 'Asia/Beirut';
  end if;

  if v_ts is not null then
    if v_ts < now() then
      raise exception 'past_booking' using errcode = '53400';
    end if;
  elsif new.requested_date is not null
        and new.requested_date < (now() at time zone 'Asia/Beirut')::date then
    raise exception 'past_booking' using errcode = '53400';
  end if;
  return new;
end $$;

drop trigger if exists bookings_no_past on public.bookings;
create trigger bookings_no_past
  before insert on public.bookings
  for each row execute function public.reject_past_booking();
