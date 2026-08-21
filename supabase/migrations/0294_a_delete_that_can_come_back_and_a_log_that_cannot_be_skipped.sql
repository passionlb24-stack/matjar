-- 0294 — three things that were true of this database and should not have been:
--
--   1. The only record that an admin acted was written by the CLIENT, after the
--      fact, fire-and-forget (0151's log_admin_action + src/lib/audit.ts). A
--      client can simply not call it — admin-broadcast.tsx never did — and when
--      it did call it, the result was discarded. An audit trail that is
--      optional at the call site and silent on failure is not a trail.
--   2. Moderation removed user-generated content with a hard DELETE. One
--      misclick on a queue destroyed a merchant's listing or a customer's
--      review with no way back. `stores` has had deleted_at since 0003; the
--      rest of the user's work did not.
--   3. (Part 5, further down) There was no way for a customer to delete their
--      own account, only to ask us to over WhatsApp.
--
-- The shape of the fix for (1) and (2) is one thing, not two: the removal and
-- the record of the removal happen inside a single SECURITY DEFINER function,
-- in one transaction. The record cannot be skipped because there is no code
-- path that removes the row without it, and it cannot silently fail because a
-- failed insert rolls the removal back.


-- ---------------------------------------------------------------------------
-- Part 1 — soft delete for the five tables that hold somebody else's work
-- ---------------------------------------------------------------------------
-- Chosen by "worst to lose, least recoverable": a listing, a review, a job
-- post, a gig and a wholesale offer are each a person's own writing, photos and
-- pricing, unrecoverable once gone. Taxonomy rows (cities, categories,
-- business types), CMS pages, academy entries and delivery companies are
-- admin-authored reference data that can be retyped in a minute, and are left
-- on hard delete deliberately — see the report / ISS-015 notes.
--
-- Column name and semantics copied from public.stores, not reinvented: a
-- nullable timestamptz, NULL meaning live.

alter table public.listings           add column if not exists deleted_at timestamptz;
alter table public.reviews            add column if not exists deleted_at timestamptz;
alter table public.job_postings       add column if not exists deleted_at timestamptz;
alter table public.gigs               add column if not exists deleted_at timestamptz;
alter table public.wholesale_products add column if not exists deleted_at timestamptz;

-- Partial indexes on the live rows only: every read path below filters
-- `deleted_at is null`, and a partial index keeps that filter free while
-- staying small (soft-deleted rows are expected to be a rounding error).
create index if not exists listings_live_idx
  on public.listings (status, created_at desc) where deleted_at is null;
create index if not exists reviews_live_store_idx
  on public.reviews (store_id) where deleted_at is null;
create index if not exists job_postings_live_idx
  on public.job_postings (status, created_at desc) where deleted_at is null;
create index if not exists gigs_live_idx
  on public.gigs (status, created_at desc) where deleted_at is null;
create index if not exists wholesale_live_idx
  on public.wholesale_products (status, created_at desc) where deleted_at is null;


-- ---------------------------------------------------------------------------
-- Part 2 — every read path excludes soft-deleted rows, starting at RLS
-- ---------------------------------------------------------------------------
-- Doing this in the RLS SELECT policy rather than in 40 client queries is the
-- point: a read path added tomorrow is covered by default, and a read path
-- someone forgets to patch cannot leak a removed row. The application-side
-- `.is("deleted_at", null)` filters added alongside this migration are for the
-- admin queues only, which are the reads that deliberately bypass the
-- exclusion.
--
-- SAFE AGAINST THE DEPLOYED CODE: at the moment this runs, deleted_at is NULL
-- on every existing row, so every one of these predicates evaluates exactly as
-- it does today. Nothing disappears from the live site on apply. (The lesson
-- from the revoke that took reviews off every store page: a policy change must
-- be a no-op for the code that is already running.)
--
-- Visibility of a removed row follows the stores_select precedent exactly —
-- platform admins and the row's own author keep seeing it, the public does
-- not. Consequence worth naming: the author of a moderated review still sees
-- their own review on the store page and can still edit it, but nobody else
-- sees it. That is the same deal a merchant already gets for a soft-deleted
-- store, and inventing a second, stricter rule here would mean two patterns.

-- Both of these are re-derived from the LIVE pg_policies, not from a migration
-- file: 0292 moved admin write access off bare is_super_admin() and onto
-- admin_can(section) an hour before this was written, and 0287 is deliberately
-- unapplied, so the repo's history is not the state.
--
-- reviews_select_public was `using (true)` — everyone, always. The only thing
-- added is the soft-delete exclusion; the escape hatch is admin_can('reviews'),
-- the same section /admin/reviews already gates on, rather than the
-- is_super_admin() that 0292 exists to stop using.
drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public on public.reviews
  for select using (
    deleted_at is null
    or public.admin_can('reviews')
    or (select auth.uid()) = customer_id
  );

-- listings_select_public keeps its three existing disjuncts; is_super_admin()
-- becomes admin_can('market') — a strict WIDENING, since admin_can returns true
-- for any super admin — because /admin/market is gated by
-- requireAdminSection("market") and a market sub-admin could open the queue but
-- not read the rows in it.
drop policy if exists listings_select_public on public.listings;
create policy listings_select_public on public.listings
  for select using (
    public.admin_can('market')
    or seller_id = (select auth.uid())
    or (status = any (array['active'::text, 'sold'::text, 'expired'::text])
        and deleted_at is null)
  );

drop policy if exists job_postings_select on public.job_postings;
create policy job_postings_select on public.job_postings
  for select using (
    (status = 'active' and deleted_at is null)
    or poster_id = (select auth.uid())
  );

drop policy if exists gigs_select on public.gigs;
create policy gigs_select on public.gigs
  for select using (
    (status = 'active' and deleted_at is null)
    or freelancer_id = (select auth.uid())
  );

drop policy if exists wholesale_select on public.wholesale_products;
create policy wholesale_select on public.wholesale_products
  for select using (
    (status = 'active' and deleted_at is null)
    or seller_id = (select auth.uid())
  );

-- The *_admin_select policies (0148/0149) are deliberately left alone: an admin
-- must be able to see a removed row to restore it.

-- SECURITY DEFINER readers bypass RLS entirely, so each one needs the filter
-- written out. These are the full set that name any of the five tables
-- (verified against pg_proc.prosrc, not against the migration history).

create or replace function public.browse_gigs(
  p_category text default null, p_region text default null,
  p_verified_only boolean default false, p_available_only boolean default false,
  p_max_days integer default null, p_max_price numeric default null,
  p_q text default null, p_limit integer default 48
) returns table(
  id uuid, title text, description text, category text, price numeric,
  delivery_days integer, revisions integer, includes jsonb, image_url text,
  gallery jsonb, region text, created_at timestamptz, available_until date,
  completed_count integer, rating_avg numeric, rating_count integer,
  freelancer_id uuid, freelancer_name text, freelancer_avatar text,
  freelancer_verified boolean, freelancer_since timestamptz
) language sql stable security definer set search_path = '' as $$
  select g.id, g.title, g.description, g.category, g.price, g.delivery_days,
         g.revisions, g.includes, g.image_url, g.gallery, g.region, g.created_at,
         g.available_until, g.completed_count, g.rating_avg, g.rating_count,
         g.freelancer_id,
         coalesce(nullif(btrim(p.full_name), ''), g.freelancer_name),
         p.avatar_url,
         coalesce(p.freelancer_verified, false),
         p.created_at
  from public.gigs g
  left join public.profiles p on p.id = g.freelancer_id
  where g.status = 'active'
    and g.deleted_at is null
    and (p_category is null or g.category = p_category)
    and (p_region is null or g.region = p_region)
    and (not p_verified_only or coalesce(p.freelancer_verified, false))
    and (not p_available_only
         or (g.available_until is not null and g.available_until >= current_date))
    and (p_max_days is null or g.delivery_days is null or g.delivery_days <= p_max_days)
    and (p_max_price is null or g.price is null or g.price <= p_max_price)
    and (
      p_q is null or btrim(p_q) = ''
      or g.title ilike '%' || btrim(p_q) || '%'
      or g.description ilike '%' || btrim(p_q) || '%'
      or coalesce(p.full_name, g.freelancer_name) ilike '%' || btrim(p_q) || '%'
    )
  order by coalesce(p.freelancer_verified, false) desc,
           (g.available_until is not null and g.available_until >= current_date) desc,
           g.completed_count desc,
           g.created_at desc
  limit greatest(1, least(coalesce(p_limit, 48), 96));
$$;

create or replace function public.gig_facets()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total',     count(*),
    'verified',  count(*) filter (where coalesce(p.freelancer_verified, false)),
    'available', count(*) filter (where g.available_until >= current_date),
    'rated',     count(*) filter (where g.rating_count > 0),
    'categories', coalesce((
      select jsonb_object_agg(cat, n) from (
        select g2.category as cat, count(*) as n
        from public.gigs g2
        where g2.status = 'active' and g2.deleted_at is null and g2.category is not null
        group by g2.category
      ) c
    ), '{}'::jsonb),
    'regions', coalesce((
      select jsonb_object_agg(reg, n) from (
        select g3.region as reg, count(*) as n
        from public.gigs g3
        where g3.status = 'active' and g3.deleted_at is null and g3.region is not null
        group by g3.region
      ) r
    ), '{}'::jsonb)
  )
  from public.gigs g
  left join public.profiles p on p.id = g.freelancer_id
  where g.status = 'active' and g.deleted_at is null;
