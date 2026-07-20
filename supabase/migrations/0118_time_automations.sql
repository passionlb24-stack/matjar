-- Automation Engine — TIME-BASED triggers (extends 0117).
--
-- 0117 fires automations from row events inside the customer's own transaction.
-- Two useful automations can't be expressed that way — they depend on the CLOCK,
-- not on a row change:
--   booking_reminder   — remind a customer N hours before their appointment.
--   customer_inactive   — win back a customer who crossed N days without ordering.
--
-- Both are driven by SCHEDULED SCANNERS (pg_cron) that find the matching rows and
-- delegate to the SAME fail-safe dispatcher, public.run_automations(store, trigger,
-- context). We do NOT reimplement action logic — the scanners only *find rows* and
-- build the context; notify / whatsapp / loyalty / coupon all run inside 0117.
--
-- Contract additions (the UI is built against these exact strings):
--   triggers   : booking_reminder | customer_inactive
--   conditions : { hours_before }  (booking_reminder, int, default 1)
--                { inactive_days } (customer_inactive, int, default 30)
--   context booking_reminder  : { booking_id, customer_id, phone, customer_name, when }
--   context customer_inactive : { customer_id, phone, customer_name, last_order_at }
--
-- Like the dispatcher, the scanners are SECURITY DEFINER / empty search_path and
-- FAIL-SAFE: a scan error is swallowed-and-logged, never raised, so a single bad
-- row (or a missing pg_cron) can never break the schedule or the app.
--
-- NOTE for the orchestrator: pg_cron must be enabled on the project (it is —
-- installed_version 1.6.4). Every cron statement below is wrapped in a guarded
-- DO block: if `create extension pg_cron` or `cron.schedule` is unavailable, the
-- migration still succeeds and the scan_* functions can be invoked manually or
-- scheduled later (e.g. `select public.scan_booking_reminders();`).
--
-- Times: bookings store wall-clock local time (requested_date date + requested_time
-- text). We interpret them in 'Asia/Beirut' (Matjar's market) to get a real
-- timestamptz, independent of the cron session's TimeZone.

-- ============================================================================
-- 1) Dedup column for booking reminders
-- ============================================================================
alter table public.bookings add column if not exists reminded_at timestamptz;

-- Partial index for the reminder scan (only rows still awaiting a reminder).
create index if not exists bookings_reminder_scan_idx
  on public.bookings (store_id, requested_date)
  where reminded_at is null;

-- ============================================================================
-- 2) Helper: safe text -> time parse (never raises)
-- ============================================================================
-- requested_time is free text ("10:00", "9:30", "14:00:00", or garbage). A raw
-- cast inside a set-based scan would abort the whole query on ONE bad value, so
-- we parse defensively: bad/empty input yields null (the row is then excluded).
create or replace function public.matjar_parse_time(p_text text)
returns time
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  return btrim(p_text)::time;
exception when others then
  return null;
end;
$$;
revoke execute on function public.matjar_parse_time(text) from public, anon, authenticated;

-- ============================================================================
-- 3) scan_booking_reminders() — fire booking_reminder once per booking
-- ============================================================================
-- For each enabled booking_reminder automation, find its store's bookings that:
--   * have no reminder yet (reminded_at is null),
--   * are active/confirmed (status in accepted|scheduled — NOT pending/cancelled/
--     completed/rejected),
--   * have a parseable date+time whose start is within [now, now + hours_before h].
-- Mark reminded_at=now() BEFORE dispatch so it can never re-fire, then delegate to
-- the fail-safe dispatcher. reminded_at is per-booking: at most one reminder per
-- booking even if a store has several booking_reminder automations.
create or replace function public.scan_booking_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto  public.automations;
  v_hours int;
  v_b     record;
