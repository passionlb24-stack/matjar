-- Per-store discount coupons. Codes are validated via a SECURITY DEFINER RPC so
-- customers never read the coupons table directly (no code enumeration).
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  type text not null default 'percent' check (type in ('percent','fixed')),
  value numeric(12,2) not null default 0,
  min_order numeric(12,2),
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);
create index if not exists coupons_store_id_idx on public.coupons(store_id);

alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount numeric(12,2) not null default 0;

alter table public.coupons enable row level security;

create policy coupons_select on public.coupons
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_super_admin());
create policy coupons_insert on public.coupons
  for insert to authenticated with check (public.can_manage_store(store_id));
create policy coupons_update on public.coupons
  for update to authenticated using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
create policy coupons_delete on public.coupons
  for delete to authenticated using (public.can_manage_store(store_id));

create or replace function public.validate_coupon(
  p_store_id uuid, p_code text, p_subtotal numeric
) returns table(valid boolean, discount numeric, reason text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  c public.coupons;
begin
  select * into c from public.coupons
  where store_id = p_store_id and code = p_code and is_active limit 1;
  if not found then
    return query select false, 0::numeric, 'invalid'; return;
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return query select false, 0::numeric, 'expired'; return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select false, 0::numeric, 'used_up'; return;
  end if;
  if c.min_order is not null and p_subtotal < c.min_order then
    return query select false, 0::numeric, 'min_order'; return;
  end if;
  return query select true,
    case when c.type = 'percent'
         then round(p_subtotal * c.value / 100, 2)
         else least(c.value, p_subtotal) end,
    'ok';
end;
$function$;

create or replace function public.bump_coupon_use()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.coupon_code is not null and new.coupon_code <> '' then
    update public.coupons
    set used_count = used_count + 1, updated_at = now()
    where store_id = new.store_id and code = new.coupon_code;
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_bump_coupon on public.orders;
create trigger orders_bump_coupon
  after insert on public.orders
  for each row execute function public.bump_coupon_use();
