-- Sunday Market — notify the seller when an admin approves or rejects a listing.
-- Notifications can only be inserted by SECURITY DEFINER triggers (the table has
-- no INSERT policy), so this must live in the DB, not in admin client code.
create or replace function public.notify_listing_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'active' then
      insert into public.notifications (user_id, type, data)
      values (new.seller_id, 'listing_approved',
              jsonb_build_object('listing_id', new.id));
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, type, data)
      values (new.seller_id, 'listing_rejected',
              jsonb_build_object('listing_id', new.id));
    end if;
  end if;
  return new;
end; $$;

create trigger listings_notify_status
  after update on public.listings
  for each row execute function public.notify_listing_status();

revoke execute on function public.notify_listing_status() from public, anon, authenticated;