begin
  for v_auto in
    select * from public.automations
    where trigger = 'booking_reminder' and enabled
  loop
    begin  -- ---- per-automation guard ------------------------------------
      v_hours := coalesce(nullif(v_auto.conditions->>'hours_before', '')::int, 1);
      if v_hours <= 0 then v_hours := 1; end if;

      for v_b in
        select
          b.id            as booking_id,
          b.customer_id   as customer_id,
          b.phone         as phone,
          b.customer_name as customer_name,
          ((b.requested_date + public.matjar_parse_time(b.requested_time))
             at time zone 'Asia/Beirut') as when_ts
        from public.bookings b
        where b.store_id = v_auto.store_id
          and b.reminded_at is null
          and b.status in ('accepted', 'scheduled')
          and b.requested_date is not null
          and public.matjar_parse_time(b.requested_time) is not null
          and ((b.requested_date + public.matjar_parse_time(b.requested_time))
                 at time zone 'Asia/Beirut')
              between now() and now() + make_interval(hours => v_hours)
        for update of b skip locked
      loop
        -- Dedup first: even if the dispatch is a no-op, never revisit this row.
        update public.bookings set reminded_at = now() where id = v_b.booking_id;

        perform public.run_automations(v_auto.store_id, 'booking_reminder', jsonb_build_object(
          'booking_id',    v_b.booking_id,
          'customer_id',   v_b.customer_id,
          'phone',         v_b.phone,
          'customer_name', v_b.customer_name,
          'when',          v_b.when_ts
        ));
      end loop;

    exception when others then
      -- Log the scan failure for this automation; keep scanning the others.
      begin
        insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
        values (v_auto.id, v_auto.store_id, 'booking_reminder', 'error',
                jsonb_build_object('scope', 'scan', 'error', sqlerrm));
      exception when others then null; end;
    end;
  end loop;

exception when others then
  null;  -- absolute backstop: a scan must never raise into the scheduler.
end;
$$;
revoke execute on function public.scan_booking_reminders() from public, anon, authenticated;

-- ============================================================================
-- 4) scan_inactive_customers() — fire customer_inactive as a customer crosses N days
-- ============================================================================
-- Runs ONCE PER DAY. For each enabled customer_inactive automation, take every
-- customer's MOST RECENT order at that store and fire only for those whose last
-- order falls in the 1-day slice [now-(inactive_days+1)d, now-inactive_days d) —
-- i.e. exactly as they cross the threshold. The daily cadence + a 1-day-wide
-- window means each customer fires at most once per inactivity episode, so no
-- dedup column is needed. Guests (customer_id null) are ignored.
create or replace function public.scan_inactive_customers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto public.automations;
  v_days int;
  v_c    record;
begin
  for v_auto in
    select * from public.automations
    where trigger = 'customer_inactive' and enabled
  loop
    begin  -- ---- per-automation guard ------------------------------------
      v_days := coalesce(nullif(v_auto.conditions->>'inactive_days', '')::int, 30);
      if v_days <= 0 then v_days := 30; end if;

      for v_c in
        select latest.customer_id, latest.phone, latest.customer_name,
               latest.last_order_at
        from (
          select distinct on (o.customer_id)
                 o.customer_id,
                 o.phone,
                 o.customer_name,
                 o.created_at as last_order_at
          from public.orders o
          where o.store_id = v_auto.store_id
            and o.customer_id is not null
          order by o.customer_id, o.created_at desc
        ) latest
        where latest.last_order_at >= now() - make_interval(days => v_days + 1)
          and latest.last_order_at <  now() - make_interval(days => v_days)
      loop
        perform public.run_automations(v_auto.store_id, 'customer_inactive', jsonb_build_object(
          'customer_id',   v_c.customer_id,
          'phone',         v_c.phone,
          'customer_name', v_c.customer_name,
          'last_order_at', v_c.last_order_at
        ));
      end loop;

    exception when others then
      begin
        insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
        values (v_auto.id, v_auto.store_id, 'customer_inactive', 'error',
                jsonb_build_object('scope', 'scan', 'error', sqlerrm));
      exception when others then null; end;
    end;
  end loop;

exception when others then
  null;  -- absolute backstop.
end;
$$;
revoke execute on function public.scan_inactive_customers() from public, anon, authenticated;

-- ============================================================================
-- 5) Scheduling (pg_cron) — all guarded so re-runs / missing pg_cron never error
-- ============================================================================
-- pg_cron is installed on this project (1.6.4). The `if not exists` makes the
-- create a no-op when already present; the DO/exception guards make every cron
-- statement optional — the scan functions work with or without a schedule.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron unavailable, skipping schedule setup: %', sqlerrm;
end $$;

-- Booking reminders: every 15 minutes (tight enough for hour-scale reminders).
do $$
begin
  perform cron.unschedule('matjar-booking-reminders');
exception when others then null;  -- not scheduled yet
end $$;
do $$
begin
  perform cron.schedule('matjar-booking-reminders', '*/15 * * * *',
                        'select public.scan_booking_reminders();');
exception when others then
  raise notice 'could not schedule matjar-booking-reminders: %', sqlerrm;
end $$;

