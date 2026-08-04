-- 0214: bulk product import from a spreadsheet.
--
-- 39 products across 17 stores — 2.3 each. That is not what a Lebanese clothing
-- shop carries; it is where merchants give up. A shop with 150 items opens the
-- product form, fills it three times, and stops. The catalogue is the funnel, and
-- it is closing on the third row.
--
-- Three things this needs that do not exist yet:
--
--   1. A sku. Without one, a second upload cannot recognise the first, so import
--      is a once-in-a-lifetime action. With one, re-uploading the same file
--      updates every price at once — which in Lebanon, where prices move with the
--      rate, is worth more than the initial import.
--
--   2. One definition of the product cap. enforce_free_product_limit carries its
--      own copy, and its copy is wrong (see section 2).
--
--   3. All-or-nothing. The per-row trigger would let 30 of 50 rows land and fail
--      the rest, leaving the merchant half-imported with no way to tell which
--      half.
--
-- Pro and above, enforced here.

-- ── 1. The sku ──────────────────────────────────────────────────────────────
alter table public.products add column if not exists sku text;

-- Unique per store, case-insensitively, ignoring soft-deleted rows — a merchant
-- reusing the code of something they deleted is not a conflict.
create unique index if not exists products_store_sku_idx
  on public.products (store_id, lower(sku))
  where sku is not null and deleted_at is null;

comment on column public.products.sku is
  'Merchant''s own product code. Optional, but it is what lets a re-uploaded spreadsheet update rows instead of duplicating them.';

-- ── 2. One definition of the cap ────────────────────────────────────────────
-- free 3 · basic 30 · pro 200 · business unlimited, resolved through
-- store_effective_plan (0213) so the trial rule lives in exactly one place.
create or replace function public.store_product_limit(p_store_id uuid)
returns integer language sql stable security definer set search_path to '' as $function$
  select case public.store_effective_plan(p_store_id)
           when 'business' then 2147483647
           when 'pro' then 200
           when 'basic' then 30
           else 3
         end;
$function$;

-- enforce_free_product_limit had its own inline copy of the rule, and it read
--   if trial is live then plan := 'pro'
-- unconditionally — the same bug 0208 fixed everywhere else. A Business store
-- with a live trial was capped at 200 instead of unlimited: an upgrade that took
-- products away. 0208's clear_trial_on_paid_plan makes that state hard to reach,
-- but the wrong rule was still sitting here waiting for it.
create or replace function public.enforce_free_product_limit()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_limit int; v_count int;
begin
  v_limit := public.store_product_limit(new.store_id);
  select count(*) into v_count from public.products
   where store_id = new.store_id and deleted_at is null;
  if v_count >= v_limit then
    raise exception 'free_product_limit'
      using errcode = '53400', hint = 'Upgrade your plan for more products';
  end if;
  return new;
end $function$;

-- ── 3. Tolerant number parsing ──────────────────────────────────────────────
-- A spreadsheet cell is text and merchants type "12,50" or "$12" or leave it
-- blank. These return null rather than throwing, so a bad cell becomes a row the
-- merchant can see and fix instead of an error that kills the whole file.
create or replace function public.parse_numeric_cell(p_text text)
returns numeric language plpgsql immutable set search_path to '' as $function$
declare v_clean text;
begin
  v_clean := btrim(coalesce(p_text, ''));
  if v_clean = '' then return null; end if;
  v_clean := replace(replace(v_clean, ',', '.'), ' ', '');
  v_clean := regexp_replace(v_clean, '[^0-9.-]', '', 'g');
  if v_clean = '' or v_clean = '-' or v_clean = '.' then return null; end if;
  begin
    return v_clean::numeric;
  exception when others then
    return null;
  end;
end $function$;

-- ── 4. The log ──────────────────────────────────────────────────────────────
-- Not a nicety. The first time a merchant says "I uploaded and nothing happened",
-- this is the difference between opening a row and guessing.
create table if not exists public.product_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  filename text,
  rows_total integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  country_code text not null default 'LB',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_imports_store_idx
  on public.product_imports (store_id, created_at desc);

alter table public.product_imports enable row level security;

drop policy if exists product_imports_select_store on public.product_imports;
create policy product_imports_select_store on public.product_imports for select
  using (public.can_manage_store(store_id));

