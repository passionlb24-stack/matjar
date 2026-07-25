-- Per-order staff assignment + tags (Salla parity). A store with a team can
-- put an order on a specific person ("who's handling this") and label orders
-- with free-form tags ("gift", "call first", "wholesale") for triage.
--
-- Both are plain columns on orders; the existing orders_update_staff RLS policy
-- (owner or staff via can_manage_store) already governs writes, so no new
-- policy is needed.

alter table public.orders
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.orders
  add column if not exists tags text[] not null default '{}';

create index if not exists orders_assigned_to_idx
  on public.orders (assigned_to) where assigned_to is not null;

-- The assignable team for a store: the owner plus every staff member, with
-- display names. SECURITY DEFINER so the merchant page can show names without
-- reading other users' profile rows directly. Returns nothing to callers who
-- can't manage the store (guard in the WHERE clause — no leak, no error).
create or replace function public.store_team(p_store_id uuid)
returns table (user_id uuid, name text, role text)
language sql security definer set search_path = '' as $$
  select p.id,
         coalesce(nullif(trim(p.full_name), ''), '—'),
         'owner'::text
    from public.stores s
    join public.profiles p on p.id = s.owner_id
   where s.id = p_store_id
     and (public.can_manage_store(p_store_id) or public.is_super_admin())
  union
  select p.id,
         coalesce(nullif(trim(p.full_name), ''), nullif(trim(st.email), ''), '—'),
         coalesce(nullif(st.role, ''), 'staff')
    from public.store_staff st
    join public.profiles p on p.id = st.user_id
   where st.store_id = p_store_id
     and (public.can_manage_store(p_store_id) or public.is_super_admin());
$$;

revoke execute on function public.store_team(uuid) from public, anon;
grant execute on function public.store_team(uuid) to authenticated;
