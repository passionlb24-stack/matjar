-- Freelance vertical. Freelancers publish "gigs" (a service they offer with a
-- starting price + delivery time); clients browse and contact them via in-app
-- messaging (0061). No payment/escrow — coordination only.

create table if not exists public.gigs (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.profiles (id) on delete cascade,
  freelancer_name text,   -- denormalized (profiles RLS is own-only)
  title text not null,
  description text not null,
  category text,      -- design | photography | video | writing | voice | acting | programming | tutoring | other
  price numeric(12, 2),
  delivery_days int,
  image_url text,
  region text,
  status text not null default 'active', -- active | paused
  created_at timestamptz not null default now()
);
create index if not exists gigs_active_idx on public.gigs (status, created_at desc);
create index if not exists gigs_freelancer_idx on public.gigs (freelancer_id);

alter table public.gigs enable row level security;

-- Public reads active gigs; the freelancer sees + manages their own.
drop policy if exists gigs_select on public.gigs;
create policy gigs_select on public.gigs
  for select to public
  using (status = 'active' or freelancer_id = (select auth.uid()));
drop policy if exists gigs_insert on public.gigs;
create policy gigs_insert on public.gigs
  for insert to authenticated with check (freelancer_id = (select auth.uid()));
drop policy if exists gigs_update on public.gigs;
create policy gigs_update on public.gigs
  for update to authenticated
  using (freelancer_id = (select auth.uid())) with check (freelancer_id = (select auth.uid()));
drop policy if exists gigs_delete on public.gigs;
create policy gigs_delete on public.gigs
  for delete to authenticated using (freelancer_id = (select auth.uid()));
