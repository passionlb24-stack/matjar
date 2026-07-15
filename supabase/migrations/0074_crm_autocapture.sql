-- CRM auto-capture: every booking and order automatically files the customer
-- into the merchant's store_customers book (user request: "لما احجز موعد لازم
-- اسمي ومعلوماتي ينحطوا تلقائياً ضمن الزبائن").
--
-- bookings and orders share the same contact columns (store_id, customer_id,
-- customer_name, phone), so ONE trigger function serves both. Name/phone fall
-- back to the customer's profile when the row lacks them. Dedup: by phone via
-- the partial unique index when a phone exists, else by case-insensitive name.
create or replace function public.crm_capture_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_phone text;
begin
  select coalesce(nullif(trim(new.customer_name), ''), p.full_name),
         coalesce(nullif(trim(new.phone), ''), nullif(trim(p.phone), ''))
    into v_name, v_phone
  from (select 1) one
  left join public.profiles p on p.id = new.customer_id;

  if v_name is null and v_phone is null then
    return new;
  end if;
  v_name := coalesce(v_name, v_phone);

  if v_phone is not null then
    insert into public.store_customers (store_id, name, phone)
    values (new.store_id, v_name, v_phone)
    on conflict (store_id, phone) where phone is not null do nothing;
  elsif not exists (
    select 1 from public.store_customers c
    where c.store_id = new.store_id and lower(c.name) = lower(v_name)
  ) then
    insert into public.store_customers (store_id, name)
    values (new.store_id, v_name);
  end if;

  return new;
end $$;
revoke execute on function public.crm_capture_contact() from public, anon, authenticated;

drop trigger if exists bookings_crm_capture on public.bookings;
create trigger bookings_crm_capture
  after insert on public.bookings
  for each row execute function public.crm_capture_contact();

drop trigger if exists orders_crm_capture on public.orders;
create trigger orders_crm_capture
  after insert on public.orders
  for each row execute function public.crm_capture_contact();