-- ── 5. The import ───────────────────────────────────────────────────────────
-- Two passes on purpose. Pass one validates and writes nothing, so a file with a
-- bad row on line 90 is reported in full before a single product is created.
-- Pass two writes, and being one function it is one transaction: the merchant is
-- never left half-imported.
create or replace function public.import_products(
  p_store_id uuid,
  p_rows jsonb,
  p_filename text default null
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_row jsonb;
  v_idx int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_name text; v_sku text; v_section text;
  v_price numeric;
  v_will_add int := 0;
  v_limit int; v_existing int;
  v_new int := 0; v_upd int := 0;
  v_section_id uuid; v_pid uuid; v_import_id uuid;
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'not allowed';
  end if;
  if not public.store_has_plan(p_store_id, 'pro') then
    raise exception 'product import requires the Pro plan'
      using errcode = '53400';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a json array';
  end if;

  -- ---- pass 1: validate ----
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_name := nullif(btrim(coalesce(v_row->>'name', '')), '');
    v_sku  := nullif(btrim(coalesce(v_row->>'sku', '')), '');
    v_price := public.parse_numeric_cell(v_row->>'price');

    if v_name is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'name_required');
      continue;
    end if;
    if v_price is null or v_price < 0 then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'price_invalid');
      continue;
    end if;
    if btrim(coalesce(v_row->>'discount_price', '')) <> ''
       and public.parse_numeric_cell(v_row->>'discount_price') is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'discount_invalid');
      continue;
    end if;
    if btrim(coalesce(v_row->>'stock', '')) <> ''
       and public.parse_numeric_cell(v_row->>'stock') is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'stock_invalid');
      continue;
    end if;

    -- An update replaces a row that already counts; only genuinely new rows
    -- grow the catalogue, so only they are measured against the cap.
    if v_sku is null or not exists (
         select 1 from public.products
         where store_id = p_store_id and lower(sku) = lower(v_sku)
           and deleted_at is null) then
      v_will_add := v_will_add + 1;
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'code', 'rows_invalid',
      'errors', v_errors, 'created', 0, 'updated', 0);
  end if;

  -- ---- the cap, once, with real numbers ----
  v_limit := public.store_product_limit(p_store_id);
  select count(*) into v_existing from public.products
   where store_id = p_store_id and deleted_at is null;

  if v_existing + v_will_add > v_limit then
    return jsonb_build_object('ok', false, 'code', 'plan_limit',
      'existing', v_existing, 'adding', v_will_add, 'limit', v_limit,
      'created', 0, 'updated', 0);
  end if;

  -- ---- pass 2: write ----
  v_idx := 0;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_name := btrim(v_row->>'name');
    v_sku  := nullif(btrim(coalesce(v_row->>'sku', '')), '');
    v_price := public.parse_numeric_cell(v_row->>'price');
    v_section := nullif(btrim(coalesce(v_row->>'section', '')), '');

    -- Sections are matched by name and created on first sight; without this the
    -- whole import lands unsorted and the merchant re-sorts it by hand, which is
    -- the work the import was meant to remove.
    v_section_id := null;
    if v_section is not null then
      select id into v_section_id from public.store_sections
       where store_id = p_store_id and lower(name) = lower(v_section)
       limit 1;
      if v_section_id is null then
        insert into public.store_sections (store_id, name)
        values (p_store_id, v_section)
        returning id into v_section_id;
      end if;
    end if;

    v_pid := null;
    if v_sku is not null then
      select id into v_pid from public.products
       where store_id = p_store_id and lower(sku) = lower(v_sku)
         and deleted_at is null
       limit 1;
    end if;

    if v_pid is null then
      insert into public.products (
        store_id, sku, name, name_en, description, description_en,
        price, discount_price, stock, brand, image_url, section_id
      ) values (
        p_store_id, v_sku, v_name,
        nullif(btrim(coalesce(v_row->>'name_en', '')), ''),
        nullif(btrim(coalesce(v_row->>'description', '')), ''),
        nullif(btrim(coalesce(v_row->>'description_en', '')), ''),
        v_price,
        public.parse_numeric_cell(v_row->>'discount_price'),
        public.parse_numeric_cell(v_row->>'stock')::integer,
        nullif(btrim(coalesce(v_row->>'brand', '')), ''),
        nullif(btrim(coalesce(v_row->>'image_url', '')), ''),
        v_section_id
      );
      v_new := v_new + 1;
    else
      -- A blank cell means "leave it alone", not "erase it". A merchant editing
      -- prices in a trimmed-down sheet must not lose their descriptions.
      update public.products set
        name           = v_name,
        name_en        = coalesce(nullif(btrim(coalesce(v_row->>'name_en', '')), ''), name_en),
        description    = coalesce(nullif(btrim(coalesce(v_row->>'description', '')), ''), description),
        description_en = coalesce(nullif(btrim(coalesce(v_row->>'description_en', '')), ''), description_en),
        price          = v_price,
        discount_price = coalesce(public.parse_numeric_cell(v_row->>'discount_price'), discount_price),
        stock          = coalesce(public.parse_numeric_cell(v_row->>'stock')::integer, stock),
        brand          = coalesce(nullif(btrim(coalesce(v_row->>'brand', '')), ''), brand),
        image_url      = coalesce(nullif(btrim(coalesce(v_row->>'image_url', '')), ''), image_url),
        section_id     = coalesce(v_section_id, section_id),
        updated_at     = now()
      where id = v_pid;
      v_upd := v_upd + 1;
    end if;
  end loop;

  insert into public.product_imports
    (store_id, filename, rows_total, created_count, updated_count, created_by)
  values (p_store_id, p_filename, v_idx, v_new, v_upd, auth.uid())
  returning id into v_import_id;

  return jsonb_build_object('ok', true, 'import_id', v_import_id,
    'rows', v_idx, 'created', v_new, 'updated', v_upd);
end $function$;

comment on function public.import_products is
  'Bulk product import. Pro+. Validates every row before writing any, then imports in one transaction. Rows with a known sku update; the rest are created and counted against the plan cap.';
