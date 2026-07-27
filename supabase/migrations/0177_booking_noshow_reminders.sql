-- 0177: no-show status + automatic booking reminders.
--
-- (1) 'no_show' joins the booking_status enum so a merchant can mark a customer
--     who didn't turn up (distinct from cancelled/rejected, which are decisions
--     made before the appointment).
-- (2) reminded_at already exists on bookings; scan_booking_reminders() fires a
--     one-time in-app reminder to the customer ~24h before the appointment and
--     stamps reminded_at so it never repeats. Scheduled hourly via pg_cron,
--     guarded exactly like 0118/0120.

-- ── 1) no-show status ───────────────────────────────────────────────────────
do $$
begin
  alter type public.booking_status add value if not exists 'no_show';
exception when others then
  raise notice 'could not add no_show: %', sqlerrm;
end $$;

-- ── 2) reminder scan ────────────────────────────────────────────────────────
create or replace function public.scan_booking_reminders()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
begin
  -- A booking's moment: engine rows carry starts_at; legacy rows derive it from
  -- date+time in Beirut. Remind when it's within the next 24h, still upcoming,
  -- live, and not yet reminded.
  for v_row in
    select b.id, b.customer_id, b.store_id, b.service_name,
           b.requested_date, b.requested_time,
           coalesce(b.starts_at,
                    (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut')
             as at_ts,
           s.name as store_name
    from public.bookings b
    join public.stores s on s.id = b.store_id
    where b.reminded_at is null
      and b.customer_id is not null
      and b.status in ('accepted', 'scheduled')
      and b.requested_date is not null
      and b.requested_time is not null
      and coalesce(b.starts_at,
                   (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut')
          between now() and now() + interval '24 hours'
  loop
    insert into public.notifications (user_id, type, data)
    values (v_row.customer_id, 'booking_reminder',
            jsonb_build_object(
              'booking_id', v_row.id,
              'store_id', v_row.store_id,
              'store_name', v_row.store_name,
              'service_name', v_row.service_name,
              'date', v_row.requested_date,
              'time', v_row.requested_time));
    update public.bookings set reminded_at = now() where id = v_row.id;
  end loop;
end $$;
revoke execute on function public.scan_booking_reminders() from public, anon, authenticated;

-- ── 3) schedule (guarded) ───────────────────────────────────────────────────
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron unavailable, skipping schedule setup: %', sqlerrm;
end $$;

do $$
begin
  perform cron.unschedule('matjar-booking-reminders');
exception when others then null;  -- not scheduled yet
end $$;
do $$
begin
  perform cron.schedule('matjar-booking-reminders', '0 * * * *',
                        'select public.scan_booking_reminders();');
exception when others then
  raise notice 'could not schedule matjar-booking-reminders: %', sqlerrm;
end $$;
