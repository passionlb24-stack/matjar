-- MP-012 said a reviewer could repoint product_reviews.product_id, and that the
-- moved review would carry a stale verified = true from an unrelated purchase.
-- Half of that is already fixed: 0273 made the verified trigger BEFORE INSERT OR
-- UPDATE, and I confirmed it recomputes to false on a repoint.
--
-- The other half is real, and testing it turned up two more the ticket did not
-- mention. All three review tables let the author move a review onto a different
-- subject after the fact:
--
--   product_reviews  product_id   UPDATE policy has no WITH CHECK, so USING is
--                                 used as the check and it only constrains
--                                 customer_id.
--   reviews          store_id     guard_review_columns pins store_id for the shop
--                                 owner but returns early for the author, who was
--                                 never the one suspected.
--   craft_reviews    provider_id  WITH CHECK is present but only repeats the
--                                 customer_id test.
--
-- Confirmed against production data inside a rolled-back transaction: a real
-- review was moved to a different product, and a real store review to a different
-- shop. Both succeeded before this migration.
--
-- Why it matters more for stores than for products: the insert policies are the
-- expensive part of an honest review — a completed order with that shop, a
-- completed craft request with that provider, a rate limit. Repointing keeps the
-- rating and throws the earning away, so one legitimate purchase mints a review
-- that can be aimed anywhere. Store ratings feed ranking, so the cheapest attack
-- was: buy once, five-star yourself, or one-star a competitor.
--
-- The fix is to pin the parent key rather than to forbid UPDATE. A review's words
-- and its rating stay editable, which is the whole point of being able to edit a
-- review. Only what it is a review OF becomes immutable.
--
-- Safe against the deployed build, checked before applying: the only review UPDATE
-- the app performs is the owner's reply, and review-form.tsx upserts on
-- (store_id, customer_id) — an upsert that resolves to an update rewrites store_id
-- to the value it already had, so pinning it is a no-op there. customer_name is
-- deliberately NOT pinned for the author: that same upsert carries it, and a
-- person who changes their display name should see it change on their review.

create or replace function public.guard_review_columns()
returns trigger
language plpgsql
as $function$
begin
  -- Not a browser: a SECURITY DEFINER path or the postgres role. Those are
  -- trusted to write whatever they were asked to write.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- The author. Their words are theirs; the shop's answer is not, and neither is
  -- which shop they were reviewing.
  if old.customer_id is not distinct from auth.uid() then
    new.reply := old.reply;
    new.reply_at := old.reply_at;
    new.reply_by := old.reply_by;
    new.store_id := old.store_id;
    new.customer_id := old.customer_id;
    new.created_at := old.created_at;
    return new;
  end if;

  -- Anyone else who got through RLS is the owner (or an admin). They may write
  -- the reply and nothing else — a review whose text can be edited by its
  -- subject is not a review.
  new.rating := old.rating;
  new.comment := old.comment;
  new.customer_id := old.customer_id;
  new.customer_name := old.customer_name;
  new.store_id := old.store_id;
  new.created_at := old.created_at;

  -- Stamped here rather than trusted from the client, so "replied 3 months
  -- after the complaint" cannot be dressed up as same-day.
  if new.reply is distinct from old.reply then
    new.reply_at := case when btrim(coalesce(new.reply, '')) = '' then null else now() end;
    new.reply_by := case when btrim(coalesce(new.reply, '')) = '' then null else auth.uid() end;
    new.reply := nullif(btrim(new.reply), '');
  end if;

  return new;
end
$function$;

-- product_reviews and craft_reviews have no owner-reply path, so their guard is
-- only ever the identity pin.
create or replace function public.guard_product_review_subject()
returns trigger
language plpgsql
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.product_id := old.product_id;
  new.customer_id := old.customer_id;
  new.created_at := old.created_at;
  return new;
end
$function$;

drop trigger if exists product_reviews_guard_subject on public.product_reviews;
create trigger product_reviews_guard_subject
  before update on public.product_reviews
  for each row execute function public.guard_product_review_subject();

create or replace function public.guard_craft_review_subject()
returns trigger
language plpgsql
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.provider_id := old.provider_id;
  new.request_id := old.request_id;
  new.customer_id := old.customer_id;
  new.created_at := old.created_at;
  return new;
end
$function$;

drop trigger if exists craft_reviews_guard_subject on public.craft_reviews;
create trigger craft_reviews_guard_subject
  before update on public.craft_reviews
  for each row execute function public.guard_craft_review_subject();

-- The guards run BEFORE UPDATE, and product_reviews_verified is also BEFORE
-- UPDATE. Ordering is alphabetical by trigger name, so product_reviews_guard_subject
-- fires before product_reviews_verified: verified is recomputed against the pinned
-- product_id, not the one the client asked for. Named with that in mind.
