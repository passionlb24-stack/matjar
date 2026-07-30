-- 0206: distinguish a sellable PRODUCT from a bookable SERVICE.
--
-- Reported live: a store that both books appointments and sells goods (a vet
-- clinic, a salon selling hair products, a clinic selling supplements) could not
-- sell anything. Root cause: `products` was one undifferentiated list, and the
-- store page picked ONE surface for all of it —
--   store-experience.ts: itemSurface = showBooking ? "appointment" : "order"
-- so the moment a sector booked appointments, every row became a bookable
-- service and the cart disappeared. There was no column to tell the two apart.
--
-- Additive and behaviour-preserving: the default is 'product', and the backfill
-- marks as 'service' exactly the rows that ALREADY behave as services today —
-- everything owned by a store in a booking-kind sector. So this migration alone
-- changes nothing on screen; the UI change rides on top of it.

alter table public.products
  add column if not exists item_kind text not null default 'product';

alter table public.products
  drop constraint if exists products_item_kind_check;
alter table public.products
  add constraint products_item_kind_check
  check (item_kind in ('product', 'service'));

-- Sector kinds mirror categoryModule in src/lib/modules.ts:
--   commerce → food, retail, automotive, pharmacy, farm
--   booking  → services, healthcare, realEstate, beauty, fitness, sportsCourts,
--              education, events, hospitality, petCare, professional, contractors
-- Only booking-kind stores get their existing rows flipped to 'service', which
-- is precisely how they render right now.
update public.products p
set item_kind = 'service'
from public.stores s
join public.business_types bt on bt.id = s.business_type_id
where p.store_id = s.id
  and p.item_kind = 'product'
  and bt.slug in (
    'services', 'healthcare', 'realEstate', 'beauty', 'fitness',
    'sportsCourts', 'education', 'events', 'hospitality', 'petCare',
    'professional', 'contractors'
  );

-- The storefront splits a store's items by kind on every load.
create index if not exists products_store_kind_idx
  on public.products (store_id, item_kind)
  where deleted_at is null;

comment on column public.products.item_kind is
  'product = sold via cart/order; service = booked via the appointment engine. A store may have both.';
