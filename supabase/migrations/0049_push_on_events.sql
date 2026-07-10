-- Auto Web Push on system events. Every row inserted into notifications (by the
-- order/booking/listing triggers) fans out as a push via a DB->route bridge:
--   notifications INSERT -> push_on_notification -> notify_push (pg_net POST)
--     -> /api/push/hook (verifies the shared secret) -> web-push.
-- Requires env vars on the host: VAPID_PRIVATE_KEY and PUSH_HOOK_SECRET (the
-- latter must equal private.app_config.push_hook_secret below).
create extension if not exists pg_net;

create schema if not exists private;
create table if not exists private.app_config (key text primary key, value text not null);
insert into private.app_config (key, value)
values ('push_hook_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;
insert into private.app_config (key, value)
values ('site_url', 'https://matjarlb.com')
on conflict (key) do update set value = excluded.value;

create or replace function public.get_push_subs(p_uid uuid, p_secret text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <>
     (select value from private.app_config where key = 'push_hook_secret') then
    return;
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s where s.user_id = p_uid;
end $$;
revoke execute on function public.get_push_subs(uuid, text) from public;
grant execute on function public.get_push_subs(uuid, text) to anon, authenticated;

create or replace function public.notify_push(
  p_uid uuid, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret text; v_base text;
begin
  select value into v_secret from private.app_config where key='push_hook_secret';
  select value into v_base from private.app_config where key='site_url';
  if v_secret is null or v_base is null then return; end if;
  perform net.http_post(
    url := v_base || '/api/push/hook',
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret', v_secret),
    body := jsonb_build_object('user_id', p_uid, 'title', p_title, 'body', p_body, 'url', p_url)
  );
end $$;
revoke execute on function public.notify_push(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.push_on_notification();
revoke execute on function public.push_on_notification() from public, anon, authenticated;
