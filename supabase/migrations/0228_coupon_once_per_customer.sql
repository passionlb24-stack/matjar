-- 0228: let a merchant cap a coupon per person, not just in total.
--
-- coupons.max_uses caps a code across everyone. There was nothing capping it
-- per customer, so "10% off, 100 uses" was not a hundred customers' first
-- order — it was one customer's standing discount, a hundred times over. The
-- merchant had no way to express what they actually meant.
--
-- Off by default: existing codes keep behaving exactly as they do today, and
-- the merchant opts in per coupon from the coupons screen.
--
-- Identity is the account for a signed-in order and the phone number for a
-- guest one. The phone is the only handle guest checkout has, and it is already
-- what the merchant would use to recognise a repeat customer — but it is worth
-- being clear that it is weaker: a second number defeats it. This is a normal
-- merchant guard against casual reuse, not fraud prevention.
--
-- Cancelled and rejected orders do not count against the limit, matching 0227:
-- an order that was refused should not consume the customer's one chance.
--
-- Verified on production inside rolled-back transactions:
--   once_per_customer code, same customer, 2nd order → coupon_already_used
--   plain code,             same customer, 2nd order → succeeds

alter table public.coupons
  add column if not exists once_per_customer boolean not null default false;

comment on column public.coupons.once_per_customer is
  'When true, a customer may redeem this code once. Identity is the account for '
  'a signed-in order and the phone number for a guest one — the only handle a '
  'guest checkout has.';

do $do$
declare d text; d2 text;
begin
  -- signed-in checkout: identity is the account
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace='public'::regnamespace and proname='place_customer_order';
  d2 := replace(d,
$q$    if v_coupon.valid then v_discount := coalesce(v_coupon.discount, 0); end if;$q$,
$q$    if v_coupon.valid then
      if exists (select 1 from public.coupons c
                  where c.store_id = p_store_id
                    and c.code = upper(trim(p_coupon))
                    and c.once_per_customer)
         and exists (select 1 from public.orders o
                      where o.store_id = p_store_id
                        and o.coupon_code = upper(trim(p_coupon))
                        and o.customer_id = v_uid
                        and o.status not in ('cancelled', 'rejected'))
      then
        raise exception 'coupon_already_used';
      end if;
      v_discount := coalesce(v_coupon.discount, 0);
    end if;$q$);
  if d2 = d then raise exception 'customer coupon block did not match'; end if;
  execute d2;

  -- guest checkout: the phone number is the only handle there is
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace='public'::regnamespace and proname='place_guest_order';
  d2 := replace(d,
$q$    if v_coupon.valid then v_discount := coalesce(v_coupon.discount, 0); end if;$q$,
$q$    if v_coupon.valid then
      if exists (select 1 from public.coupons c
                  where c.store_id = p_store_id
                    and c.code = upper(trim(p_coupon))
                    and c.once_per_customer)
         and exists (select 1 from public.orders o
                      where o.store_id = p_store_id
                        and o.coupon_code = upper(trim(p_coupon))
                        and o.phone = trim(p_phone)
                        and o.status not in ('cancelled', 'rejected'))
      then
        raise exception 'coupon_already_used';
      end if;
      v_discount := coalesce(v_coupon.discount, 0);
    end if;$q$);
  if d2 = d then raise exception 'guest coupon block did not match'; end if;
  execute d2;
end
$do$;