$$;

create or replace function public.public_lister_profile(p_user uuid)
returns table(
  id uuid, full_name text, avatar_url text, bio text, skills jsonb,
  gig_count integer, languages jsonb, freelancer_verified boolean,
  member_since timestamptz
) language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.avatar_url, p.bio, p.skills,
         (select count(*)::int from public.gigs g
          where g.freelancer_id = p.id and g.status = 'active' and g.deleted_at is null),
         p.languages,
         coalesce(p.freelancer_verified, false),
         p.created_at
  from public.profiles p
  where p.id = p_user
    and exists (
      select 1 from public.gigs g
      where g.freelancer_id = p.id and g.status = 'active' and g.deleted_at is null
    );
$$;

-- A removed listing must not accumulate views, and the nightly expiry sweep
-- must not churn rows nobody can see.
create or replace function public.increment_listing_view(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.listings set views = views + 1
  where id = p_id and status = 'active' and deleted_at is null;
$$;

create or replace function public.expire_stale_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.listings
    set status = 'expired', updated_at = now()
  where status = 'active'
    and deleted_at is null
    and created_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end; $$;

-- The denormalized store rating (0091) is the read path that would have been
-- missed. sync_store_rating already fires on UPDATE, so a soft delete
-- retriggers it — but its aggregate counted every review row, so removing an
-- abusive 1-star would have left the star rating unchanged. Only the aggregate
-- predicate changes; the OLD/NEW store-id handling is 0091's, untouched.
create or replace function public.sync_store_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_store uuid;
begin
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
      where store_id = v_store and deleted_at is null
    ) agg
    where s.id = v_store;
  end loop;

  return null;
