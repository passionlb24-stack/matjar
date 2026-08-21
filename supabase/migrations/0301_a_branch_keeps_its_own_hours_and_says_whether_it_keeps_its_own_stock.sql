-- ISS-023: "branches share one stock pool; no per-branch inventory, hours, or plan."
--
-- What production actually contains, checked before writing anything: 36 live
-- stores, 37 store_locations rows, and exactly ONE store with more than one
-- branch — Qabass Computers, whose second branch (فرع حلبا) was created
-- 2026-08-18. That store has zero products, so zero stock-tracked products.
-- Platform-wide only 8 of 68 products track stock at all, and there have been 7
-- orders ever. The failure ISS-023 describes — branch A sells the last unit,
-- branch B's page still shows it — has therefore never been reachable in
-- production and cannot become reachable until that one store adds a
-- stock-tracked product. Nobody is stranded, which is why this migration can be
-- schema-first without racing anyone.
--
-- ---- Why this is a per-store setting and not a platform-wide change ----------
--
-- Per-branch stock is not obviously right. A shop with two storefronts and one
-- storeroom genuinely has one pool, and splitting it on them would turn a
-- correct number into two numbers they have to reconcile by hand. A shop with
-- two independent shops genuinely has two pools. Nothing in the schema can tell
-- those apart, and guessing wrong is bad in both directions. So the platform
-- does not decide: `stores.branch_stock_separate` is the merchant's own
-- declaration, defaulting to false, which is exactly what all 36 live stores
-- are today. Shipping the flag before the enforcement is deliberate — it turns
-- an undisclosed limitation into a stated one, and it tells us which merchants
-- actually need the enforcement before we build the risky half.
--
-- ---- What decides which branch an order draws from --------------------------
--
-- The order flow CAN already choose, and it is worth being precise because the
-- obvious assumption ("nothing can pick a branch yet") is wrong:
--   * every purchase surface — store cart and product page alike — funnels
--     through CheckoutForm -> buildOrderParams (src/lib/checkout.ts), which
--     sends p_location_id whenever the store has more than one branch;
--   * checkout-form.tsx renders a REQUIRED branch <select> in that case, so it
--     is an explicit customer choice, not an inference from a delivery zone;
--   * place_guest_order / place_customer_order re-validate that choice against
--     store_locations (raising `bad_location`) and stamp orders.location_id
--     BEFORE inserting order_items — so decrement_product_stock, which fires
--     AFTER INSERT on order_items, could read the branch off new.order_id
--     inside the same transaction;
--   * pos_record_sale takes p_location_id too, chosen in pos-terminal.tsx.
--
-- So the outbound side has a decider. The reason the decrement is NOT wired
-- here is the inbound side, which does not:
--   * adjust_stock(p_product, p_qty, p_note) sets an absolute quantity with no
--     idea which branch it belongs to;
--   * receive_stock(p_store_id, p_supplier_id, p_lines, p_happened_on, p_note)
--     books goods in with no branch either.
-- Both are deployed and both are called by the running build, and adding a
-- parameter to either creates an OVERLOAD rather than a replacement — 0289
-- documents that trap in detail. Wire the decrement without fixing those and
-- branch rows only ever go DOWN: every sale takes from a branch, nothing ever
-- puts anything back into one, and the first restock silently strands stock at
-- the store level while the branch reads zero. That oversells in the opposite
-- direction — it refuses orders for goods that are physically on the shelf.
--
-- And the outbound path is wider than one trigger. Making per-branch stock
-- authoritative means changing, in one go, all of: decrement_product_stock,
-- restore_stock_on_cancel, retake_stock_on_reactivate, and the inline decrement
-- inside pos_record_sale. Four deployed functions on the live money path, for
-- zero stores that would switch the flag on today. That trade is not worth
-- making in the same change that introduces the tables, so the honest statement
-- is written down rather than glossed: the schema below supports per-branch
-- stock; NOTHING reads or writes product_branch_stock yet; products.stock
-- remains the single source of truth for every sale, exactly as before this
-- migration.
--
-- ---- Per-branch hours: yes. Per-branch plan: no. ----------------------------
--
-- Hours belong here. A Tripoli branch and a Halba branch keeping different
-- hours is ordinary, it has no interaction with the money path, and
-- store_locations.hours mirrors the shape stores.hours already uses (jsonb
-- keyed by JS weekday, see src/lib/hours.ts) so the existing helpers read it
-- unchanged. Null means "inherit the store's hours", which is what every one of
-- the 37 existing rows means today.
--
-- Plan does not belong here, and not because it is hard. stores.plan drives
-- billing; payments and subscriptions were deliberately restricted to the owner
-- in 0291 because what a shop pays Matjar is not an operational permission.
-- Per-branch plan means per-branch billing entities, per-branch invoices and a
-- pricing decision about whether a second branch is a second subscription. That
-- is a commercial call, not a schema one, and the schema should not quietly
-- make it. Branches stay gated by the store's plan (enforce_branch_plan, still
-- untouched).
--
-- Everything below is additive: two nullable/defaulted columns and one new
-- table. No deployed function signature changes and no existing policy changes.

