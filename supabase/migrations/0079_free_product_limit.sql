-- Monetization: free stores may list at most 3 products. Enforced server-side
-- (a BEFORE INSERT trigger) so it can't be bypassed from the client. Pro stores
-- are unlimited. Existing free stores that already have more are grandfathered
-- (the trigger only blocks NEW inserts once at/over the cap).
create or replace function public.enforce_free_product_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan text; v_count int;
begin
  select plan into v_plan from public.stores where id = new.store_id;
  if v_plan = 'free' then
    select count(*) into v_count
      from public.products
      where store_id = new.store_id and deleted_at is null;
    if v_count >= 3 then
      raise exception 'free_product_limit'
        using errcode = '53400',
              hint = 'Upgrade to Pro for unlimited products';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_free_product_limit() from public, anon, authenticated;

drop trigger if exists products_free_limit on public.products;
create trigger products_free_limit
  before insert on public.products
  for each row execute function public.enforce_free_product_limit();
