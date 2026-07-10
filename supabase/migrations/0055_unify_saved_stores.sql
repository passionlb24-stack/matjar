-- Unify the two "save a store" features. `favorites` (a bookmark, keyed by
-- customer_id) and `follows` (a subscription that drives new-product
-- notifications, keyed by user_id) were separate tables for the same user→store
-- relationship, surfaced as two buttons and two pages — confusing UX. The app
-- now uses `follows` everywhere (the heart on cards + the store follow button
-- both write to it; /favorites lists it; /following redirects to /favorites).
--
-- Fold any existing favorites into follows, then drop the redundant table.
-- IMPORTANT: apply this only AFTER the code that stops reading `favorites` is
-- deployed, so no live request hits a missing table.

insert into public.follows (user_id, store_id, created_at)
select customer_id, store_id, created_at
from public.favorites
on conflict (user_id, store_id) do nothing;

-- Dropping the table also removes its policies and indexes.
drop table if exists public.favorites;