end $$;
revoke execute on function public.sync_store_rating() from public, anon, authenticated;

-- rl_recent_listings / rl_recent_reviews are NOT filtered, on purpose: they are
-- abuse rate limits. If a soft delete decremented them, deleting your own spam
-- would reset your quota.


-- ---------------------------------------------------------------------------
-- Part 3 — the removal and its record, in one transaction
-- ---------------------------------------------------------------------------
-- Replaces the client-side pair of "DELETE, then maybe log it". Authorization
-- is per entity and follows 0292's section model — admin_can(section), not bare
-- is_super_admin() — because this function BECOMES the moderation path the
-- moment it ships. The queues no longer issue a DELETE, so if this guard were
-- stricter than the table's DELETE policy, 0292's work would apply only to a
-- path nothing calls and moderation would quietly go back to super-admin-only.
--   listing   -> admin_can('market')       (/admin/market, requireAdminSection)
--   review    -> admin_can('reviews')      (reviews_delete, as of 0292)
--   job       -> admin_can('jobs')         (job_postings_admin_delete)
--   gig       -> admin_can('freelance')    (gigs_admin_delete)
--   wholesale -> admin_can('wholesale')    (wholesale_admin_delete)
--
-- Note for whoever reads this next: listings_delete_own is still
-- `seller_id = auth.uid() OR is_super_admin()`. That is the hard-delete path,
-- which no admin surface calls any more; if it is ever revived it should be
-- moved onto admin_can('market') to match.
--
-- Unlike log_admin_action, this RAISES for a non-admin instead of returning
-- quietly. log_admin_action stays quiet because it is only a logger and a
-- silent no-op is the safe failure; this function performs a mutation, and a
-- mutation that silently does nothing is a lie to the caller.
--
-- The audit insert is the last statement, inside the same transaction as the
-- update. If it fails, the removal is rolled back. That is the right trade for
-- THIS action specifically: an admin whose click didn't take can click again,
-- but a merchant's listing that vanished with no record of who removed it is
-- precisely the incident the log exists to answer. Reversible actions (status
-- toggles, feature flags) keep using fire-and-forget log_admin_action, where
-- blocking the action on the logger would be the worse bargain.
create or replace function public.admin_soft_delete(
  p_entity text,
  p_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_allowed boolean;
  v_rows int;
begin
  if p_id is null then raise exception 'bad_id'; end if;

  v_allowed := case p_entity
    when 'listing'   then public.admin_can('market')
    when 'review'    then public.admin_can('reviews')
    when 'job'       then public.admin_can('jobs')
    when 'gig'       then public.admin_can('freelance')
    when 'wholesale' then public.admin_can('wholesale')
    else null
  end;

  if v_allowed is null then raise exception 'bad_entity'; end if;
  if not v_allowed then raise exception 'not_authorized'; end if;

  -- `and deleted_at is null` makes this idempotent-safe: a double click removes
  -- once and the second call raises not_found rather than rewriting the
  -- timestamp and logging a second removal that never happened.
  case p_entity
    when 'listing' then
      update public.listings set deleted_at = now()
        where id = p_id and deleted_at is null;
    when 'review' then
      update public.reviews set deleted_at = now()
        where id = p_id and deleted_at is null;
    when 'job' then
      update public.job_postings set deleted_at = now()
        where id = p_id and deleted_at is null;
    when 'gig' then
      update public.gigs set deleted_at = now()
        where id = p_id and deleted_at is null;
    when 'wholesale' then
      update public.wholesale_products set deleted_at = now()
        where id = p_id and deleted_at is null;
  end case;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'not_found'; end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'deleted', p_entity, p_id,
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('soft', true));
end $$;

