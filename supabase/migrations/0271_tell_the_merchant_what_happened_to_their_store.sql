-- A merchant opens a shop, and then nothing ever tells them what became of it.
--
-- 0078 notifies every admin that a store is waiting, and that half works — there
-- are 24 such notifications in the data. The other half was never built. When
-- the store is approved, rejected or suspended, the only record is an audit log
-- the owner cannot see. They find out by logging in and noticing the dashboard
-- changed, or by asking.
--
-- Approval is the single most important message this platform sends a merchant:
-- it is the moment their shop becomes real. Rejection matters just as much and
-- is worse to leave silent, because the person is left waiting for an answer
-- that already came.
--
-- Nothing here notifies on the way into 'pending': that is store creation, and
-- 0078 already owns it.
create or replace function public.on_store_status_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_type text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_type := case new.status
    when 'active'    then 'store_approved'
    when 'rejected'  then 'store_rejected'
    when 'suspended' then 'store_suspended'
    else null
  end;

  -- Anything back to 'pending' is a re-review, not an outcome. Saying nothing
  -- beats telling someone their shop is "pending" as though it were news.
  if v_type is null then
    return new;
  end if;

  insert into public.notifications (user_id, type, data)
  values (
    new.owner_id,
    v_type,
    jsonb_build_object(
      'store_id', new.id,
      'store_name', new.name,
      'status', new.status
    )
  );

  return new;
end
$function$;

revoke execute on function public.on_store_status_change() from public, anon, authenticated;

drop trigger if exists stores_on_status_change on public.stores;
create trigger stores_on_status_change
  after update of status on public.stores
  for each row execute function public.on_store_status_change();

-- The push copy. Rebuilt whole because plpgsql has no way to add a branch to an
-- existing case, and taken from the live definition so no earlier type is lost.
create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
    -- The message that makes a shop real. It names the shop, because an owner
    -- with more than one needs to know which.
    when 'store_approved' then v_title := 'تمت الموافقة على متجرك 🎉'; v_body := coalesce(new.data->>'store_name','متجرك') || ' صار منشور على متجر — ابدأ ضيف منتجاتك'; v_url := '/ar/merchant';
    when 'store_rejected' then v_title := 'بخصوص متجرك'; v_body := 'ما قدرنا نوافق على ' || coalesce(new.data->>'store_name','متجرك') || ' — تواصل معنا لنساعدك'; v_url := '/ar/merchant';
    when 'store_suspended' then v_title := 'تم إيقاف متجرك مؤقتاً'; v_body := coalesce(new.data->>'store_name','متجرك') || ' موقوف مؤقتاً — تواصل معنا'; v_url := '/ar/merchant';
    when 'price_drop' then v_title := 'انخفض السعر 🔻'; v_body := coalesce(new.data->>'product_name','منتج بقائمة رغباتك') || ' صار بسعر ' || coalesce(new.data->>'new_price','أقل') || ' — نزّل سعره'; v_url := coalesce('/ar/product/'||(new.data->>'product_id'), '/ar/wishlist');
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    when 'automation' then v_title := coalesce(new.data->>'title','متجر'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    when 'store_campaign' then v_title := coalesce(new.data->>'title','متجر'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    when 'admin_broadcast' then v_title := coalesce(new.data->>'title','متجر 📢'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end
$function$;
