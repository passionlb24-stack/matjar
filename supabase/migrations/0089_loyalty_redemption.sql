-- Loyalty redemption. 0057 built loyalty points that could only ever ACCRUE — it
-- explicitly left "redemption-to-discount" as a later step, so a customer's
-- balance grew with no way to spend it (audit gap). This adds the exit path.
--
-- Points live in ONE append-only, per-USER ledger (public.loyalty_ledger,
-- balance = sum(delta)); there is NO per-store balance. A merchant redeems from
-- the CRM (e.g. applying points as a discount on a cash-on-delivery order), so a
-- redemption reduces the customer's GLOBAL balance and is recorded as a negative
-- 'redeem' row (a reason the 0057 ledger already anticipated). We add two
-- nullable, audit-only columns so a redeem row records WHICH store performed it
-- and an optional note; accrual rows leave them null and the balance query
-- (sum of delta per user_id) is deliberately unchanged.

-- ── Audit columns on the existing ledger (additive, nullable) ────────────────
alter table public.loyalty_ledger
  add column if not exists store_id uuid references public.stores (id) on delete set null,
  add column if not exists note text;

comment on column public.loyalty_ledger.store_id is
  'Store that performed a manual redemption (null for system accrual rows). Audit only: the balance stays global per user_id.';
comment on column public.loyalty_ledger.note is
  'Optional merchant note attached to a manual redemption.';

-- ── Redeem points on behalf of a customer ───────────────────────────────────
-- SECURITY DEFINER so it can read the customer's owner-only ledger and append a
-- redeem row, AFTER verifying the caller manages the store. The balance is
-- recomputed server-side from the ledger (never trust the client) and the
-- redemption is capped at it. A transaction-scoped advisory lock per customer
-- serialises concurrent redemptions so a balance can't be overspent by a race
-- (accrual only adds points, so it never conflicts).
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
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_customer_id is null then raise exception 'bad_customer'; end if;
  if p_points is null or p_points <= 0 then raise exception 'bad_amount'; end if;

  -- The customer must actually be a customer of THIS store (has an order here),
  -- so a manager can't burn a stranger's global points by guessing a profile id.
  if not exists (
    select 1 from public.orders o
    where o.store_id = p_store_id and o.customer_id = p_customer_id
  ) then
    raise exception 'not_a_customer';
  end if;

  -- Serialise redemptions for this one customer for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtext('loyalty_redeem:' || p_customer_id::text));

  select coalesce(sum(delta), 0)::int into v_balance
  from public.loyalty_ledger where user_id = p_customer_id;

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

-- ── Read balances for a store's customers (for the merchant CRM) ─────────────
-- RLS on loyalty_ledger is owner-only, so a merchant cannot read a customer's
-- balance directly. This SECURITY DEFINER reader returns balances ONLY for users
-- who have ordered from a store the caller manages (empty otherwise — never
-- leaks balances to non-managers). Powers the "available points" shown next to
-- each order-derived customer in the CRM.
create or replace function public.store_customer_loyalty(p_store_id uuid)
returns table (uid uuid, balance int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    return;
  end if;
  return query
    select l.user_id, coalesce(sum(l.delta), 0)::int
    from public.loyalty_ledger l
    where l.user_id in (
      select o.customer_id from public.orders o
      where o.store_id = p_store_id and o.customer_id is not null
    )
    group by l.user_id;
end; $$;

revoke execute on function public.store_customer_loyalty(uuid) from public, anon;
grant execute on function public.store_customer_loyalty(uuid) to authenticated;
