-- Sunday Market — auto-expire stale listings. Active listings older than
-- 60 days flip to 'expired' (dropped from public views, which filter status
-- = 'active'). The seller can renew from "My listings" (renew reactivates +
-- resets created_at, restarting the clock).
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status = any (array['draft','pending','active','sold','rejected','expired']));

create or replace function public.expire_stale_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.listings
    set status = 'expired', updated_at = now()
  where status = 'active'
    and created_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end; $$;
revoke execute on function public.expire_stale_listings() from public, anon, authenticated;

-- Daily at 03:00 UTC (pg_cron).
create extension if not exists pg_cron;
select cron.schedule('expire-stale-listings', '0 3 * * *',
  $$select public.expire_stale_listings();$$);