revoke execute on function public.admin_soft_delete(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_soft_delete(text, uuid, jsonb) to authenticated;

-- The counterpart. Soft delete is only worth anything if something can undo it;
-- there is no restore UI (stores has none either — the admin queues filter
-- deleted rows out and recovery is an operator action), but recovery must not
-- require hand-written UPDATEs against a production table, and it must leave a
-- record of its own.
create or replace function public.admin_restore(
  p_entity text,
  p_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_allowed boolean;
  v_rows int;
begin
  if p_id is null then raise exception 'bad_id'; end if;

  v_allowed := case p_entity
    when 'listing'   then public.admin_can('market')
    when 'review'    then public.admin_can('reviews')
    when 'job'       then public.admin_can('jobs')
    when 'gig'       then public.admin_can('freelance')
    when 'wholesale' then public.admin_can('wholesale')
    else null
  end;

  if v_allowed is null then raise exception 'bad_entity'; end if;
  if not v_allowed then raise exception 'not_authorized'; end if;

  case p_entity
    when 'listing' then
      update public.listings set deleted_at = null
        where id = p_id and deleted_at is not null;
    when 'review' then
      update public.reviews set deleted_at = null
        where id = p_id and deleted_at is not null;
    when 'job' then
      update public.job_postings set deleted_at = null
        where id = p_id and deleted_at is not null;
    when 'gig' then
      update public.gigs set deleted_at = null
        where id = p_id and deleted_at is not null;
    when 'wholesale' then
      update public.wholesale_products set deleted_at = null
        where id = p_id and deleted_at is not null;
  end case;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'not_found'; end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'restored', p_entity, p_id, jsonb_build_object('soft', true));
end $$;

revoke execute on function public.admin_restore(text, uuid) from public, anon;
grant execute on function public.admin_restore(text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Part 4 — the broadcast records itself
-- ---------------------------------------------------------------------------
-- ISS-009. AdminBroadcast is the highest-blast-radius button in the product —
-- one click writes an in-app notification to every profile on the platform and
-- rides the 0049 bridge out to web push — and it was the one admin action with
-- no audit call at all.
--
-- The audit write goes HERE rather than in the API route or the client, because
-- here it is in the same transaction as the fan-out: the log row exists if and
-- only if the notifications were written. A route-level write could still
-- succeed while the broadcast failed, or fail while the broadcast succeeded;
-- there is no ordering of two separate round-trips that gives the guarantee
-- this gives for free.
--
-- Signature, return type, guards and audience semantics are unchanged from
-- 0171, so the currently-deployed /api/push/broadcast keeps working untouched.
create or replace function public.admin_broadcast_notify(
  p_title text,
  p_body text,
  p_url text default null,
  p_audience text default 'all'
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body  text := btrim(coalesce(p_body, ''));
  v_url   text := nullif(btrim(coalesce(p_url, '')), '');
  v_count int;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'not_authorized';
  end if;
  if v_body = '' then raise exception 'empty_body'; end if;
  if p_audience is null or p_audience not in ('all', 'merchants', 'customers') then
    raise exception 'bad_audience';
  end if;

  with recips as (
    select p.id from public.profiles p
    where case p_audience
      when 'merchants' then
        p.role = 'merchant'
        or exists (select 1 from public.stores s where s.owner_id = p.id)
      when 'customers' then p.role = 'customer'
      else true
    end
    limit 10000
  ),
  inserted as (
    insert into public.notifications (user_id, type, data)
    select r.id, 'admin_broadcast',
           jsonb_build_object('title', v_title, 'body', v_body, 'url', v_url)
    from recips r
    returning 1
  )
  select count(*)::int into v_count from inserted;

  -- What was sent, to whom, by whom, and how many it reached. The body is
  -- recorded in full: "an admin broadcast something" is not an answer to the
  -- question this log gets asked.
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'broadcast', 'message', null,
          jsonb_build_object(
            'audience', p_audience,
            'recipients', v_count,
            'title', v_title,
            'body', v_body,
            'url', v_url
          ));

  return v_count;
end $$;


-- ---------------------------------------------------------------------------
-- Part 5 — a customer can delete their own account (B-12)
-- ---------------------------------------------------------------------------
-- The privacy policy says a user may ASK us to delete their account, over
-- WhatsApp. Google Play's Data Safety form requires a self-serve route, and the
-- repo ships native shells, so this blocks the same launch the deep links do.
--
-- THE POLICY, and why. "Delete my account" is not one operation; the rows that
-- carry a user's id belong to three different people.
--
--   DELETED — theirs alone, nobody else's record depends on it. Their profile
--   (name, phone, avatar, bio, skills), saved addresses, favourites, wishlist,
--   follows, saved searches, notifications, push subscriptions and device
--   tokens, loyalty ledger, referrals, the marketplace listings / gigs / job
--   posts / wholesale offers they published, their conversations and the
--   messages inside them, and their abandoned-cart rows. Almost all of this
--   already cascades from auth.users; checkout_intents does not (it has no FK
--   at all, and it holds a phone number), so it is removed by hand below.
--
--   ANONYMISED — the row is somebody else's business record but the identity in
--   it is not. Orders keep their money, items, dates and status because that is
--   the merchant's book and, in Lebanon, their tax position; the name, phone,
--   address, delivery instructions and customer note come off, and customer_id
--   is severed. Store reviews, product reviews and product Q&A keep their text
--   and rating because other shoppers are relying on them and the store's
--   public rating is computed from them — a customer can withdraw their name
--   from a review, but deleting the review would silently rewrite a shop's
--   rating on the way out the door. audit_logs.actor_id and the other SET NULL
--   columns are severed by their own foreign keys.
--
--   RETAINED, unchanged, and stated plainly in the UI — the merchant's CRM row
--   (store_customers, created by their own trigger at checkout, and carrying a
--   money ledger in customer_transactions) survives. It is the same category as
--   the order itself: a business's record of a transaction that happened.
--
-- TWO REFUSALS, both because the alternative is worse than not deleting:
--
--   owns_store — stores.owner_id cascades. Deleting a merchant's account would
--   take the store, its products, its staff, and every ORDER OTHER CUSTOMERS
--   PLACED with it. There is already an escape hatch (transfer_store_ownership,
--   0169/0170); the UI sends them there. A self-serve route that quietly
--   destroyed other people's purchase history would not be a better answer to
--   the app stores.
--
--   open_orders — an order that is still pending / accepted / preparing /
--   ready / out_for_delivery cannot have its delivery address stripped without
--   stranding a real parcel and a merchant who has already been paid. The UI
--   tells them how many and asks them to come back once those close.

-- The five foreign keys that had no ON DELETE action at all. Any attempt to
-- remove a profile currently dies on order_events.actor_id — which is written
-- for ordinary customer actions, so this would have failed for almost every
-- real customer with an opaque constraint error. These become SET NULL: the
-- event, the payment line and the moderation stamp are records of something
-- that happened and should outlive the account; only the name on them goes.
--
-- Safe against deployed code: NO ACTION -> SET NULL changes behaviour only when
-- a referenced profile is deleted, which today is not something any deployed
-- path can do successfully.
alter table public.order_events
  drop constraint order_events_actor_id_fkey,
  add constraint order_events_actor_id_fkey
    foreign key (actor_id) references public.profiles (id) on delete set null;

alter table public.order_payments
  drop constraint order_payments_actor_id_fkey,
  add constraint order_payments_actor_id_fkey
    foreign key (actor_id) references public.profiles (id) on delete set null;

alter table public.reviews
  drop constraint reviews_reply_by_fkey,
  add constraint reviews_reply_by_fkey
    foreign key (reply_by) references auth.users (id) on delete set null;

alter table public.store_verifications
  drop constraint store_verifications_reviewed_by_fkey,
  add constraint store_verifications_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users (id) on delete set null;

alter table public.stores
  drop constraint stores_status_changed_by_fkey,
  add constraint stores_status_changed_by_fkey
    foreign key (status_changed_by) references auth.users (id) on delete set null;

-- The four that must stop cascading, so the anonymised row survives the user.
-- reviews / product_reviews / product_questions need their author column to
-- become nullable first; a null author is exactly what "the review stays, the
-- name goes" means, and the existing owner policies (auth.uid() = customer_id)
-- never match null, so an orphaned review is immutable except to an admin.
alter table public.orders
  drop constraint orders_customer_id_fkey,
  add constraint orders_customer_id_fkey
    foreign key (customer_id) references public.profiles (id) on delete set null;

alter table public.reviews alter column customer_id drop not null;
alter table public.reviews
  drop constraint reviews_customer_id_fkey,
  add constraint reviews_customer_id_fkey
    foreign key (customer_id) references public.profiles (id) on delete set null;

alter table public.product_reviews alter column customer_id drop not null;
alter table public.product_reviews
  drop constraint product_reviews_customer_id_fkey,
  add constraint product_reviews_customer_id_fkey
    foreign key (customer_id) references public.profiles (id) on delete set null;

alter table public.product_questions alter column asker_id drop not null;
alter table public.product_questions
  drop constraint product_questions_asker_id_fkey,
  add constraint product_questions_asker_id_fkey
    foreign key (asker_id) references public.profiles (id) on delete set null;

-- A record that the account existed and was deleted by its owner. Deliberately
-- holds NO personal data — just the id that used to exist and when — so it can
-- answer "did this person ask to be deleted, and did we do it?" without being
-- a copy of what we just erased.
create table if not exists public.account_deletions (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  orders_anonymised int not null default 0,
  reviews_anonymised int not null default 0,
  questions_anonymised int not null default 0
);
alter table public.account_deletions enable row level security;
drop policy if exists account_deletions_select_admin on public.account_deletions;
create policy account_deletions_select_admin on public.account_deletions
  for select to authenticated using (public.admin_can('audit'));

-- What the account screen shows BEFORE the confirmation, so the warning is the
-- truth about this specific account and not a generic paragraph. Read-only,
-- own-row only, takes no arguments — it can only ever describe the caller.
create or replace function public.my_account_deletion_preview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object(
    'stores', (select count(*)::int from public.stores
               where owner_id = v_uid and deleted_at is null),
    'open_orders', (select count(*)::int from public.orders
                    where customer_id = v_uid
                      and status in ('pending','accepted','preparing','ready','out_for_delivery')),
    'orders', (select count(*)::int from public.orders where customer_id = v_uid),
    'reviews', (select count(*)::int from public.reviews where customer_id = v_uid)
                + (select count(*)::int from public.product_reviews where customer_id = v_uid),
    'listings', (select count(*)::int from public.listings
                 where seller_id = v_uid and deleted_at is null),
    'addresses', (select count(*)::int from public.addresses where user_id = v_uid)
  );
end $$;
revoke execute on function public.my_account_deletion_preview() from public, anon;
grant execute on function public.my_account_deletion_preview() to authenticated;

-- The deletion itself.
--
-- SECURITY DEFINER and not a service-role route, deliberately. src/lib/supabase/
-- admin.ts sets the bar for a new service-role caller: there must be no session
-- that could carry the authority. Here there is one — auth.uid() IS the
-- entitlement, and it is the only entitlement, so the function never takes a
-- user id as an argument and cannot be pointed at somebody else. It also buys
-- atomicity that two round-trips cannot: the anonymisation, the cascade and the
-- auth.users delete either all happen or none do. A route that anonymised and
-- then failed to delete the login would leave an account nobody can identify
-- but anybody holding the password can still sign into.
--
-- p_confirm must be the account's own email address, so a stray call from a
-- console or a mis-wired button cannot delete an account by accident. The UI
-- makes the user type it.
create or replace function public.delete_my_account(p_confirm text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_stores int;
  v_open   int;
  v_orders int;
  v_revs   int;
  v_prevs  int;
  v_qs     int;
  v_gone   text := 'حساب محذوف';
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null then raise exception 'not_found'; end if;

  -- Case-insensitive and whitespace-tolerant; everything else must match.
  if lower(btrim(coalesce(p_confirm, ''))) is distinct from lower(btrim(v_email)) then
    raise exception 'confirm_mismatch';
  end if;

  select count(*) into v_stores from public.stores
    where owner_id = v_uid and deleted_at is null;
  if v_stores > 0 then raise exception 'owns_store'; end if;

  select count(*) into v_open from public.orders
    where customer_id = v_uid
      and status in ('pending','accepted','preparing','ready','out_for_delivery');
  if v_open > 0 then raise exception 'open_orders'; end if;

  -- ANONYMISE. This runs as the function owner, so the BEFORE UPDATE guards on
  -- reviews / product_reviews (which pin customer_id back to its old value for
  -- `authenticated` and `anon`, and would otherwise silently undo this) let it
  -- through: their opening `current_user not in ('authenticated','anon')`
  -- branch is exactly the door meant for a path like this one.
  update public.orders set
    customer_id = null,
    customer_name = v_gone,
    phone = null,
    address = null,
    delivery_instructions = null,
    customer_note = null
  where customer_id = v_uid;
  get diagnostics v_orders = row_count;

  update public.reviews
    set customer_id = null, customer_name = v_gone
    where customer_id = v_uid;
  get diagnostics v_revs = row_count;

  update public.product_reviews
    set customer_id = null, customer_name = v_gone
    where customer_id = v_uid;
  get diagnostics v_prevs = row_count;
  v_revs := v_revs + v_prevs;

  update public.product_questions
    set asker_id = null, asker_name = v_gone
    where asker_id = v_uid;
  get diagnostics v_qs = row_count;

  -- A review this account REPLIED to as a merchant (possible if they once owned
  -- a store and transferred it) keeps the reply text but loses the author id.
  update public.reviews set reply_by = null where reply_by = v_uid;

  -- Abandoned-cart rows: a phone number and a name with no foreign key holding
  -- them to anything, so nothing would cascade them away.
  delete from public.checkout_intents where customer_id = v_uid;

  insert into public.account_deletions
    (user_id, orders_anonymised, reviews_anonymised, questions_anonymised)
  values (v_uid, v_orders, v_revs, v_qs)
  on conflict (user_id) do nothing;

  -- DELETE. Everything still pointing at the user cascades from here: profiles
  -- (and through it addresses, favourites, follows, saved searches,
  -- notifications, loyalty, referrals, messages, listings, gigs, job posts,
  -- wholesale offers, push subscriptions, device tokens) plus auth's own
  -- sessions, identities and refresh tokens. Killing the refresh tokens is what
  -- makes the sign-out real: the access token the browser is holding is a
  -- stateless JWT and stays syntactically valid until it expires, but it can
  -- never be renewed, and every RLS policy keyed on auth.uid() now matches
  -- nothing. The client signs out on top of this so the cookie goes too.
  delete from auth.users where id = v_uid;

  return jsonb_build_object(
    'orders_anonymised', v_orders,
    'reviews_anonymised', v_revs,
    'questions_anonymised', v_qs
  );
end $$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
