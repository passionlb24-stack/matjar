-- 0183: multi-store owners couldn't tell which store a "new booking"/"new
-- order" notification was for, and it dropped them on the generic dashboard.
-- Carry store_id + store_name (and the service/booking context) in the
-- notification data so the UI can label it and deep-link to that store's
-- bookings/orders page.

create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data)
  select s.owner_id, 'booking_new',
         jsonb_build_object(
           'booking_id', new.id,
           'store_id', s.id,
           'store_name', s.name,
           'service_name', new.service_name)
  from public.stores s where s.id = new.store_id;
  return new;
end; $$;

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_store_name text;
begin
  select owner_id, name into v_owner, v_store_name
    from public.stores where id = new.store_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, data)
    values (v_owner, 'order_new',
            jsonb_build_object(
              'order_id', new.id,
              'store_id', new.store_id,
              'store_name', v_store_name));
  end if;
  if new.customer_id is not null and new.customer_id is distinct from v_owner then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'order_placed', jsonb_build_object('order_id', new.id));
  end if;
  return new;
end; $$;
