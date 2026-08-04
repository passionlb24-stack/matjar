-- 0213: turn the courier directory into an actual dispatch.
--
-- delivery_companies + store_couriers already exist, but they are a *brochure*:
-- the admin lists couriers, the merchant ticks the ones they use and writes a
-- price next to each. Nothing is ever requested, nothing has a status, and the
-- customer is never told anything. Both tables are empty in production.
--
-- This adds the missing half — a request against a specific ORDER, a status it
-- moves through, and a reference the customer can follow. Deliberately manual to
-- start: the merchant dispatches over WhatsApp and advances the status by hand.
-- api_config is reserved on the courier so a real integration can later drive the
-- same rows without a second data model.
--
-- The prompt's data model calls this table `couriers`; delivery_companies IS that
-- table, so it is extended rather than duplicated.
--
-- Gated to Pro and above, enforced HERE — the UI gate is a courtesy, this is the
-- rule.

-- ── 1. One definition of "what plan is this store actually on" ──────────────
-- Mirrors effectivePlan() in src/lib/plan-tiers.ts: an active trial grants Pro
-- but must never downgrade a paid plan. Every server-side gate should call this
-- rather than re-deriving the rule, which is how the trial bug in 0208 happened.
create or replace function public.store_effective_plan(p_store_id uuid)
returns text language sql stable security definer set search_path to '' as $function$
  select case
           when s.trial_ends_at is not null
                and s.trial_ends_at > now()
                and coalesce(s.plan::text, 'free') not in ('pro','business')
             then 'pro'
           else coalesce(s.plan::text, 'free')
         end
  from public.stores s
  where s.id = p_store_id;
$function$;

