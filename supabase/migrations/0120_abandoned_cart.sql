-- Automation Engine — ABANDONED-CART recovery (extends 0117 + 0118).
--
-- A customer who fills a cart and enters a phone but never places the order is a
-- warm lead the merchant should win back. There is NO WhatsApp Business API — the
-- recovery reaches the MERCHANT as an in-app notification carrying a one-tap
-- wa.me link (the merchant taps to message the customer). This is exactly the
-- existing 'whatsapp' action inside 0117, so we add NO dispatcher logic here.
--
-- Mechanics, mirroring 0118's time-based pattern:
--   * The storefront fire-and-forgets record_checkout_intent(...) as the phone is
--     entered, persisting a per-(store,phone) "checkout intent" (the live cart).
--   * Placing an order clears that intent (the cart converted).
--   * A pg_cron scanner (scan_abandoned_carts) finds intents that went stale
--     (>30 min, <7 days) without converting and dispatches the SAME fail-safe
--     dispatcher run_automations(store, 'order_abandoned', ctx) — once per intent.
--
-- Contract addition (the UI is built against this exact string):
--   triggers   : order_abandoned
--   conditions : {}  (none)
--   context    : { phone, customer_name, customer_id, items }
--
-- Like 0117/0118 everything here is FAIL-SAFE: record_checkout_intent is called
-- fire-and-forget from checkout and must NEVER raise; the clear trigger must
-- never break an order insert; the scanner swallows-and-logs, never raises.

-- ============================================================================
-- 1) Table — public.checkout_intents (one live cart per store+phone)
-- ============================================================================
create table if not exists public.checkout_intents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  phone text not null,
  customer_name text,
  customer_id uuid,
  items jsonb not null default '[]'::jsonb,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone)
);

-- Hot path for the scanner: un-notified intents per store, newest activity first.
create index if not exists checkout_intents_scan_idx
  on public.checkout_intents (store_id, updated_at)
  where notified_at is null;

alter table public.checkout_intents enable row level security;

-- No public write policies: every write goes through the SECURITY DEFINER RPC,
-- the clear trigger, or the scanner. Managers MAY read their store's live intents
-- (in case we surface them in the merchant UI later). Modeled on 0117's policies.
create policy checkout_intents_select on public.checkout_intents
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_super_admin());

-- ============================================================================
-- 2) RPC — record_checkout_intent(...)  (fire-and-forget from checkout)
-- ============================================================================
-- Called from the storefront as the customer types a phone. It MUST never error
-- (a raise would surface in the checkout UI), so the whole body is wrapped in
-- `exception when others then null`. It upserts on (store_id, phone) and RESETS
-- notified_at so a fresh cart attempt re-arms the recovery. customer_id is taken
-- from auth.uid() (null for guests). Guarded validation: store must be active and
-- the phone must be a plausible length, else it silently no-ops.
create or replace function public.record_checkout_intent(
  p_store_id uuid,
  p_phone text,
  p_name text default null,
  p_items jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  -- Store must exist and be active.
  perform 1 from public.stores where id = p_store_id and status = 'active';
  if not found then
    return;
  end if;

  -- Plausible phone only (trimmed length >= 4).
  v_phone := btrim(coalesce(p_phone, ''));
  if length(v_phone) < 4 then
    return;
  end if;

  insert into public.checkout_intents
    (store_id, phone, customer_name, customer_id, items, updated_at, notified_at)
  values
    (p_store_id, v_phone, nullif(btrim(coalesce(p_name, '')), ''),
     auth.uid(), coalesce(p_items, '[]'::jsonb), now(), null)
  on conflict (store_id, phone) do update
    set customer_name = excluded.customer_name,
        customer_id   = excluded.customer_id,
        items         = excluded.items,
        updated_at    = now(),
        notified_at   = null;  -- re-arm: a new attempt is not yet "abandoned"

exception when others then
  null;  -- fire-and-forget: never surface an error into checkout.
end;
$$;

-- Called from the public storefront (guests + logged-in customers).
grant execute on function public.record_checkout_intent(uuid, text, text, jsonb)
  to anon, authenticated;

-- ============================================================================
-- 3) Conversion clear — drop the intent once an order is placed
-- ============================================================================
-- A placed order means the cart converted, so its intent is stale. A NEW,
-- separately-named AFTER INSERT trigger on orders (never touches 0117's order
-- triggers). Matched on (store_id, trimmed phone) — the same normalization the
-- RPC stores. Guarded so it can never break the customer's order insert.
create or replace function public.abandoned_cart_clear_on_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.checkout_intents
    where store_id = new.store_id
      and phone = btrim(coalesce(new.phone, ''));
  return new;
exception when others then
  return new;  -- a failed cleanup must never roll back the order.
end $$;

drop trigger if exists orders_abandoned_cart_clear on public.orders;
create trigger orders_abandoned_cart_clear
  after insert on public.orders
  for each row execute function public.abandoned_cart_clear_on_order();

revoke execute on function public.abandoned_cart_clear_on_order()
  from public, anon, authenticated;

