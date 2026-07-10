-- Saved-search alerts for Sunday Market: a user saves a query/filters and gets
-- a notification whenever a new matching listing goes active. The strongest
-- classifieds-retention loop (people return to check "did anything new drop?").
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  q text,
  category text,
  region text,
  city text,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);
alter table public.saved_searches enable row level security;

create policy saved_searches_own on public.saved_searches for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_saved_search_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.notifications (user_id, type, data)
    select ss.user_id, 'listing_match', jsonb_build_object('listing_id', new.id)
    from public.saved_searches ss
    left join public.market_categories mc on mc.slug = ss.category
    where ss.user_id <> new.seller_id
      and (ss.q is null or new.title ilike '%' || ss.q || '%')
      and (ss.category is null or mc.id = new.category_id)
      and (ss.region is null or new.region = ss.region)
      and (ss.city is null or new.city ilike '%' || ss.city || '%');
  end if;
  return new;
end $$;
drop trigger if exists listings_notify_saved_search on public.listings;
create trigger listings_notify_saved_search
  after insert or update on public.listings
  for each row execute function public.notify_saved_search_match();
revoke execute on function public.notify_saved_search_match() from public, anon, authenticated;
