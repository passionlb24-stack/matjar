-- New-store onboarding fixes (from a real support case: a store creation that
-- never surfaced to the admin):
-- 1) Anyone who opens a store becomes a merchant (role was left as 'customer').
-- 2) Admins get an in-app + push notification when a store awaits review, so a
--    pending store is never silently missed.

create or replace function public.on_new_store()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Opening a store promotes the owner from customer to merchant.
  update public.profiles
    set role = 'merchant'
    where id = new.owner_id and role = 'customer';

  -- Notify every admin that a new store is pending approval.
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, data)
    select p.id, 'store_new',
           jsonb_build_object('store_id', new.id, 'store_name', new.name)
    from public.profiles p
    where p.role = 'super_admin';
  end if;

  return new;
end $$;
revoke execute on function public.on_new_store() from public, anon, authenticated;

drop trigger if exists stores_on_new on public.stores;
create trigger stores_on_new
  after insert on public.stores
  for each row execute function public.on_new_store();

-- Add the store_new case to the push mapping.
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'store_new' then v_title := 'متجر جديد بانتظار المراجعة 🏪'; v_body := coalesce(new.data->>'store_name','متجر جديد') || ' — راجعه ووافق عليه'; v_url := '/ar/admin/stores';
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
