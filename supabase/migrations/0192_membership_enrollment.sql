-- 0192: Membership (Model L) + course enrollment. store_membership_plans (0129)
-- and store_courses (0134) were price cards with a WhatsApp hand-off that wrote
-- no row. This adds real on-platform records: a customer subscribes / enrolls,
-- the owner is notified, and both sides have a ledger. Additive only.

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid not null references public.store_membership_plans(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text,
  phone text,
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists store_memberships_store_idx on public.store_memberships (store_id, created_at desc);
create index if not exists store_memberships_customer_idx on public.store_memberships (customer_id);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  course_id uuid not null references public.store_courses(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text,
  phone text,
  status text not null default 'enrolled',
  created_at timestamptz not null default now()
);
create index if not exists course_enrollments_store_idx on public.course_enrollments (store_id, created_at desc);
create index if not exists course_enrollments_customer_idx on public.course_enrollments (customer_id);

alter table public.store_memberships enable row level security;
alter table public.course_enrollments enable row level security;

drop policy if exists memberships_select on public.store_memberships;
create policy memberships_select on public.store_memberships for select
  using (public.can_manage_store(store_id) or customer_id = auth.uid());
drop policy if exists memberships_update_store on public.store_memberships;
create policy memberships_update_store on public.store_memberships for update
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

drop policy if exists enrollments_select on public.course_enrollments;
create policy enrollments_select on public.course_enrollments for select
  using (public.can_manage_store(store_id) or customer_id = auth.uid());
drop policy if exists enrollments_update_store on public.course_enrollments;
create policy enrollments_update_store on public.course_enrollments for update
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

-- Subscribe to a membership plan. Signed-in customers only; computes ends_on
-- from the plan period; one active membership per plan/customer.
create or replace function public.subscribe_membership(
  p_plan_id uuid, p_name text, p_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_store uuid; v_owner uuid; v_store_name text;
  v_period text; v_plan_name text; v_ends date;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login_required'; end if;
  select p.store_id, p.period, p.name into v_store, v_period, v_plan_name
    from public.store_membership_plans p where p.id = p_plan_id and p.active;
  if v_store is null then raise exception 'plan_not_found'; end if;

  if exists (select 1 from public.store_memberships
             where plan_id = p_plan_id and customer_id = v_uid and status = 'active') then
    raise exception 'already_subscribed';
  end if;

  v_ends := case v_period
    when 'monthly'   then current_date + interval '1 month'
    when 'quarterly' then current_date + interval '3 months'
    when 'yearly'    then current_date + interval '1 year'
    else null end;

  insert into public.store_memberships (store_id, plan_id, customer_id, customer_name, phone, ends_on)
  values (v_store, p_plan_id, v_uid, nullif(trim(coalesce(p_name,'')),''),
          nullif(trim(coalesce(p_phone,'')),''), v_ends)
  returning id into v_id;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'membership_new', jsonb_build_object(
    'membership_id', v_id, 'store_id', v_store, 'store_name', v_store_name, 'plan_name', v_plan_name));
  return v_id;
end; $$;

grant execute on function public.subscribe_membership(uuid, text, text) to authenticated;

-- Enroll in a course. Signed-in customers only; one active enrollment per course.
create or replace function public.enroll_course(
  p_course_id uuid, p_name text, p_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_store uuid; v_owner uuid; v_store_name text; v_course_name text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login_required'; end if;
  select c.store_id, c.name into v_store, v_course_name
    from public.store_courses c where c.id = p_course_id and c.active;
  if v_store is null then raise exception 'course_not_found'; end if;

  if exists (select 1 from public.course_enrollments
             where course_id = p_course_id and customer_id = v_uid and status = 'enrolled') then
    raise exception 'already_enrolled';
  end if;

  insert into public.course_enrollments (store_id, course_id, customer_id, customer_name, phone)
  values (v_store, p_course_id, v_uid, nullif(trim(coalesce(p_name,'')),''),
          nullif(trim(coalesce(p_phone,'')),''))
  returning id into v_id;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_store;
  insert into public.notifications (user_id, type, data)
  values (v_owner, 'enroll_new', jsonb_build_object(
    'enrollment_id', v_id, 'store_id', v_store, 'store_name', v_store_name, 'course_name', v_course_name));
  return v_id;
end; $$;

grant execute on function public.enroll_course(uuid, text, text) to authenticated;