-- Inactive-customer win-back: once a day at 09:00.
do $$
begin
  perform cron.unschedule('matjar-inactive-customers');
exception when others then null;
end $$;
do $$
begin
  perform cron.schedule('matjar-inactive-customers', '0 9 * * *',
                        'select public.scan_inactive_customers();');
exception when others then
  raise notice 'could not schedule matjar-inactive-customers: %', sqlerrm;
end $$;

-- ============================================================================
-- ROLLED-BACK TEST  (orchestrator: uncomment & run; it always raises to roll back)
-- ============================================================================
-- Expected: RESULT PASS b_notif=1 b_fired=1 b_reminded=1 i_notif=1 i_fired=1
-- /*
-- do $$
-- declare
--   -- booking_reminder case
--   v_owner1 uuid := gen_random_uuid();
--   v_cust1  uuid := gen_random_uuid();
--   v_store1 uuid;
--   v_auto1  uuid;
--   v_book   uuid;
--   v_start  timestamp;                 -- local (Beirut) wall clock
--   v_bnotif int; v_bfired int; v_brem int;
--   -- customer_inactive case
--   v_owner2 uuid := gen_random_uuid();
--   v_cust2  uuid := gen_random_uuid();
--   v_store2 uuid;
--   v_auto2  uuid;
--   v_inotif int; v_ifired int;
-- begin
--   insert into auth.users (id) values (v_owner1), (v_cust1), (v_owner2), (v_cust2);
--   insert into public.profiles (id) values (v_owner1), (v_cust1), (v_owner2), (v_cust2);
--
--   -- ---- booking_reminder: a booking 30 min out should remind (hours_before 1) ----
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner1, 'Reminder Test Store', 'active', 'pro') returning id into v_store1;
--   insert into public.automations (store_id, name, trigger, conditions, actions, enabled, created_by)
--   values (v_store1, 'Booking reminder', 'booking_reminder', '{"hours_before":1}'::jsonb,
--           jsonb_build_array(
--             jsonb_build_object('type','notify','title','Reminder','body','Your appointment is soon')
--           ), true, v_owner1)
--   returning id into v_auto1;
--
--   v_start := (now() at time zone 'Asia/Beirut') + interval '30 minutes';
--   insert into public.bookings (store_id, customer_id, status, requested_date, requested_time, customer_name, phone)
--     values (v_store1, v_cust1, 'accepted', v_start::date, to_char(v_start, 'HH24:MI'), 'Test Cust', '71000000')
--     returning id into v_book;
--
--   perform public.scan_booking_reminders();
--
--   select count(*) into v_bnotif from public.notifications where user_id = v_owner1 and type = 'automation';
--   select count(*) into v_bfired from public.automation_runs where automation_id = v_auto1 and status = 'fired';
--   select count(*) into v_brem  from public.bookings where id = v_book and reminded_at is not null;
--
--   -- ---- customer_inactive: last order ~30.5 days ago crosses the 30-day line ----
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner2, 'Winback Test Store', 'active', 'pro') returning id into v_store2;
--   insert into public.automations (store_id, name, trigger, conditions, actions, enabled, created_by)
--   values (v_store2, 'Win back', 'customer_inactive', '{"inactive_days":30}'::jsonb,
--           jsonb_build_array(
--             jsonb_build_object('type','notify','title','We miss you','body','Come back!')
--           ), true, v_owner2)
--   returning id into v_auto2;
--
--   insert into public.orders (store_id, customer_id, status, total, created_at)
--     values (v_store2, v_cust2, 'completed', 20, now() - interval '30 days 12 hours');
--
--   perform public.scan_inactive_customers();
--
--   select count(*) into v_inotif from public.notifications where user_id = v_owner2 and type = 'automation';
--   select count(*) into v_ifired from public.automation_runs where automation_id = v_auto2 and status = 'fired';
--
--   if v_bnotif = 1 and v_bfired = 1 and v_brem = 1 and v_inotif = 1 and v_ifired = 1 then
--     raise exception 'RESULT PASS b_notif=% b_fired=% b_reminded=% i_notif=% i_fired=%',
--       v_bnotif, v_bfired, v_brem, v_inotif, v_ifired;
--   else
--     raise exception 'RESULT FAIL b_notif=% b_fired=% b_reminded=% i_notif=% i_fired=%',
--       v_bnotif, v_bfired, v_brem, v_inotif, v_ifired;
--   end if;
-- end $$;
-- */
