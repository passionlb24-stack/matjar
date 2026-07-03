-- P1: server-enforced rate limits on user inserts (RLS WITH CHECK, so they
-- cannot be bypassed from the client). Reviews are already upsert-unique per
-- (store, customer), so only listings and reports need caps.

-- Counters are SECURITY DEFINER so they can see rows RLS hides from the caller
-- (a reporter cannot SELECT listing_reports, so a plain subquery would read 0).
create or replace function public.rl_recent_listings(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.listings
  where seller_id = p_uid and created_at > now() - interval '1 hour';
$$;
create or replace function public.rl_recent_reports(p_uid uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.listing_reports
  where reporter_id = p_uid and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.rl_recent_listings(uuid) from public, anon;
revoke execute on function public.rl_recent_reports(uuid) from public, anon;
grant execute on function public.rl_recent_listings(uuid) to authenticated;
grant execute on function public.rl_recent_reports(uuid) to authenticated;

-- Max 20 new listings / hour per user.
drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings for insert
  with check (
    seller_id = (select auth.uid())
    and public.user_is_active()
    and public.rl_recent_listings((select auth.uid())) < 20
  );

-- Max 15 reports / hour per user, and one report per (listing, user).
drop policy if exists listing_reports_insert on public.listing_reports;
create policy listing_reports_insert on public.listing_reports for insert
  with check (
    reporter_id = (select auth.uid())
    and public.user_is_active()
    and public.rl_recent_reports((select auth.uid())) < 15
  );
create unique index if not exists listing_reports_unique_per_user
  on public.listing_reports (listing_id, reporter_id);
