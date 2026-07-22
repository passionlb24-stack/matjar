-- Let the public SELECT sold/expired listings (in addition to active) so the
-- market detail page can show a "Sold"/"Expired" label instead of a 404.
-- Draft/pending/rejected stay private to the seller + admins. The grid query
-- still filters status='active', so sold/expired don't clutter the grid.
drop policy if exists listings_select_public on public.listings;
create policy listings_select_public on public.listings
  for select using (
    status in ('active', 'sold', 'expired')
    or seller_id = (select auth.uid())
    or public.is_super_admin()
  );
