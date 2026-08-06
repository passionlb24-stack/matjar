-- 0225: take the scanned document out of everything a shopper can read.
--
-- store_verifications carries two very different things in one row: the claim
-- ("commercial registration no. X, issued by Y, verified") and the photograph
-- of the paperwork behind it. Its policies reflect only the first:
--
--   store_verifications_public_read   using (status = 'verified')
--   store_verifications_manage        using (can_manage_store(store_id) OR is_super_admin())
--
-- So anyone at all could send
--
--   GET /rest/v1/store_verifications?status=eq.verified&select=doc_url
--
-- and collect the document URL for every verified store on the platform. The
-- bucket those URLs point at is public, so each one opens. Not rendering the
-- image on the storefront does not help — the row was readable directly.
--
-- RLS is row-level; there is no way to let that policy return the row while
-- withholding one column. So the document moves to its own table, where the
-- only policy is the manage one. A shopper gets the claim and the verdict; the
-- paperwork is for the admin review queue and the merchant who uploaded it.
--
-- This matters more here than the column count suggests: the document people
-- photograph for this in Lebanon is a commercial registration, which routinely
-- carries the owner's full name, ID number and home address.
--
-- Zero rows exist today, which is why the column can simply be dropped rather
-- than dual-written through a deprecation. The backfill is written anyway so
-- the migration stays correct if it is ever replayed against real data.
--
-- Verified on production inside rolled-back transactions, with a planted row:
--   anon              → sees the claim (1), sees the document (0)
--   store owner       → sees the document (1)
--   other signed-in   → sees the document (0)

create table if not exists public.store_verification_docs (
  verification_id uuid primary key
    references public.store_verifications(id) on delete cascade,
  store_id  uuid not null references public.stores(id) on delete cascade,
  doc_url   text not null,
  created_at timestamptz not null default now()
);

comment on table public.store_verification_docs is
  'Scanned proof behind a store_verifications row. Separate table so the public '
  'read policy on store_verifications cannot reach it: shoppers get the claim '
  'and the verdict, the document is for the admin review queue only.';

create index if not exists store_verification_docs_store_idx
  on public.store_verification_docs (store_id);

alter table public.store_verification_docs enable row level security;

drop policy if exists store_verification_docs_manage on public.store_verification_docs;
create policy store_verification_docs_manage on public.store_verification_docs
  for all
  using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

insert into public.store_verification_docs (verification_id, store_id, doc_url)
select v.id, v.store_id, v.doc_url
from public.store_verifications v
where v.doc_url is not null
on conflict (verification_id) do nothing;

alter table public.store_verifications drop column if exists doc_url;
