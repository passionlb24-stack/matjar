-- Promoted / featured store listings (revenue). A store is "featured" while
-- now() < featured_until; featured stores float to the top of listings and get
-- a badge. Payment is manual, so an admin grants featured status after payment.
--
-- Security: the stores UPDATE policy lets an owner edit their own store, which
-- would let a merchant self-promote for free. A BEFORE-UPDATE guard silently
-- reverts any featured_until change made by a non-admin, so only super admins
-- can grant it.

alter table public.stores add column if not exists featured_until timestamptz;

create index if not exists stores_featured_idx
  on public.stores (featured_until) where featured_until is not null;

create or replace function public.guard_store_featured()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.featured_until is distinct from old.featured_until
     and not public.is_super_admin() then
    new.featured_until := old.featured_until;
  end if;
  return new;
end; $$;

drop trigger if exists stores_guard_featured on public.stores;
create trigger stores_guard_featured
  before update on public.stores
  for each row execute function public.guard_store_featured();
