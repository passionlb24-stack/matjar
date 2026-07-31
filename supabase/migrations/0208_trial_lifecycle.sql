-- 0208: make the 14-day trial a real lifecycle instead of a date sitting on a row.
--
-- Reported: merchants "keep the Pro privileges of the trial". The root cause was
-- NOT a missing expiry — every gate already compares trial_ends_at to now().
-- It was that a paid plan and a live trial could coexist, and the app computed
--   effectivePlan = onTrial ? 'pro' : plan
-- so upgrading a store to Business while its trial was still running SERVED IT
-- PRO — an upgrade that removed features. Three live stores were in that state
-- (PETS, Passion Glow, ملحمة البركة).
--
-- The app side now takes the higher of the two ranks (plan-tiers.effectivePlan).
-- This migration removes the ability to be in that state at all, and adds the
-- two things the trial never had: a soft landing, and a warning.

-- ── 1. A paid plan consumes the trial ───────────────────────────────────────
create or replace function public.clear_trial_on_paid_plan()
returns trigger language plpgsql as $function$
begin
  -- Moving off 'free' means the merchant is on a real plan; the trial is spent.
  if new.plan is distinct from old.plan and new.plan <> 'free' then
    new.trial_ends_at := null;
  end if;
  return new;
end $function$;

drop trigger if exists stores_clear_trial_on_paid on public.stores;
create trigger stores_clear_trial_on_paid
  before update of plan on public.stores
  for each row execute function public.clear_trial_on_paid_plan();

-- Fix the stores already in the impossible state.
update public.stores
set trial_ends_at = null
where plan <> 'free' and trial_ends_at is not null;

-- ── 2. Soft landing: park the overflow instead of deleting it ───────────────
-- When a trial lapses, a store that loaded 50 products during it drops to the
-- free cap of 3. The old enforcement only blocked new INSERTs, so everything
-- added during the trial stayed live forever — the trial was effectively
-- permanent. Products above the cap are now PARKED (never deleted) and come
-- back untouched the moment the store upgrades.
alter table public.products
  add column if not exists hidden_by_plan boolean not null default false;

create index if not exists products_hidden_by_plan_idx
  on public.products (store_id)
  where hidden_by_plan;

comment on column public.products.hidden_by_plan is
  'Parked because the store exceeded its plan cap after a trial lapsed. Never set by a merchant; cleared automatically on upgrade.';

-- Re-park / un-park one store to match its current entitlement.
create or replace function public.sync_plan_parking(p_store_id uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_plan text; v_trial timestamptz; v_limit int;
begin
  select plan::text, trial_ends_at into v_plan, v_trial
  from public.stores where id = p_store_id;
  if v_plan is null then return; end if;
  -- Same entitlement rule as enforce_free_product_limit: an active trial grants
  -- Pro, but never below the paid plan already held.
  if v_trial is not null and v_trial > now()
     and v_plan not in ('pro', 'business') then
    v_plan := 'pro';
  end if;
  v_limit := case v_plan
               when 'business' then 2147483647
               when 'pro' then 200
               when 'basic' then 30
               else 3
             end;

  -- Keep the OLDEST v_limit products live; park the rest.
  update public.products p
  set hidden_by_plan = (r.rn > v_limit)
  from (
    select id, row_number() over (order by created_at, id) as rn
    from public.products
    where store_id = p_store_id and deleted_at is null
  ) r
  where p.id = r.id
    and p.hidden_by_plan is distinct from (r.rn > v_limit);
end $function$;

-- Upgrading (or a trial starting) un-parks immediately.
create or replace function public.resync_parking_on_plan_change()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.plan is distinct from old.plan
     or new.trial_ends_at is distinct from old.trial_ends_at then
    perform public.sync_plan_parking(new.id);
  end if;
  return new;
end $function$;

drop trigger if exists stores_resync_parking on public.stores;
create trigger stores_resync_parking
  after update of plan, trial_ends_at on public.stores
  for each row execute function public.resync_parking_on_plan_change();

-- ── 3. Nightly: lapse trials — park overflow + warn 3 days ahead ────────────
create or replace function public.run_trial_maintenance()
returns void language plpgsql security definer set search_path to '' as $function$
declare r record;
begin
  -- 3-day warning, once per store (guarded by the notification's own data).
  for r in
    select s.id, s.owner_id, s.name, s.trial_ends_at
    from public.stores s
    where s.plan = 'free'
      and s.trial_ends_at is not null
      and s.trial_ends_at > now()
      and s.trial_ends_at <= now() + interval '3 days'
      and s.deleted_at is null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = s.owner_id
          and n.type = 'trial_ending'
          and n.data->>'store_id' = s.id::text
      )
  loop
    insert into public.notifications (user_id, type, data)
    values (r.owner_id, 'trial_ending', jsonb_build_object(
      'store_id', r.id, 'store_name', r.name, 'ends_at', r.trial_ends_at));
  end loop;

  -- Trial just lapsed: park the overflow and say so, once.
  for r in
    select s.id, s.owner_id, s.name
    from public.stores s
    where s.plan = 'free'
      and s.trial_ends_at is not null
      and s.trial_ends_at <= now()
      and s.deleted_at is null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = s.owner_id
          and n.type = 'trial_ended'
          and n.data->>'store_id' = s.id::text
      )
  loop
    perform public.sync_plan_parking(r.id);
    insert into public.notifications (user_id, type, data)
    values (r.owner_id, 'trial_ended', jsonb_build_object(
      'store_id', r.id, 'store_name', r.name,
      'hidden', (select count(*) from public.products
                 where store_id = r.id and hidden_by_plan and deleted_at is null)));
  end loop;
end $function$;

select cron.schedule(
  'matjar-trial-maintenance',
  '30 2 * * *',
  $$select public.run_trial_maintenance();$$
);
