-- P1 hardening: keep the hourly write caps on messages + store reviews, and add
-- a VERIFIED-PURCHASE guard so a customer can only review a store they actually
-- transacted with (has an order or a booking for it).
--
-- NOTE: the rl_recent_messages / rl_recent_reviews counters and their rate-limit
-- policies were first shipped in 0077_security_hardening.sql (messages 120/hour,
-- reviews 15/hour). They are re-created here idempotently so this migration is a
-- self-contained record of every guard on these two write paths; the caps are
-- unchanged. The genuinely new piece is public.has_store_purchase() and its use
-- in the reviews insert policy.
--
-- Counters/guards are SECURITY DEFINER so they can see rows RLS hides from the
-- caller (same rationale as 0042_rate_limits.sql): a reporter/reviewer must be
-- able to count their own history and prove a purchase even where a plain
-- subquery under the caller's RLS would read 0.

-- ---- Rate-limit counters (re-affirmed from 0077) ---------------------------
create or replace function public.rl_recent_messages(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.messages
  where sender_id = p_uid and created_at > now() - interval '1 hour';
$$;
create or replace function public.rl_recent_reviews(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.reviews
  where customer_id = p_uid and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.rl_recent_messages(uuid) from public, anon;
revoke execute on function public.rl_recent_reviews(uuid) from public, anon;
grant execute on function public.rl_recent_messages(uuid) to authenticated;
grant execute on function public.rl_recent_reviews(uuid) to authenticated;

-- ---- Verified-purchase guard (new) -----------------------------------------
-- True when this user has ordered from OR booked the given store (any status).
create or replace function public.has_store_purchase(p_uid uuid, p_store uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.orders
    where customer_id = p_uid and store_id = p_store
  ) or exists (
    select 1 from public.bookings
    where customer_id = p_uid and store_id = p_store
  );
$$;
revoke execute on function public.has_store_purchase(uuid, uuid) from public, anon;
grant execute on function public.has_store_purchase(uuid, uuid) to authenticated;

-- ---- Messages: max 120 / hour / user (unchanged from 0077) -----------------
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
    and public.rl_recent_messages((select auth.uid())) < 120
  );

-- ---- Store reviews: own row + active + 15/hour + VERIFIED PURCHASE ---------
-- Rebuilt from the current 0077 policy, preserving every existing condition
-- (own row, active account, hourly cap) and adding the verified-purchase guard.
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and public.user_is_active()
    and public.rl_recent_reviews((select auth.uid())) < 15
    and public.has_store_purchase((select auth.uid()), store_id)
  );
