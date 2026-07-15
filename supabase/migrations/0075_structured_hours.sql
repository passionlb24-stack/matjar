-- World-class hours & booking: structured per-day business hours + a booking
-- slot granularity, replacing the free-text-only opening_hours.
-- hours jsonb: {"0":{"open":"09:00","close":"18:00"}, …} keyed by JS weekday
-- (0 = Sunday); missing key = closed that day; null = not configured yet
-- (legacy free-text field remains as display fallback).
alter table public.stores
  add column if not exists hours jsonb,
  add column if not exists booking_slot_minutes integer not null default 30
    check (booking_slot_minutes between 5 and 240);
