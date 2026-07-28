-- 0190: Lead engine. High-consideration sectors (real estate, automotive) are
-- directory-only; their correct transaction model is capturing a LEAD (inquiry
-- / viewing request / test-drive / offer), NOT a cart order or a clinic-style
-- appointment. Additive only: new enums + tables + two SECURITY DEFINER RPCs +
-- RLS. Nothing existing is touched.

do $$ begin
  create type public.lead_kind as enum
    ('contact','viewing','test_drive','offer','rental_inquiry');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum
    ('new','contacted','scheduled','negotiating','won','lost');
exception when duplicate_object then null; end $$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  kind public.lead_kind not null default 'contact',
  name text not null,
  phone text not null,
  message text,
  status public.lead_status not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_store_created_idx on public.leads (store_id, created_at desc);
create index if not exists leads_store_status_idx on public.leads (store_id, status);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  activity_type text not null,           -- created | status_changed | note | assigned
  note text,
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at);

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

-- Store managers read/update their own store's leads. Inserts go only through
-- create_lead() (security definer) — there is deliberately no public insert policy.
drop policy if exists leads_select_store on public.leads;
create policy leads_select_store on public.leads for select
  using (public.can_manage_store(store_id));

drop policy if exists leads_update_store on public.leads;
create policy leads_update_store on public.leads for update
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists lead_activities_select_store on public.lead_activities;
create policy lead_activities_select_store on public.lead_activities for select
  using (exists (
    select 1 from public.leads l
    where l.id = lead_id and public.can_manage_store(l.store_id)
  ));

-- Public inquiry capture (guest or signed-in), rate-limited, server-validated.
create or replace function public.create_lead(
  p_store_id uuid,
  p_product_id uuid,
  p_kind public.lead_kind,
  p_name text,
  p_phone text,
  p_message text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_owner uuid;
  v_store_name text;
  v_uid uuid := auth.uid();
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'missing_fields';
  end if;

  select owner_id, name into v_owner, v_store_name
    from public.stores
    where id = p_store_id and status = 'active' and deleted_at is null;
  if v_owner is null then raise exception 'store_not_found'; end if;

  if p_product_id is not null and not exists (
    select 1 from public.products
    where id = p_product_id and store_id = p_store_id and deleted_at is null
  ) then
    raise exception 'bad_product';
  end if;

  -- Rate limit: max 5 inquiries per phone per store per hour.
  if (select count(*) from public.leads
      where store_id = p_store_id
        and phone = trim(p_phone)
        and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.leads (store_id, product_id, customer_id, kind, name, phone, message)
  values (p_store_id, p_product_id, v_uid, coalesce(p_kind, 'contact'),
          trim(p_name), trim(p_phone),
          nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;

  insert into public.lead_activities (lead_id, actor_id, activity_type)
  values (v_id, v_uid, 'created');

  insert into public.notifications (user_id, type, data)
  values (v_owner, 'lead_new', jsonb_build_object(
    'lead_id', v_id, 'store_id', p_store_id, 'store_name', v_store_name, 'kind', coalesce(p_kind,'contact')));

  return v_id;
end; $$;

grant execute on function public.create_lead(uuid, uuid, public.lead_kind, text, text, text)
  to anon, authenticated;

-- Store manager moves a lead through its workflow (logs an activity row).
create or replace function public.update_lead_status(
  p_lead_id uuid,
  p_status public.lead_status,
  p_assigned_to uuid,
  p_note text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid;
  v_uid uuid := auth.uid();
begin
  select store_id into v_store from public.leads where id = p_lead_id;
  if v_store is null then raise exception 'not_found'; end if;
  if not public.can_manage_store(v_store) then raise exception 'forbidden'; end if;

  update public.leads set
    status = coalesce(p_status, status),
    assigned_to = p_assigned_to,
    last_contacted_at = case
      when p_status in ('contacted','scheduled','negotiating') then now()
      else last_contacted_at end,
    updated_at = now()
  where id = p_lead_id;

  insert into public.lead_activities (lead_id, actor_id, activity_type, note)
  values (p_lead_id, v_uid, 'status_changed',
          nullif(trim(coalesce(p_note, '')), ''));
end; $$;

grant execute on function public.update_lead_status(uuid, public.lead_status, uuid, text)
  to authenticated;
