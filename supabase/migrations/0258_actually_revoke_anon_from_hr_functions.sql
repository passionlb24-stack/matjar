-- My revokes in 0248/0254/0256 did nothing.
--
-- I wrote `revoke all on function ... from public` and assumed that shut anon
-- out. It does not: Supabase grants `anon` and `authenticated` directly, so
-- revoking from PUBLIC leaves both grants standing. Every one of those functions
-- is still callable by an anonymous visitor. I checked, rather than trusting the
-- line I had written.
--
-- Most survive it — they check can_manage_store internally and an anonymous
-- caller just gets not_authorized. Two do not:
--
--   store_employee_roster has no internal check by design; it feeds the clock-in
--   kiosk, which is a signed-in screen. Anonymous, it hands the staff list of
--   any shop to anyone holding a store id.
--
--   employee_clock is guarded by a 4-digit PIN. Reachable by anon with no
--   account and no rate limit, that PIN is 10,000 guesses from a script.
revoke all on function public.receive_stock(uuid, uuid, jsonb, date, text) from anon;
revoke all on function public.set_employee_pin(uuid, text) from anon;
revoke all on function public.employee_clock(uuid, uuid, text, numeric, numeric) from anon;
revoke all on function public.build_payroll(uuid, date, date) from anon;
revoke all on function public.post_payroll(uuid) from anon;
revoke all on function public.store_employee_roster(uuid) from anon;

-- Being signed in is not much of a barrier on its own, so the PIN gets a real
-- one: five wrong guesses against a shop in ten minutes and it stops answering.
-- Counted per store rather than per employee, because an attacker walks the
-- roster rather than hammering one name.
create table if not exists public.clock_attempts (
  id bigserial primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid,
  ok boolean not null,
  actor uuid,
  at timestamptz not null default now()
);

create index if not exists clock_attempts_store_at_idx
  on public.clock_attempts (store_id, at desc);

alter table public.clock_attempts enable row level security;

drop policy if exists clock_attempts_read on public.clock_attempts;
create policy clock_attempts_read on public.clock_attempts
  for select using (public.can_manage_store(store_id) or public.is_super_admin());

-- NOTE: the rate limit as written here does not work — see 0259. The failed
-- attempt is written and then the raise rolls it back, so nothing accumulates.
