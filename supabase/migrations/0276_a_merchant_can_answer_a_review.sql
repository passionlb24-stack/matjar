-- A merchant can be reviewed in public and has no way to answer.
--
-- Neither `reviews` nor `product_reviews` has a reply column — verified against
-- information_schema, not assumed. So the only options a shop has when a review
-- is wrong, or fair and already fixed, are to say nothing or to ask an admin to
-- delete it. Deletion is the wrong tool: it removes a customer's genuine account
-- of what happened, and a marketplace that resolves complaints by erasing them
-- has no trust to sell.
--
-- A reply is also the cheapest trust signal on the platform. It is the one thing
-- a reader can use to judge how a business behaves when something goes wrong,
-- which is what they are actually scanning reviews for.
--
-- WHO MAY WRITE WHAT
--
-- The interesting part is not adding a column, it is that two different people
-- now write to one row and neither may touch the other's words. RLS authorises
-- the ROW; it says nothing about columns. So the split is enforced by a guard,
-- the same SECURITY INVOKER shape as 0217 and 0272:
--
--   the customer  → rating, comment      (never the reply)
--   the owner     → reply                (never the rating or the comment)
--
-- Only `reviews` gains this. `product_reviews` is left alone deliberately: it
-- has no purchase requirement, so a reply surface there would be answering
-- people who may never have bought the product. That asymmetry is recorded in
-- 02_TRUST_AND_VERIFICATION.md and should be settled before it grows a UI.

alter table public.reviews
  add column if not exists reply text,
  add column if not exists reply_at timestamptz,
  add column if not exists reply_by uuid references auth.users(id);

comment on column public.reviews.reply is
  'The shop''s public answer. Written only by the store owner; the customer''s rating and comment are unwritable by them, and this column is unwritable by the customer.';

-- The owner may reach the row at all. What they may change is the guard's job.
drop policy if exists reviews_reply_owner on public.reviews;
create policy reviews_reply_owner on public.reviews
  for update
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

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

  -- The author. Their words are theirs; the shop's answer is not.
  if old.customer_id is not distinct from auth.uid() then
    new.reply := old.reply;
    new.reply_at := old.reply_at;
    new.reply_by := old.reply_by;
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

drop trigger if exists reviews_guard_columns on public.reviews;
create trigger reviews_guard_columns
  before update on public.reviews
  for each row execute function public.guard_review_columns();