-- ---- Per-branch hours -------------------------------------------------------

alter table public.store_locations
  add column if not exists hours jsonb;

comment on column public.store_locations.hours is
  'Per-branch business hours, same jsonb shape as stores.hours (keys "0".."6" = '
  'JS weekday -> {open,close}). NULL means this branch inherits the store hours.';

-- ---- The merchant's own declaration -----------------------------------------

alter table public.stores
  add column if not exists branch_stock_separate boolean not null default false;

comment on column public.stores.branch_stock_separate is
  'Merchant-declared: true when this store''s branches hold physically separate '
  'stock, false when they share one pool. Default false — the truth for every '
  'store at the time this landed. Advisory only today: it drives disclosure in '
  'the branches module and records demand. It does NOT change how stock is '
  'decremented; products.stock is still the single pool for every sale.';

-- ---- Per-branch stock: the table, and nothing that pretends it works ---------

create table if not exists public.product_branch_stock (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  location_id uuid not null references public.store_locations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Variants carry their own stock (0073), so per-branch has to reach that
  -- granularity too or it would be right for simple products and wrong for the
  -- rest. NULL = the product's own stock rather than any variant's.
  variant_id uuid references public.product_variants (id) on delete cascade,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULLS NOT DISTINCT so the variant-less row for a product collides with itself
-- instead of being insertable a hundred times (PG15+; production is 17.6).
create unique index if not exists product_branch_stock_unique
  on public.product_branch_stock (location_id, product_id, variant_id)
  nulls not distinct;
create index if not exists product_branch_stock_store_idx
  on public.product_branch_stock (store_id);
create index if not exists product_branch_stock_product_idx
  on public.product_branch_stock (product_id);

comment on table public.product_branch_stock is
  'Per-branch stock ledger for ISS-023. INERT as of migration 0301: no policy '
  'path writes it, no application code reads it, and no trigger consults it. '
  'products.stock remains authoritative for every sale. Before this table can '
  'become authoritative, four things must land together: (1) a branch-aware '
  'inbound path — adjust_stock and receive_stock are branch-blind and must gain '
  'NEW functions rather than extra parameters, which would create ambiguous '
  'overloads (see 0289); (2) decrement_product_stock reading orders.location_id '
  'off new.order_id; (3) restore_stock_on_cancel, retake_stock_on_reactivate '
  'and the inline decrement in pos_record_sale moved in the same change, or the '
  'ledger drifts on the first cancellation; (4) the storefront showing '
  'branch-specific availability, or the customer still learns about the '
  'shortfall at submit instead of before choosing a branch.';

-- store_id is denormalised so RLS does not have to join products on every row —
-- the same shape stock_movements already uses. A guard keeps it honest, and
-- keeps a row from pointing at a product in one store and a branch in another.
create or replace function public.guard_branch_stock_store()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.store_id = new.store_id
  ) then
    raise exception 'product_not_in_store';
  end if;
  if not exists (
    select 1 from public.store_locations l
    where l.id = new.location_id and l.store_id = new.store_id
  ) then
    raise exception 'location_not_in_store';
  end if;
  if new.variant_id is not null and not exists (
    select 1 from public.product_variants v
    where v.id = new.variant_id and v.product_id = new.product_id
  ) then
    raise exception 'variant_not_on_product';
  end if;
  return new;
end $$;

create trigger product_branch_stock_guard_store
  before insert or update on public.product_branch_stock
  for each row execute function public.guard_branch_stock_store();

create trigger product_branch_stock_set_updated_at
  before update on public.product_branch_stock
  for each row execute function public.set_updated_at();

alter table public.product_branch_stock enable row level security;

-- staff_can(store_id,'inventory'), not can_manage_store. can_manage_store is
-- true for ANY staff row regardless of the toggles the owner set, which is the
-- bug 0291 fixed on five tables; 'inventory' is a real grantable key (it is in
-- PERM_KEYS in staff-manager.tsx) and staff_can already returns true for the
-- owner, so the owner path needs no separate clause. Read is staff-only: branch
-- quantities are not public today and nothing public should start reading them
-- by accident.
create policy product_branch_stock_select on public.product_branch_stock for select
  using (public.staff_can(store_id, 'inventory') or public.is_super_admin());
create policy product_branch_stock_insert on public.product_branch_stock for insert
  with check (public.staff_can(store_id, 'inventory'));
create policy product_branch_stock_update on public.product_branch_stock for update
  using (public.staff_can(store_id, 'inventory'))
  with check (public.staff_can(store_id, 'inventory'));
create policy product_branch_stock_delete on public.product_branch_stock for delete
  using (public.staff_can(store_id, 'inventory'));
