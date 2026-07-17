-- Merchant opt-in for loyalty redemption. Migration 0089/0095 built a working
-- per-(user, store) redemption RPC, but redemption was implicitly ON for every
-- store — any manager could burn a customer's points from the CRM. Redemption is
-- a funding decision each merchant makes for their own store, so it must be an
-- explicit opt-in with a merchant-chosen conversion rate. This adds:
--   1) two per-store settings columns (enabled flag + points-per-$1 rate),
--   2) a SECURITY DEFINER getter/setter for the CRM (manager-guarded), and
--   3) a gate on redeem_loyalty_points so it refuses when the store hasn't
--      opted in (everything else about the redeem RPC is unchanged from 0095).
-- The accrual path (0057/0095) is deliberately untouched: points keep earning;
-- this only governs whether/at-what-rate they can be spent.

-- ── Per-store redemption settings (additive, safe defaults = opt-out) ─────────
-- redemption stays OFF until a merchant enables it. points_per_unit is how many
-- points equal 1 currency unit ($1) of discount (default 100 ⇒ 1% back, since
-- accrual is 1 point per $1 spent).
alter table public.stores
  add column if not exists loyalty_redemption_enabled boolean not null default false,
  add column if not exists loyalty_points_per_unit int not null default 100
    check (loyalty_points_per_unit >= 1);

comment on column public.stores.loyalty_redemption_enabled is
  'Merchant opt-in: when false, redeem_loyalty_points refuses for this store.';
comment on column public.stores.loyalty_points_per_unit is
  'Points required for 1 currency unit ($1) of redemption discount at this store.';

-- ── Read this store''s redemption settings (for the merchant CRM) ─────────────
-- SECURITY DEFINER + manager guard, mirroring store_customer_loyalty: returns
-- nothing to non-managers (never leaks a store''s config).
create or replace function public.get_loyalty_redemption(p_store_id uuid)
returns table (enabled boolean, points_per_unit int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    return;
  end if;
  return query
    select s.loyalty_redemption_enabled, s.loyalty_points_per_unit
    from public.stores s where s.id = p_store_id;
end; $$;
revoke execute on function public.get_loyalty_redemption(uuid) from public, anon;
grant execute on function public.get_loyalty_redemption(uuid) to authenticated;

-- ── Update this store''s redemption settings (merchant control) ───────────────
create or replace function public.set_loyalty_redemption(
  p_store_id uuid,
  p_enabled boolean,
  p_points_per_unit int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_points_per_unit is null or p_points_per_unit < 1 then
    raise exception 'bad_rate';
  end if;
  update public.stores
    set loyalty_redemption_enabled = coalesce(p_enabled, false),
        loyalty_points_per_unit = p_points_per_unit,
        updated_at = now()
    where id = p_store_id;
end; $$;
revoke execute on function
  public.set_loyalty_redemption(uuid, boolean, int) from public, anon;
grant execute on function
  public.set_loyalty_redemption(uuid, boolean, int) to authenticated;

-- ── Gate redemption on the store''s opt-in ────────────────────────────────────
-- Identical to 0095 except for the new redemption_disabled check. Kept as a full
-- CREATE OR REPLACE so the guard can never be bypassed by an older definition.
create or replace function public.redeem_loyalty_points(
  p_store_id uuid,
  p_customer_id uuid,
  p_points int,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_balance int;
  v_id uuid;
  v_enabled boolean;
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_customer_id is null then raise exception 'bad_customer'; end if;
  if p_points is null or p_points <= 0 then raise exception 'bad_amount'; end if;

  -- Store must have opted in to redemption.
  select loyalty_redemption_enabled into v_enabled
    from public.stores where id = p_store_id;
  if not coalesce(v_enabled, false) then
    raise exception 'redemption_disabled';
  end if;

  if not exists (
    select 1 from public.orders o
    where o.store_id = p_store_id and o.customer_id = p_customer_id
  ) then
    raise exception 'not_a_customer';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('loyalty_redeem:' || p_customer_id::text || ':' || p_store_id::text)
  );

  select coalesce(sum(delta), 0)::int into v_balance
  from public.loyalty_ledger
  where user_id = p_customer_id and store_id = p_store_id;

  if v_balance < p_points then
    raise exception 'insufficient_points';
  end if;

  insert into public.loyalty_ledger (user_id, delta, reason, store_id, note)
  values (p_customer_id, -p_points, 'redeem', p_store_id, nullif(trim(p_note), ''))
  returning id into v_id;
  return v_id;
end; $$;

revoke execute on function
  public.redeem_loyalty_points(uuid, uuid, int, text) from public, anon;
grant execute on function
  public.redeem_loyalty_points(uuid, uuid, int, text) to authenticated;
