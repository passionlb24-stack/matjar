-- 14-day free Pro trial for new stores.
-- Every store created from now on gets Pro features free for 14 days: a BEFORE
-- INSERT trigger stamps trial_ends_at = now() + 14 days. Existing stores are NOT
-- backfilled (trial_ends_at stays null for them). Server-side gating
-- (getStorePlan) and the product-limit trigger both treat an active trial as Pro.

alter table public.stores add column if not exists trial_ends_at timestamptz;

-- Auto-grant the trial on insert. Only new rows that come in on the default free
-- plan without an explicit trial get one, so restoring/importing a paid store or
-- an already-expired trial is left untouched.
create or replace function public.grant_store_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plan = 'free' and new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '14 days';
  end if;
  return new;
end $$;
revoke execute on function public.grant_store_trial() from public, anon, authenticated;

drop trigger if exists stores_grant_trial on public.stores;
create trigger stores_grant_trial
  before insert on public.stores
  for each row execute function public.grant_store_trial();

-- Recreate the free-product-limit trigger fn so the 3-product cap is skipped for
-- Pro stores AND stores on an active trial. Everything else is preserved.
create or replace function public.enforce_free_product_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan text; v_trial_ends_at timestamptz; v_count int;
begin
  select plan, trial_ends_at into v_plan, v_trial_ends_at
    from public.stores where id = new.store_id;
  -- Unlimited when Pro or on an active trial.
  if v_plan = 'pro' or (v_trial_ends_at is not null and v_trial_ends_at > now()) then
    return new;
  end if;
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
