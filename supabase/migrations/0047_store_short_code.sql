-- Short store link support. A generated 8-hex code (first chars of the id)
-- powers matjarlb.com/s/<code> -> the store page, so a merchant gets a short,
-- printable/QR-able link. Generated + stored so it can be indexed.
alter table public.stores
  add column if not exists short_code text
  generated always as (left(id::text, 8)) stored;
create index if not exists stores_short_code_idx on public.stores (short_code);
