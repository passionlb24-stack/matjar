-- 0239: asking a tradesman to come, and saying afterwards whether they should
-- have.
--
-- craft_requests is deliberately thin. It is not an order: nothing is priced,
-- nothing is reserved, no money moves. It carries the problem, the place and
-- the timing — the three things a tradesman needs before deciding whether to
-- call back — plus a status the two of them move together. Anything heavier
-- would be a checkout pretending to be a phone call, and this market runs on
-- phone calls.
--
-- craft_reviews is tied to a completed request, one per request, written by the
-- customer who made it. A star rating that anyone can leave is a comment box
-- with numbers on it. That is also why guests cannot review: there is nobody to
-- attribute it to and nothing stopping a second one.
--
-- rating_avg and rating_count are denormalised onto the provider so the
-- directory can sort without a join, and recomputed by trigger so they cannot
-- drift from the reviews themselves.

create table if not exists public.craft_requests (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.craft_providers(id) on delete cascade,
  customer_id   uuid references public.profiles(id) on delete set null,
  customer_name text,
  phone         text not null,
  description   text not null,
  area_id       uuid references public.lb_areas(id) on delete set null,
  address       text,
  when_pref     text,
  scheduled_for timestamptz,
  photos        jsonb not null default '[]'::jsonb,
  status        text not null default 'pending'
                check (status in ('pending','accepted','in_progress',
                                  'completed','declined','cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists craft_requests_provider_idx
  on public.craft_requests (provider_id, created_at desc);
create index if not exists craft_requests_customer_idx
  on public.craft_requests (customer_id, created_at desc);

create table if not exists public.craft_reviews (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.craft_providers(id) on delete cascade,
  request_id  uuid not null unique references public.craft_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);
create index if not exists craft_reviews_provider_idx
  on public.craft_reviews (provider_id, created_at desc);

alter table public.craft_requests enable row level security;
alter table public.craft_reviews  enable row level security;

-- Only the two parties and admins: a request describes someone's home and
-- carries their phone number.
drop policy if exists craft_requests_read on public.craft_requests;
create policy craft_requests_read on public.craft_requests
  for select using (
    customer_id = (select auth.uid())
    or public.owns_craft_provider(provider_id)
    or public.is_super_admin()
  );

-- Guests may ask — that is most of this market — but a signed-in customer files
-- under their own account, so the request can be found again and reviewed.
drop policy if exists craft_requests_insert on public.craft_requests;
create policy craft_requests_insert on public.craft_requests
  for insert with check (
    customer_id is null or customer_id = (select auth.uid())
  );

drop policy if exists craft_requests_update on public.craft_requests;
create policy craft_requests_update on public.craft_requests
  for update using (
    customer_id = (select auth.uid())
    or public.owns_craft_provider(provider_id)
    or public.is_super_admin()
  );

drop policy if exists craft_reviews_read on public.craft_reviews;
create policy craft_reviews_read on public.craft_reviews for select using (true);

drop policy if exists craft_reviews_write on public.craft_reviews;
create policy craft_reviews_write on public.craft_reviews
  for insert to authenticated with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.craft_requests r
      where r.id = request_id
        and r.customer_id = (select auth.uid())
        and r.provider_id = craft_reviews.provider_id
        and r.status = 'completed'
    )
  );

drop policy if exists craft_reviews_own_update on public.craft_reviews;
create policy craft_reviews_own_update on public.craft_reviews
  for update using (customer_id = (select auth.uid()) or public.is_super_admin())
  with check (customer_id = (select auth.uid()) or public.is_super_admin());

create or replace function public.sync_craft_rating()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_provider uuid := coalesce(new.provider_id, old.provider_id);
begin
  update public.craft_providers p set
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 2)
                             from public.craft_reviews r where r.provider_id = v_provider), 0),
    rating_count = (select count(*) from public.craft_reviews r where r.provider_id = v_provider)
  where p.id = v_provider;
  return null;
end
$function$;

drop trigger if exists craft_reviews_sync_rating on public.craft_reviews;
create trigger craft_reviews_sync_rating
  after insert or update or delete on public.craft_reviews
  for each row execute function public.sync_craft_rating();
