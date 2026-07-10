-- Move addresses from one-row-per-user (PK user_id) to many-per-user:
-- each row gets its own id, an optional label ("Home"/"Work"), and an
-- is_default flag. Exactly one default per user is enforced by a partial
-- unique index. Existing single rows are preserved as the user's default.

alter table public.addresses
  add column if not exists id uuid not null default gen_random_uuid();
alter table public.addresses
  add column if not exists label text;
alter table public.addresses
  add column if not exists is_default boolean not null default false;

-- Promote each existing row to the user's default (safe: <=1 row per user today).
update public.addresses set is_default = true where is_default = false;

-- Swap the primary key from user_id to the new id.
alter table public.addresses drop constraint if exists addresses_pkey;
alter table public.addresses add constraint addresses_pkey primary key (id);

-- One default address per user; fast lookups by user.
create unique index if not exists addresses_one_default_per_user
  on public.addresses(user_id) where is_default;
create index if not exists addresses_user_id_idx
  on public.addresses(user_id);

-- Owners may delete their own addresses (select/insert/update policies already exist).
drop policy if exists addresses_delete_own on public.addresses;
create policy addresses_delete_own on public.addresses
  for delete to authenticated using (user_id = auth.uid());
