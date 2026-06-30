-- Phase 2 — public storage bucket for store logos, covers, and product images.
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- No SELECT policy: a public bucket serves objects via public URL without one.
-- A broad SELECT policy would let clients list every filename in the bucket.

-- Signed-in users can upload.
create policy "store_assets_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets');

-- Uploaders can replace or remove their own files.
create policy "store_assets_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and owner = auth.uid());

create policy "store_assets_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and owner = auth.uid());
