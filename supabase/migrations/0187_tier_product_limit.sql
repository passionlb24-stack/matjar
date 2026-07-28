-- Per-tier catalog caps (was a flat free=3): free 3, basic 30, pro 200,
-- business unlimited. An active trial counts as pro. Keeps the same trigger +
-- 'free_product_limit' error code so the existing frontend guard still matches.
create or replace function public.enforce_free_product_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan text; v_trial timestamptz; v_limit int; v_count int;
begin
  select plan::text, trial_ends_at into v_plan, v_trial
    from public.stores where id = new.store_id;
  if v_trial is not null and v_trial > now() then v_plan := 'pro'; end if;
  v_limit := case v_plan
               when 'business' then 2147483647
               when 'pro' then 200
               when 'basic' then 30
               else 3
             end;
  select count(*) into v_count from public.products
    where store_id = new.store_id and deleted_at is null;
  if v_count >= v_limit then
    raise exception 'free_product_limit'
      using errcode = '53400', hint = 'Upgrade your plan for more products';
  end if;
  return new;
end $$;
