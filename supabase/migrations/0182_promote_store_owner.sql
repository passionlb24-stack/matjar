-- 0182: opening a store makes you a merchant. Store creation goes through a
-- direct client insert (store-form.tsx), which never touched profiles.role — so
-- a customer who created a store stayed 'customer' and never got the dashboard
-- link (the site layout only shows it for role 'merchant'/'super_admin').
--
-- Fix at the data layer so EVERY creation path promotes automatically: an
-- AFTER INSERT trigger on stores. Mirrors the promotion already done in
-- transfer_store_ownership (0169). Never demotes an admin.

create or replace function public.promote_store_owner()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    update public.profiles
       set role = 'merchant'
     where id = new.owner_id and role = 'customer';
  end if;
  return new;
end $$;

drop trigger if exists trg_promote_store_owner on public.stores;
create trigger trg_promote_store_owner
  after insert on public.stores
  for each row execute function public.promote_store_owner();

-- Backfill: promote everyone who already owns a live store but is still a
-- 'customer' (e.g. Layal's 3 stores).
update public.profiles p
   set role = 'merchant'
 where p.role = 'customer'
   and exists (
     select 1 from public.stores s
     where s.owner_id = p.id and s.deleted_at is null
   );
