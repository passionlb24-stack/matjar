-- Public trust-signal counts (SECURITY DEFINER so anon can read them; RLS
-- otherwise hides orders from non-owners). Aggregate counts only.
create or replace function public.product_sold_count(p_product_id uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id and o.status not in ('cancelled','rejected');
$$;
grant execute on function public.product_sold_count(uuid) to anon, authenticated;

create or replace function public.store_fulfilled_count(p_store_id uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.orders
  where store_id = p_store_id and status = 'completed';
$$;
grant execute on function public.store_fulfilled_count(uuid) to anon, authenticated;

-- Product Q&A: anyone asks, the product's store owner (or admin) answers.
create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  asker_name text,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists product_questions_product_idx
  on public.product_questions (product_id, created_at desc);
alter table public.product_questions enable row level security;

create policy product_questions_select_public on public.product_questions
  for select using (true);
create policy product_questions_insert_own on public.product_questions
  for insert with check (asker_id = (select auth.uid()) and public.user_is_active());
create policy product_questions_delete_own on public.product_questions
  for delete using (asker_id = (select auth.uid()) or public.is_super_admin());

create or replace function public.answer_product_question(p_qid uuid, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_store uuid;
begin
  select p.store_id into v_store
  from public.product_questions q join public.products p on p.id = q.product_id
  where q.id = p_qid;
  if not public.is_super_admin()
     and not exists (select 1 from public.stores s where s.id = v_store and s.owner_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.product_questions
    set answer = p_answer, answered_at = now() where id = p_qid;
end $$;
revoke execute on function public.answer_product_question(uuid, text) from public, anon;
grant execute on function public.answer_product_question(uuid, text) to authenticated;