-- ============================================================================
-- 4) scan_abandoned_carts() — fire order_abandoned once per stale intent
-- ============================================================================
-- For each enabled order_abandoned automation, find its store's intents that:
--   * have not been notified (notified_at is null),
--   * went stale: last touched > 30 min ago (abandoned, not mid-checkout),
--   * are recent: last touched < 7 days ago (don't chase ancient rows).
-- Mark notified_at = now() BEFORE dispatch so an intent can never re-fire, then
-- delegate to the fail-safe dispatcher. notified_at is per-intent: at most one
-- recovery per cart even if a store has several order_abandoned automations.
create or replace function public.scan_abandoned_carts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto public.automations;
  v_ci   record;
begin
  for v_auto in
    select * from public.automations
    where trigger = 'order_abandoned' and enabled
  loop
    begin  -- ---- per-automation guard ------------------------------------
      for v_ci in
        select id, phone, customer_name, customer_id, items
        from public.checkout_intents
        where store_id = v_auto.store_id
          and notified_at is null
          and updated_at < now() - interval '30 minutes'
          and updated_at > now() - interval '7 days'
        for update skip locked
      loop
        -- Dedup first: even if the dispatch is a no-op, never revisit this row.
        update public.checkout_intents set notified_at = now() where id = v_ci.id;

        perform public.run_automations(v_auto.store_id, 'order_abandoned', jsonb_build_object(
          'phone',         v_ci.phone,
          'customer_name', v_ci.customer_name,
          'customer_id',   v_ci.customer_id,
          'items',         v_ci.items
        ));
      end loop;

    exception when others then
      -- Log the scan failure for this automation; keep scanning the others.
      begin
        insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
        values (v_auto.id, v_auto.store_id, 'order_abandoned', 'error',
                jsonb_build_object('scope', 'scan', 'error', sqlerrm));
      exception when others then null; end;
    end;
  end loop;

exception when others then
  null;  -- absolute backstop: a scan must never raise into the scheduler.
end;
$$;
revoke execute on function public.scan_abandoned_carts() from public, anon, authenticated;

-- ============================================================================
-- 5) Scheduling (pg_cron) — every 15 min, all guarded (re-runs / missing pg_cron
--    never error), exactly like 0118.
-- ============================================================================
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron unavailable, skipping schedule setup: %', sqlerrm;
end $$;

do $$
begin
  perform cron.unschedule('matjar-abandoned-carts');
exception when others then null;  -- not scheduled yet
end $$;
do $$
begin
  perform cron.schedule('matjar-abandoned-carts', '*/15 * * * *',
                        'select public.scan_abandoned_carts();');
exception when others then
  raise notice 'could not schedule matjar-abandoned-carts: %', sqlerrm;
end $$;

-- ============================================================================
-- ROLLED-BACK TEST  (orchestrator: uncomment & run; it always raises to roll back)
-- ============================================================================
-- Expected: RESULT PASS s_notif=1 s_fired=1 s_notified=1 cleared=1
-- /*
-- do $$
-- declare
--   -- scan (abandoned -> notify) case
--   v_owner uuid := gen_random_uuid();
--   v_cust  uuid := gen_random_uuid();
--   v_store uuid;
--   v_auto  uuid;
--   v_ci    uuid;
--   v_snotif int; v_sfired int; v_snotified int;
--   -- conversion-clear case
--   v_owner2 uuid := gen_random_uuid();
--   v_store2 uuid;
--   v_cleared int;
-- begin
--   insert into auth.users (id) values (v_owner), (v_cust), (v_owner2);
--   insert into public.profiles (id) values (v_owner), (v_cust), (v_owner2);
--
--   -- ---- scan: a 40-min-stale, un-notified intent should fire once ----
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner, 'Abandoned Test Store', 'active', 'pro') returning id into v_store;
--   insert into public.automations (store_id, name, trigger, conditions, actions, enabled, created_by)
--   values (v_store, 'Recover cart', 'order_abandoned', '{}'::jsonb,
--           jsonb_build_array(
--             jsonb_build_object('type','notify','title','Cart left','body','A customer left a cart')
--           ), true, v_owner)
--   returning id into v_auto;
--
--   insert into public.checkout_intents (store_id, phone, customer_name, customer_id, items, updated_at, notified_at)
--     values (v_store, '71000000', 'Test Cust', v_cust,
--             jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'name', 'Widget', 'quantity', 2)),
--             now() - interval '40 minutes', null)
--     returning id into v_ci;
--
--   perform public.scan_abandoned_carts();
--
--   select count(*) into v_snotif   from public.notifications where user_id = v_owner and type = 'automation';
--   select count(*) into v_sfired   from public.automation_runs where automation_id = v_auto and status = 'fired';
--   select count(*) into v_snotified from public.checkout_intents where id = v_ci and notified_at is not null;
--
--   -- ---- conversion clear: placing an order drops the matching intent ----
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner2, 'Clear Test Store', 'active', 'pro') returning id into v_store2;
--   insert into public.checkout_intents (store_id, phone, items)
--     values (v_store2, '70111111', '[]'::jsonb);
--   insert into public.orders (store_id, status, total, phone)
--     values (v_store2, 'pending', 30, '70111111');
--   select count(*) into v_cleared from public.checkout_intents
--     where store_id = v_store2 and phone = '70111111';
--
--   if v_snotif = 1 and v_sfired = 1 and v_snotified = 1 and v_cleared = 0 then
--     raise exception 'RESULT PASS s_notif=% s_fired=% s_notified=% cleared=%',
--       v_snotif, v_sfired, v_snotified, (1 - v_cleared);
--   else
--     raise exception 'RESULT FAIL s_notif=% s_fired=% s_notified=% cleared_remaining=%',
--       v_snotif, v_sfired, v_snotified, v_cleared;
--   end if;
-- end $$;
-- */
