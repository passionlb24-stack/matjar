-- Service providers (electrician, plumber, cleaning, clinics doing home visits)
-- need more than "book a time slot": a customer describes a job at THEIR address,
-- the provider sends a quote, the customer accepts, then the job runs through a
-- lifecycle. Audit critical — bookings had no quote, no customer address, no job
-- status. This adds a dedicated service_requests entity + a coverage field.

alter table public.stores add column if not exists service_area text;

create type public.service_request_status as enum (
  'pending',      -- customer submitted, awaiting a quote
  'quoted',       -- provider sent a price
  'accepted',     -- customer accepted the quote
  'in_progress',  -- provider is on the job
  'completed',    -- job done
  'declined',     -- provider declined
  'cancelled'     -- customer cancelled
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete set null,
  customer_name text,
  phone text not null,
  address text,
  description text not null,
  status public.service_request_status not null default 'pending',
  quote_amount numeric(12, 2),
  quote_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_requests_store_idx on public.service_requests (store_id);
create index service_requests_customer_idx on public.service_requests (customer_id);

create trigger service_requests_set_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

alter table public.service_requests enable row level security;

-- Read: the provider (store managers), admins, and the requesting customer.
create policy service_requests_select on public.service_requests for select
  using (
    public.can_manage_store(store_id)
    or public.is_super_admin()
    or customer_id = (select auth.uid())
  );

-- Create: a signed-in customer files their own request. All state changes after
-- that go through the RPC below (no update/delete policies → direct writes denied).
create policy service_requests_insert on public.service_requests for insert
  with check (
    customer_id = (select auth.uid())
    and public.user_is_active()
    and length(trim(description)) > 0
    and length(trim(phone)) >= 4
  );

-- Drive the lifecycle with authority + transition checks. Providers quote/decline/
-- start/complete; customers accept/cancel. SECURITY DEFINER so it can read/write
-- rows the caller's RLS would otherwise restrict, after it checks who they are.
create or replace function public.manage_service_request(
  p_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid;
  v_customer uuid;
  v_status public.service_request_status;
  v_is_provider boolean;
  v_is_customer boolean;
begin
  select store_id, customer_id, status
  into v_store_id, v_customer, v_status
  from public.service_requests where id = p_id;
  if v_store_id is null then raise exception 'not_found'; end if;

  v_is_provider := public.can_manage_store(v_store_id) or public.is_super_admin();
  v_is_customer := v_customer is not null and v_customer = auth.uid();
  if not (v_is_provider or v_is_customer) then
    raise exception 'not_authorized';
  end if;

  if p_action = 'quote' and v_is_provider then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    update public.service_requests
      set status = 'quoted', quote_amount = p_amount,
          quote_note = nullif(trim(p_note), '')
      where id = p_id;
  elsif p_action = 'decline' and v_is_provider then
    update public.service_requests set status = 'declined' where id = p_id;
  elsif p_action = 'start' and v_is_provider then
    update public.service_requests set status = 'in_progress'
      where id = p_id and status = 'accepted';
  elsif p_action = 'complete' and v_is_provider then
    update public.service_requests set status = 'completed'
      where id = p_id and status in ('accepted', 'in_progress');
  elsif p_action = 'accept' and v_is_customer then
    update public.service_requests set status = 'accepted'
      where id = p_id and status = 'quoted';
  elsif p_action = 'cancel' and v_is_customer then
    update public.service_requests set status = 'cancelled'
      where id = p_id and status in ('pending', 'quoted', 'accepted');
  else
    raise exception 'bad_action';
  end if;
end; $$;

revoke execute on function
  public.manage_service_request(uuid, text, numeric, text) from public, anon;
grant execute on function
  public.manage_service_request(uuid, text, numeric, text) to authenticated;
