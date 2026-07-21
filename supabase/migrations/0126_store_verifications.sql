-- Certifications & licences a business can present on its public profile. Two
-- distinct concepts, deliberately kept apart: a merchant may SUBMIT documents
-- (status stays 'submitted' — shown publicly as "provided by the business, not
-- reviewed"), and only a platform admin can move a row to 'verified' (the earned
-- badge). Uploading a document never grants the badge on its own.
-- Applied to production via Supabase migration `store_verifications`.

create table public.store_verifications (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  kind        text not null default 'license',   -- license | certification | award | membership
  title       text not null,
  issuer      text,
  number      text,
  issued_on   date,
  expires_on  date,
  doc_url     text,
  verify_url  text,
  status      text not null default 'submitted',  -- submitted | verified | rejected
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index store_verifications_store_idx on public.store_verifications (store_id);

alter table public.store_verifications enable row level security;

-- Anyone can read (public profile). The store's managers can create/edit their
-- own rows; only super admins can flip status to 'verified'. (Status is locked to
-- 'submitted' on the merchant path in the app layer; the admin policy is what
-- grants the badge.)
create policy store_verifications_public_read on public.store_verifications
  for select using (true);

create policy store_verifications_manage on public.store_verifications
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));

create policy store_verifications_admin on public.store_verifications
  for all using (is_super_admin()) with check (is_super_admin());
