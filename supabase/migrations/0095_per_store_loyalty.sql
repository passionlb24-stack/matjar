-- Per-store loyalty (product decision): points a customer earns at a store can
-- only be spent AT THAT STORE — not as one global cross-store wallet. Every
-- accrual is already tied to an order (hence a store), so we (1) stamp store_id
-- on the earn rows, (2) backfill existing rows from their order, and (3) switch
-- the balance / redeem / merchant-reader to compute per (user, store). Redeem
-- rows already carry store_id (migration 0089).

-- 1) Earn path now records the store. Body identical to 0057 apart from store_id.
create or replace function public.award_loyalty_on_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pts int; v_ref record; v_bonus int := 200;
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.customer_id is not null then

    if not exists (
      select 1 from public.loyalty_ledger where order_id = new.id and reason = 'order'
    ) then
      v_pts := floor(new.total)::int;
      if v_pts > 0 then
        insert into public.loyalty_ledger (user_id, delta, reason, order_id, store_id)
        values (new.customer_id, v_pts, 'order', new.id, new.store_id);
      end if;
    end if;

    select * into v_ref from public.referrals
      where referred_id = new.customer_id and status = 'pending';
    if found then
      update public.referrals set status = 'rewarded', rewarded_at = now()
        where id = v_ref.id;
      insert into public.loyalty_ledger (user_id, delta, reason, order_id, store_id) values
        (v_ref.referred_id, v_bonus, 'referral_referred', new.id, new.store_id),
        (v_ref.referrer_id, v_bonus, 'referral_referrer', new.id, new.store_id);
    end if;
  end if;
  return new;
end; $$;

-- 2) Backfill: point every existing order-linked accrual row at its store.
update public.loyalty_ledger l set store_id = o.store_id
from public.orders o
where l.order_id = o.id and l.store_id is null;

-- 3a) Redeem: cap at the balance AT THIS STORE (was global). Lock is now per
-- (customer, store). Everything else unchanged from 0089.
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

-- 3b) Merchant CRM reader: balance PER THIS STORE for its own customers.
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
    where l.store_id = p_store_id
      and l.user_id in (
        select o.customer_id from public.orders o
        where o.store_id = p_store_id and o.customer_id is not null
      )
    group by l.user_id;
end; $$;
revoke execute on function public.store_customer_loyalty(uuid) from public, anon;
grant execute on function public.store_customer_loyalty(uuid) to authenticated;

-- 3c) Customer-facing reader: the signed-in user's balance broken down by store
-- (only stores where they have a positive balance). Powers the account panel.
create or replace function public.my_loyalty_by_store()
returns table (store_id uuid, store_name text, balance int)
language sql stable security definer set search_path = '' as $$
  select l.store_id, s.name, coalesce(sum(l.delta), 0)::int as balance
  from public.loyalty_ledger l
  join public.stores s on s.id = l.store_id
  where l.user_id = (select auth.uid()) and l.store_id is not null
  group by l.store_id, s.name
  having coalesce(sum(l.delta), 0) > 0;
$$;
revoke execute on function public.my_loyalty_by_store() from public, anon;
grant execute on function public.my_loyalty_by_store() to authenticated;
