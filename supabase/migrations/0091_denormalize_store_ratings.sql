-- Denormalize store ratings onto the store row.
--
-- WHY: listings previously attached ratings by querying public.reviews for every
-- store on the page and averaging in JS (src/lib/data/stores.ts#attachRatings) —
-- an extra round-trip whose cost grows with review volume, run on the explore,
-- category, search AND homepage-featured paths. Keeping an always-current average
-- + count ON each store row turns that into two plain column reads with no extra
-- query. A trigger recomputes the columns from the source-of-truth reviews table
-- on every insert/update/delete, so the denormalized values can never drift.

alter table public.stores
  add column if not exists rating_avg numeric(3,2) not null default 0,
  add column if not exists rating_count int not null default 0;

-- Recompute a store's rating aggregates from the reviews table.
--
-- SECURITY DEFINER: this fires as the reviewing customer (an `authenticated`
-- role who owns their review but has NO update rights on the store row), so it
-- must run as the function owner to write the rollup back. That is the whole
-- reason denormalization needs a trigger rather than a client write.
--
-- search_path pinned to '' per the codebase hardening convention — every table
-- reference is schema-qualified. count()/avg() over zero matching reviews return
-- 0/NULL, and coalesce maps that back to 0/0, so deleting a store's last review
-- correctly resets it (not left stale).
create or replace function public.sync_store_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_store uuid;
begin
  -- Which store(s) this change touched. DELETE/UPDATE affect the review's OLD
  -- store; INSERT/UPDATE affect its NEW store. A review could be re-pointed to a
  -- different store on UPDATE, so refresh BOTH when store_id actually moved.
  -- Branch on TG_OP so OLD is only read for DELETE/UPDATE and NEW only for
  -- INSERT/UPDATE (never dereference the record that does not exist for the op).
  if tg_op = 'DELETE' then
    v_ids := array[old.store_id];
  elsif tg_op = 'INSERT' then
    v_ids := array[new.store_id];
  elsif new.store_id is distinct from old.store_id then
    v_ids := array[old.store_id, new.store_id];
  else
    v_ids := array[new.store_id];
  end if;

  foreach v_store in array v_ids loop
    update public.stores s set
      rating_count = coalesce(agg.cnt, 0),
      rating_avg   = coalesce(agg.avg, 0)
    from (
      select count(*)::int as cnt, round(avg(rating), 2) as avg
      from public.reviews
      where store_id = v_store
    ) agg
    where s.id = v_store;
  end loop;

  return null; -- AFTER row trigger: return value is ignored
end $$;
revoke execute on function public.sync_store_rating() from public, anon, authenticated;

drop trigger if exists reviews_sync_store_rating on public.reviews;
create trigger reviews_sync_store_rating
  after insert or update or delete on public.reviews
  for each row execute function public.sync_store_rating();

-- Backfill existing stores from current reviews. Stores with no reviews are not
-- in the grouped result and keep the column defaults (0 / 0). reviews_store_id_idx
-- (migration 0009) already indexes both this grouped scan and the per-store
-- recompute inside the trigger.
update public.stores s set
  rating_count = coalesce(agg.cnt, 0),
  rating_avg   = coalesce(agg.avg, 0)
from (
  select store_id, count(*)::int as cnt, round(avg(rating), 2) as avg
  from public.reviews
  group by store_id
) agg
where agg.store_id = s.id;