create or replace function public.store_has_plan(p_store_id uuid, p_required text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select case public.store_effective_plan(p_store_id)
           when 'business' then 3 when 'pro' then 2 when 'basic' then 1 else 0
         end
       >= case p_required
            when 'business' then 3 when 'pro' then 2 when 'basic' then 1 else 0
          end;
$function$;

-- ── 2. Couriers gain the fields a dispatch needs ───────────────────────────
alter table public.delivery_companies
  add column if not exists coverage_regions text[] not null default '{}';
alter table public.delivery_companies
  add column if not exists pricing_rules jsonb not null default '{}'::jsonb;
alter table public.delivery_companies
  add column if not exists api_config jsonb;
alter table public.delivery_companies
  add column if not exists country_code text not null default 'LB';

comment on column public.delivery_companies.api_config is
  'Reserved for a real courier API. NULL = dispatch is manual (WhatsApp). Shape is per-courier and read only by the integration that owns it.';
comment on column public.delivery_companies.coverage_regions is
  'Machine-readable regions, for matching a courier to an order. The free-text `coverage` column stays as the human blurb shown in the directory.';

-- ── 3. The request ─────────────────────────────────────────────────────────
create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  company_id uuid not null references public.delivery_companies(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested','picked_up','in_transit','delivered','cancelled')),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  currency text not null default 'USD',
  tracking_ref text not null unique,
  note text,
  country_code text not null default 'LB',
  requested_at timestamptz not null default now(),
  picked_up_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists delivery_requests_store_idx
  on public.delivery_requests (store_id, requested_at desc);
create index if not exists delivery_requests_company_idx
  on public.delivery_requests (company_id, status);

-- One live dispatch per order; a cancelled one leaves room to re-dispatch.
create unique index if not exists delivery_requests_active_order_idx
  on public.delivery_requests (order_id)
  where status <> 'cancelled';

alter table public.delivery_requests enable row level security;

-- Read through the store. Writes go only through the RPCs below, so the plan
-- gate and the status machine cannot be sidestepped by a direct insert.
drop policy if exists delivery_requests_select_store on public.delivery_requests;
create policy delivery_requests_select_store on public.delivery_requests for select
  using (public.can_manage_store(store_id));

drop trigger if exists delivery_requests_touch on public.delivery_requests;
create trigger delivery_requests_touch
  before update on public.delivery_requests
  for each row execute function public.set_updated_at();

-- ── 4. Dispatch ────────────────────────────────────────────────────────────
create or replace function public.request_delivery(
  p_order_id uuid,
  p_company_id uuid,
  p_fee numeric default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_order public.orders%rowtype;
  v_fee numeric(12,2);
  v_ref text;
  v_id uuid;
  v_tries integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if not public.can_manage_store(v_order.store_id) then
    raise exception 'not allowed';
  end if;
  if not public.store_has_plan(v_order.store_id, 'pro') then
    raise exception 'delivery dispatch requires the Pro plan';
  end if;
  if not exists (select 1 from public.delivery_companies
                 where id = p_company_id and is_active) then
    raise exception 'courier not available';
  end if;
  if exists (select 1 from public.delivery_requests
             where order_id = p_order_id and status <> 'cancelled') then
    raise exception 'this order already has an active delivery request';
  end if;

  -- Fee: explicit wins, else the price the merchant set for this courier, else 0.
  v_fee := coalesce(
    p_fee,
    (select price from public.store_couriers
     where store_id = v_order.store_id and company_id = p_company_id),
    0);

  -- Short, unguessable enough for a link the customer gets over WhatsApp.
  loop
    v_ref := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (select 1 from public.delivery_requests where tracking_ref = v_ref);
    v_tries := v_tries + 1;
    if v_tries > 10 then
      raise exception 'could not allocate a tracking reference';
    end if;
  end loop;

  insert into public.delivery_requests
    (order_id, store_id, company_id, fee, currency, tracking_ref, note, created_by)
  values
    (p_order_id, v_order.store_id, p_company_id, v_fee,
     coalesce(v_order.currency, 'USD'), v_ref, p_note, auth.uid())
  returning id into v_id;

  -- The fee joins the order total. Recomputed from the order's own parts rather
  -- than added to the existing total, so re-dispatching cannot compound it.
  update public.orders
  set delivery_fee = v_fee,
      total = coalesce(subtotal, 0) - coalesce(discount, 0) + v_fee
  where id = p_order_id;

  return v_id;
end $function$;

comment on function public.request_delivery is
  'Dispatches an order to a courier. Pro+. Sets the order delivery_fee and recomputes its total (subtotal - discount + fee).';

-- ── 5. The status machine ──────────────────────────────────────────────────
-- Forward-only, except that anything short of delivered may be cancelled. A
-- status that can go backwards is a status the customer cannot trust.
create or replace function public.update_delivery_status(
  p_request_id uuid,
  p_status text
) returns void language plpgsql security definer set search_path to '' as $function$
declare
  v_req public.delivery_requests%rowtype;
  v_rank integer;
  v_new integer;
begin
  select * into v_req from public.delivery_requests where id = p_request_id;
  if not found then
    raise exception 'delivery request not found';
  end if;
  if not public.can_manage_store(v_req.store_id) then
    raise exception 'not allowed';
  end if;

  v_rank := case v_req.status
              when 'requested' then 1 when 'picked_up' then 2
              when 'in_transit' then 3 when 'delivered' then 4 else 0 end;
  v_new := case p_status
             when 'requested' then 1 when 'picked_up' then 2
             when 'in_transit' then 3 when 'delivered' then 4
             when 'cancelled' then -1 else null end;

  if v_new is null then
    raise exception 'unknown status: %', p_status;
  end if;
  if v_req.status = 'delivered' then
    raise exception 'this delivery is already completed';
  end if;
  if v_req.status = 'cancelled' then
    raise exception 'this delivery was cancelled';
  end if;
  if v_new > 0 and v_new <= v_rank then
    raise exception 'delivery status only moves forward';
  end if;

  update public.delivery_requests
  set status = p_status,
      picked_up_at  = case when p_status = 'picked_up'  then now() else picked_up_at end,
      in_transit_at = case when p_status = 'in_transit' then now() else in_transit_at end,
      delivered_at  = case when p_status = 'delivered'  then now() else delivered_at end,
      cancelled_at  = case when p_status = 'cancelled'  then now() else cancelled_at end
  where id = p_request_id;

  -- A cancelled dispatch takes its fee back out of the order.
  if p_status = 'cancelled' then
    update public.orders
    set delivery_fee = 0,
        total = coalesce(subtotal, 0) - coalesce(discount, 0)
    where id = v_req.order_id;
  end if;
end $function$;

-- ── 6. What the customer may see ───────────────────────────────────────────
-- By reference only, and deliberately narrow: status and timings, the store and
-- courier names. No address, no phone, no order contents — the link travels over
-- WhatsApp and gets forwarded.
create or replace function public.get_delivery_tracking(p_ref text)
returns table (
  status text,
  store_name text,
  courier_name text,
  courier_phone text,
  requested_at timestamptz,
  picked_up_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz
) language sql stable security definer set search_path to '' as $function$
  select d.status,
         s.name,
         c.name,
         c.phone,
         d.requested_at,
         d.picked_up_at,
         d.in_transit_at,
         d.delivered_at
  from public.delivery_requests d
  join public.stores s on s.id = d.store_id
  join public.delivery_companies c on c.id = d.company_id
  where d.tracking_ref = upper(p_ref)
    and d.status <> 'cancelled';
$function$;

revoke all on function public.get_delivery_tracking(text) from public;
grant execute on function public.get_delivery_tracking(text) to anon, authenticated;
