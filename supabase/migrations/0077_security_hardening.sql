-- Security quick-wins from the 2026-07 audit:
-- (1) harden the public storage bucket, (2) rate-limit the most-abusable write
-- paths (guest orders, messages, reviews), (3) lock down validate_coupon so the
-- anon key can't use it as a discount-code enumeration oracle.

-- ---- (1) Storage bucket: size + MIME limits --------------------------------
-- The bucket was unrestricted (any authenticated user could upload any file of
-- any size). Cap at 5 MB and images only — kills the storage-DoS and the
-- malware/SVG-hosting vectors. (Per-user path scoping is deferred: current
-- upload paths key on storeId, not uid, so that needs a client change too.)
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array[
        'image/jpeg','image/png','image/webp','image/gif','image/avif'
      ]
  where id = 'store-assets';

-- ---- (2) Rate limits -------------------------------------------------------
-- Counters are SECURITY DEFINER (must see rows RLS hides from the caller).

-- Messages: 120 / hour / user.
create or replace function public.rl_recent_messages(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.messages
  where sender_id = p_uid and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.rl_recent_messages(uuid) from public, anon;
grant execute on function public.rl_recent_messages(uuid) to authenticated;

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
    and public.rl_recent_messages((select auth.uid())) < 120
  );

-- Store reviews: 15 / hour / user.
create or replace function public.rl_recent_reviews(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.reviews
  where customer_id = p_uid and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.rl_recent_reviews(uuid) from public, anon;
grant execute on function public.rl_recent_reviews(uuid) to authenticated;

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (
    auth.uid() = customer_id
    and public.user_is_active()
    and public.rl_recent_reviews((select auth.uid())) < 15
  );

-- Product reviews: 20 / hour / user.
create or replace function public.rl_recent_product_reviews(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.product_reviews
  where customer_id = p_uid and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.rl_recent_product_reviews(uuid) from public, anon;
grant execute on function public.rl_recent_product_reviews(uuid) to authenticated;

drop policy if exists product_reviews_insert_own on public.product_reviews;
create policy product_reviews_insert_own on public.product_reviews
  for insert
  with check (
    customer_id = (select auth.uid())
    and public.user_is_active()
    and public.rl_recent_product_reviews((select auth.uid())) < 20
  );

-- Guest orders: 8 / hour / phone. A BEFORE INSERT trigger enforces it without
-- rewriting the place_guest_order RPC (guest rows have customer_id = null).
create or replace function public.guard_guest_order_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_norm text; v_count int;
begin
  if new.customer_id is null and new.phone is not null then
    v_norm := regexp_replace(new.phone, '[^0-9]', '', 'g');
    select count(*) into v_count from public.orders
      where customer_id is null
        and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_norm
        and created_at > now() - interval '1 hour';
    if v_count >= 8 then
      raise exception 'rate_limited' using errcode = '53400';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_guest_rate_guard on public.orders;
create trigger orders_guest_rate_guard
  before insert on public.orders
  for each row execute function public.guard_guest_order_rate();

-- ---- (3) Coupon lockdown ---------------------------------------------------
-- validate_coupon kept PostgreSQL's default PUBLIC execute grant, so the anon
-- key could call it directly and brute-force codes via its distinct reason
-- codes. Revoke from anon/public; the SECURITY DEFINER order RPCs still call it
-- internally, and signed-in shoppers still get the live preview. Guests apply
-- coupons at checkout (validated server-side inside place_guest_order).
revoke execute on function public.validate_coupon(uuid, text, numeric) from public, anon;
grant execute on function public.validate_coupon(uuid, text, numeric) to authenticated;
