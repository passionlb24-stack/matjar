-- 0209: stop history from re-pricing itself.
--
-- app_settings holds ONE row — 'usd_lbp_rate' = 89700 — and nothing else. orders,
-- pos_sales and order_payments store no currency and no rate. So every LBP figure
-- the platform has ever shown is computed from *today's* rate, including figures
-- for orders placed months ago. The moment the rate moves, last month's revenue
-- moves with it, and there is no way to reconstruct what was actually charged.
--
-- Nothing is wrong with the totals themselves — they are USD and correct. What is
-- missing is the rate that was in force when each one was taken. This adds that,
-- plus the history the setting never kept.
--
-- Stamped by trigger on INSERT, deliberately: place_customer_order,
-- place_guest_order, pos_record_sale and record_order_payment need NO change.

-- ── 1. The rate gets a history ──────────────────────────────────────────────
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  quote text not null default 'LBP',
  rate numeric(14,4) not null check (rate > 0),
  effective_from timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fx_rates_quote_time_idx
  on public.fx_rates (quote, effective_from desc);

alter table public.fx_rates enable row level security;

-- Every storefront needs to read the rate; only the platform may write it.
drop policy if exists fx_rates_read on public.fx_rates;
create policy fx_rates_read on public.fx_rates for select
  using (true);

drop policy if exists fx_rates_admin on public.fx_rates;
create policy fx_rates_admin on public.fx_rates for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed the history with the rate that is live right now.
insert into public.fx_rates (quote, rate)
select 'LBP', s.value::numeric
from public.app_settings s
where s.key = 'usd_lbp_rate'
  and not exists (select 1 from public.fx_rates);

-- From here on, every change to the global setting is recorded automatically.
create or replace function public.log_fx_rate_change()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.key = 'usd_lbp_rate'
     and (tg_op = 'INSERT' or new.value is distinct from old.value)
     and new.value ~ '^[0-9]+(\.[0-9]+)?$' then
    insert into public.fx_rates (quote, rate) values ('LBP', new.value::numeric);
  end if;
  return new;
end $function$;

drop trigger if exists app_settings_fx_history on public.app_settings;
create trigger app_settings_fx_history
  after insert or update on public.app_settings
  for each row execute function public.log_fx_rate_change();

-- ── 2. Every money row carries the rate it was taken at ─────────────────────
alter table public.orders         add column if not exists currency text not null default 'USD';
alter table public.orders         add column if not exists fx_rate numeric(14,4);
alter table public.pos_sales      add column if not exists currency text not null default 'USD';
alter table public.pos_sales      add column if not exists fx_rate numeric(14,4);
alter table public.order_payments add column if not exists currency text not null default 'USD';
alter table public.order_payments add column if not exists fx_rate numeric(14,4);

create or replace function public.stamp_fx_rate()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.currency is null then
    new.currency := 'USD';
  end if;
  if new.fx_rate is null then
    select f.rate into new.fx_rate
    from public.fx_rates f
    where f.quote = 'LBP'
    order by f.effective_from desc
    limit 1;
  end if;
  return new;
end $function$;

drop trigger if exists orders_stamp_fx on public.orders;
create trigger orders_stamp_fx before insert on public.orders
  for each row execute function public.stamp_fx_rate();

drop trigger if exists pos_sales_stamp_fx on public.pos_sales;
create trigger pos_sales_stamp_fx before insert on public.pos_sales
  for each row execute function public.stamp_fx_rate();

drop trigger if exists order_payments_stamp_fx on public.order_payments;
create trigger order_payments_stamp_fx before insert on public.order_payments
  for each row execute function public.stamp_fx_rate();

-- ── 3. Backfill — and be honest that it is a guess ──────────────────────────
-- No historical rate was ever stored, so the rows that predate this migration
-- get the only rate that exists. That is an approximation, not a record. It is
-- acceptable here only because the affected rows are 4 test orders, 1 POS sale
-- and 1 payment. It would not be acceptable later, which is why this ships now.
update public.orders
set fx_rate = (select rate from public.fx_rates order by effective_from limit 1)
where fx_rate is null;

update public.pos_sales
set fx_rate = (select rate from public.fx_rates order by effective_from limit 1)
where fx_rate is null;

update public.order_payments
set fx_rate = (select rate from public.fx_rates order by effective_from limit 1)
where fx_rate is null;

comment on column public.orders.fx_rate is
  'USD->LBP rate in force when the order was placed. Rows created before 0209 were backfilled with the then-current rate and are approximate, not recorded.';
