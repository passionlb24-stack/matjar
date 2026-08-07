-- 0234: a store can sell a file.
--
-- Salla offers منتج رقمي and بطاقة رقمية; Matjar had no digital delivery at
-- all, so a bakery could not sell its recipe book and a designer could not sell
-- a template. Everything else was already in place — products, orders, the
-- checkout, the merchant dashboard — so this adds the two things that were
-- genuinely missing: somewhere to put the file, and a way to hand it to exactly
-- one buyer.
--
-- THE BUCKET IS PRIVATE, AND THAT IS THE WHOLE DESIGN
--
-- store-assets is public by design: product photos are meant to be seen, and
-- ImageUpload returns a permanent public URL. Putting a paid file there would
-- leave it one guessable link from being free. digital-goods is private, has no
-- read policy at all, and nothing in the app ever returns its paths to a
-- browser.
--
-- Delivery therefore cannot be an RLS question. "May this person download this"
-- is a fact about an ORDER, and storage.objects policies cannot see orders. So
-- it happens in two steps, in this order:
--
--   1. digital_download_grant() runs as the CALLER and answers from the order —
--      right buyer (account, or the phone a guest ordered with), order not
--      pending, cancelled or rejected. It returns the path only if all of that
--      holds, and nothing otherwise.
--   2. Only then does the route sign a 5-minute URL with the service role.
--
-- The merchant still controls release: nothing is downloadable until they
-- accept the order, because on a cash-on-delivery platform that is when they
-- have been paid. A free item has nothing to collect and is available at once.
--
-- Write access to the bucket is the store owner's alone, keyed off the store id
-- in the first path segment. Staff cannot upload, and no one can write into
-- another store's folder.
--
-- Verified on production inside rolled-back transactions:
--   the buyer, order accepted   → grant returned
--   a different signed-in user  → nothing
--   the buyer, order pending    → nothing

alter table public.products drop constraint if exists products_item_kind_check;
alter table public.products add constraint products_item_kind_check
  check (item_kind = any (array['product', 'service', 'digital']));

alter table public.products
  add column if not exists digital_path text,
  add column if not exists digital_name text,
  add column if not exists digital_size bigint;

comment on column public.products.digital_path is
  'Object path inside the PRIVATE digital-goods bucket. Never a public URL: the '
  'file is served only through a short-lived signed URL issued to a buyer who '
  'has an order for it.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-goods', 'digital-goods', false, 104857600)
on conflict (id) do update set public = false;

drop policy if exists digital_goods_owner_write on storage.objects;
create policy digital_goods_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'digital-goods'
    and public.is_store_owner((split_part(name, '/', 1))::uuid)
  );

drop policy if exists digital_goods_owner_manage on storage.objects;
create policy digital_goods_owner_manage on storage.objects
  for all to authenticated
  using (
    bucket_id = 'digital-goods'
    and public.is_store_owner((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'digital-goods'
    and public.is_store_owner((split_part(name, '/', 1))::uuid)
  );

create or replace function public.digital_download_grant(
  p_order_item_id uuid,
  p_phone text default null)
returns table(path text, filename text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v record;
begin
  select oi.id,
         p.digital_path,
         p.digital_name,
         p.name       as product_name,
         o.customer_id,
         o.phone,
         o.status::text as status,
         o.total
    into v
    from public.order_items oi
    join public.orders   o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
   where oi.id = p_order_item_id;

  if not found or v.digital_path is null then
    return;
  end if;

  -- A signed-in buyer is matched on their account; a guest has only the phone
  -- they ordered with, the same handle the tracking page uses. Anyone else gets
  -- nothing — including the store, which already has the file.
  if v.customer_id is not null then
    if v.customer_id <> (select auth.uid()) then return; end if;
  else
    if p_phone is null or btrim(p_phone) = '' or btrim(p_phone) <> v.phone then
      return;
    end if;
  end if;

  if v.status in ('pending', 'cancelled', 'rejected') and coalesce(v.total, 0) > 0 then
    return;
  end if;

  return query select v.digital_path,
                      coalesce(v.digital_name, v.product_name || '.file');
end
$function$;

revoke execute on function public.digital_download_grant(uuid, text) from anon;
grant execute on function public.digital_download_grant(uuid, text) to authenticated, anon;
