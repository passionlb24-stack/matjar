-- 0193: Event ticketing (Model K). Events were directory-only; their correct
-- model is ticket types with capacity + attendee capture, not an hourly slot.
-- Additive only. Capacity is enforced atomically via a conditional UPDATE on
-- event_ticket_types.sold (null capacity = unlimited).

create table if not exists public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  name_en text,
  description text,
  price numeric not null default 0 check (price >= 0),
  capacity int check (capacity is null or capacity >= 0),  -- null = unlimited
  sold int not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_ticket_types_store_idx on public.event_ticket_types (store_id, sort_order);

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  attendee_name text not null,
  phone text not null,
  quantity int not null default 1 check (quantity between 1 and 50),
  status text not null default 'reserved',
  created_at timestamptz not null default now()
);
create index if not exists event_tickets_store_idx on public.event_tickets (store_id, created_at desc);
create index if not exists event_tickets_type_idx on public.event_tickets (ticket_type_id);

alter table public.event_ticket_types enable row level security;
alter table public.event_tickets enable row level security;

drop policy if exists ticket_types_public_read on public.event_ticket_types;
create policy ticket_types_public_read on public.event_ticket_types for select
  using (active = true or public.can_manage_store(store_id));
drop policy if exists ticket_types_manage on public.event_ticket_types;
create policy ticket_types_manage on public.event_ticket_types for all
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

drop policy if exists tickets_select on public.event_tickets;
create policy tickets_select on public.event_tickets for select
  using (public.can_manage_store(store_id) or customer_id = auth.uid());
drop policy if exists tickets_update_store on public.event_tickets;
create policy tickets_update_store on public.event_tickets for update
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

-- Buy tickets. Guest-capable; capacity enforced atomically (conditional UPDATE
-- of sold); notifies the owner.
create or replace function public.buy_tickets(
  p_type_id uuid, p_quantity int, p_name text, p_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_store uuid; v_type_name text; v_owner uuid; v_store_name text;
  v_qty int := greatest(coalesce(p_quantity, 1), 1);
  v_uid uuid := auth.uid();
  v_cap int; v_updated uuid;
begin
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_phone),'')='' then
    raise exception 'missing_fields';
  end if;

  select store_id, name, capacity into v_store, v_type_name, v_cap
    from public.event_ticket_types where id = p_type_id and active;
  if v_store is null then raise exception 'type_not_found'; end if;

  if v_cap is null then
    -- unlimited: just record the sale
    update public.event_ticket_types set sold = sold + v_qty, updated_at = now()
      where id = p_type_id returning id into v_updated;
  else
    update public.event_ticket_types set sold = sold + v_qty, updated_at = now()
      where id = p_type_id and sold + v_qty <= capacity returning id into v_updated;
    if v_updated is null then raise exception 'sold_out'; end if;
  end if;

  insert into public.event_tickets (store_id, ticket_type_id, customer_id, attendee_name, phone, quantity)
  values (v_store, p_type_id, v_uid, trim(p_name), trim(p_phone), v_qty)
  returning id into v_id;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'ticket_new', jsonb_build_object(
    'ticket_id', v_id, 'store_id', v_store, 'store_name', v_store_name,
    'type_name', v_type_name, 'quantity', v_qty));

  return v_id;
end; $$;

grant execute on function public.buy_tickets(uuid, int, text, text) to anon, authenticated;
