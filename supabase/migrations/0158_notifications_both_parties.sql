-- Make booking/order notifications reach BOTH parties.
-- Gaps fixed: (1) customer got no confirmation when placing a booking/order;
-- (2) a status change only ever notified the customer, so when the CUSTOMER
-- cancelled, the merchant was never told. Now every status change notifies the
-- counterparty (whoever didn't make the change, via auth.uid()).

create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id = new.store_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, data)
    values (v_owner, 'booking_new', jsonb_build_object('booking_id', new.id));
  end if;
  if new.customer_id is not null and new.customer_id is distinct from v_owner then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'booking_placed', jsonb_build_object('booking_id', new.id));
  end if;
  return new;
end; $$;

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id = new.store_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, data)
    values (v_owner, 'order_new', jsonb_build_object('order_id', new.id));
  end if;
  if new.customer_id is not null and new.customer_id is distinct from v_owner then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'order_placed', jsonb_build_object('order_id', new.id));
  end if;
  return new;
end; $$;

create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_actor uuid;
begin
  if new.status is distinct from old.status then
    v_actor := auth.uid();
    select owner_id into v_owner from public.stores where id = new.store_id;
    if new.customer_id is not null and new.customer_id is distinct from v_actor then
      insert into public.notifications (user_id, type, data)
      values (new.customer_id, 'booking_status',
              jsonb_build_object('booking_id', new.id, 'status', new.status));
    end if;
    if v_owner is not null and v_owner is distinct from v_actor then
      insert into public.notifications (user_id, type, data)
      values (v_owner, 'booking_status_merchant',
              jsonb_build_object('booking_id', new.id, 'status', new.status));
    end if;
  end if;
  return new;
end; $$;

create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_actor uuid;
begin
  if new.status is distinct from old.status then
    v_actor := auth.uid();
    select owner_id into v_owner from public.stores where id = new.store_id;
    if new.customer_id is not null and new.customer_id is distinct from v_actor then
      insert into public.notifications (user_id, type, data)
      values (new.customer_id, 'order_status',
              jsonb_build_object('order_id', new.id, 'status', new.status));
    end if;
    if v_owner is not null and v_owner is distinct from v_actor then
      insert into public.notifications (user_id, type, data)
      values (v_owner, 'order_status_merchant',
              jsonb_build_object('order_id', new.id, 'status', new.status));
    end if;
  end if;
  return new;
end; $$;

-- Push mapping: add booking_placed / order_placed / booking_status_merchant /
-- order_status_merchant (all existing cases preserved).
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_placed' then v_title := 'تمّ استلام طلبك ✅'; v_body := 'طلبك قيد المعالجة عند التاجر'; v_url := '/ar/orders';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'order_status_merchant' then v_title := 'تحديث طلب 🛒'; v_body := 'تغيّرت حالة طلب على متجرك'; v_url := '/ar/merchant';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_placed' then v_title := 'تمّ استلام حجزك ✅'; v_body := 'حجزك قيد تأكيد التاجر'; v_url := '/ar/bookings';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'booking_status_merchant' then v_title := 'تحديث حجز 📅'; v_body := 'تغيّرت حالة حجز على متجرك'; v_url := '/ar/merchant';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'store_new' then v_title := 'متجر جديد بانتظار المراجعة 🏪'; v_body := coalesce(new.data->>'store_name','متجر جديد') || ' — راجعه ووافق عليه'; v_url := '/ar/admin/stores';
    when 'price_drop' then v_title := 'انخفض السعر 🔻'; v_body := coalesce(new.data->>'product_name','منتج بقائمة رغباتك') || ' صار بسعر ' || coalesce(new.data->>'new_price','أقل') || ' — نزّل سعره'; v_url := coalesce('/ar/product/'||(new.data->>'product_id'), '/ar/wishlist');
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    when 'automation' then v_title := coalesce(new.data->>'title','متجر'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    when 'store_campaign' then v_title := coalesce(new.data->>'title','متجر'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
