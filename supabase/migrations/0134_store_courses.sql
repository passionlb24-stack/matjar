-- Courses catalogue for the education sector: a public list of offered courses
-- (name, duration, schedule, level, price). Because there is no payment gateway,
-- "enroll" opens a pre-filled WhatsApp message (like memberships). Gated by the
-- "courses" feature module. Public read; store managers CRUD their own.
-- Applied to production via Supabase migration `store_courses`.

create table public.store_courses (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  name_en     text,
  description text,
  price       numeric,
  duration    text,
  schedule    text,
  level       text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index store_courses_store_idx on public.store_courses (store_id);

alter table public.store_courses enable row level security;
create policy store_courses_public_read on public.store_courses
  for select using (true);
create policy store_courses_manage on public.store_courses
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));
