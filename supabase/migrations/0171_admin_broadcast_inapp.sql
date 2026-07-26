-- Admin broadcast was Web-Push-ONLY: /api/push/broadcast looped over
-- push_subscriptions — which has ZERO rows (nobody granted browser-push
-- permission) — so every "bulk send" reached nobody, silently. Root-cause fix:
-- the broadcast now writes IN-APP notifications (the bell — the guaranteed
-- channel), and web push rides along automatically via the existing 0049
-- bridge (notifications INSERT → push_on_notification → /api/push/hook) for
-- whoever IS subscribed. Also adds the audience the admin actually needs:
-- all / merchants / customers.

create or replace function public.admin_broadcast_notify(
  p_title text,
  p_body text,
  p_url text default null,
  p_audience text default 'all'
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body  text := btrim(coalesce(p_body, ''));
  v_url   text := nullif(btrim(coalesce(p_url, '')), '');
  v_count int;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'not_authorized';
  end if;
  if v_body = '' then raise exception 'empty_body'; end if;
  if p_audience is null or p_audience not in ('all', 'merchants', 'customers') then
    raise exception 'bad_audience';
  end if;

  with recips as (
    select p.id from public.profiles p
    where case p_audience
      -- merchants: the merchant role OR anyone who owns a store (belt+braces).
      when 'merchants' then
        p.role = 'merchant'
        or exists (select 1 from public.stores s where s.owner_id = p.id)
      when 'customers' then p.role = 'customer'
      else true
    end
    limit 10000
  ),
  inserted as (
    insert into public.notifications (user_id, type, data)
    select r.id, 'admin_broadcast',
           jsonb_build_object('title', v_title, 'body', v_body, 'url', v_url)
    from recips r
    returning 1
  )
  select count(*)::int into v_count from inserted;

  return v_count;
end $$;

revoke execute on function public.admin_broadcast_notify(text, text, text, text)
  from public, anon;
grant execute on function public.admin_broadcast_notify(text, text, text, text)
  to authenticated;

-- Teach the push bridge the new type (title/body authored by the admin).
-- Reproduces the CURRENT prod definition + the admin_broadcast branch.
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
    when 'admin_broadcast' then v_title := coalesce(new.data->>'title','متجر 📢'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
