-- Merchant Marketing Campaigns — a Pro tool that lets a merchant blast an
-- offer/announcement to their store's audience as an in-app notification + web
-- push (fully automatic, NO WhatsApp API). It is the merchant-scoped cousin of
-- the admin broadcast.
--
-- Recipients = the store's FOLLOWERS (public.follows.user_id) and past CUSTOMERS
-- (registered users who ordered — public.orders.customer_id, non-null), deduped.
-- Each recipient gets one `store_campaign` notification, which the existing push
-- bridge (push_on_notification -> notify_push, 0016/0049/0097/0117) turns into a
-- web push. All fan-out happens inside the SECURITY DEFINER RPC below — there are
-- NO client write policies on store_campaigns.

-- ============================================================================
-- 1) Table
-- ============================================================================
create table if not exists public.store_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text,
  body text not null,
  url text,
  audience text not null check (audience in ('followers', 'customers', 'all')),
  sent_count int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Hot path: a store's campaign history, newest first (also drives the 6h rate
-- limit lookup in the RPC).
create index if not exists store_campaigns_store_created_idx
  on public.store_campaigns (store_id, created_at desc);

alter table public.store_campaigns enable row level security;

-- Managers (owner or permitted staff via can_manage_store) read their store's
-- campaigns; super_admin may read all. Modeled on automations (0117).
create policy store_campaigns_select on public.store_campaigns
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_super_admin());
-- No insert/update/delete policies: the only writer is the SECURITY DEFINER RPC.

-- ============================================================================
-- 2) RPC — send_store_campaign(store, title, body, url, audience)
-- ============================================================================
-- Guarded, validated, rate-limited (one campaign per store per 6 hours). Gathers
-- the DISTINCT recipient user_ids per audience, records one store_campaigns row,
-- fans out one notification each, and stamps the row's sent_count. Recipients are
-- capped at 5000 defensively to avoid a runaway blast.
create or replace function public.send_store_campaign(
  p_store_id uuid,
  p_title text,
  p_body text,
  p_url text default null,
  p_audience text default 'all'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_sent int;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body  text := btrim(coalesce(p_body, ''));
  v_url   text := nullif(btrim(coalesce(p_url, '')), '');
begin
  -- Only store managers may send.
  if not public.can_manage_store(p_store_id) then
    raise exception 'not_authorized';
  end if;

  -- Body is required; title and url are optional.
  if v_body = '' then
    raise exception 'empty_body';
  end if;

  -- Audience must be one of the three known values.
  if p_audience is null or p_audience not in ('followers', 'customers', 'all') then
    raise exception 'bad_audience';
  end if;

  -- Rate limit: refuse if this store already sent a campaign in the last 6 hours.
  if exists (
    select 1 from public.store_campaigns
    where store_id = p_store_id
      and created_at > now() - interval '6 hours'
  ) then
    raise exception 'rate_limited';
  end if;

  insert into public.store_campaigns (store_id, title, body, url, audience, created_by)
  values (p_store_id, v_title, v_body, v_url, p_audience, auth.uid())
  returning id into v_campaign_id;

  -- Distinct recipients per audience, capped at 5000.
  with recips as (
    select f.user_id as uid
    from public.follows f
    where f.store_id = p_store_id
      and p_audience in ('followers', 'all')
    union
    select o.customer_id as uid
    from public.orders o
    where o.store_id = p_store_id
      and o.customer_id is not null
      and p_audience in ('customers', 'all')
  ),
  capped as (
    select uid from recips limit 5000
  ),
  inserted as (
    insert into public.notifications (user_id, type, data)
    select c.uid,
           'store_campaign',
           jsonb_build_object(
             'title', v_title,
             'body', v_body,
             'url', coalesce(v_url, '/ar/store/' || p_store_id),
             'store_id', p_store_id,
             'campaign_id', v_campaign_id
           )
    from capped c
    returning 1
  )
  select count(*)::int into v_sent from inserted;

  update public.store_campaigns
    set sent_count = v_sent
    where id = v_campaign_id;

  return jsonb_build_object('campaign_id', v_campaign_id, 'sent', v_sent);
end;
$$;

-- Keep it off the anon surface; authenticated managers call it (guarded inside).
revoke execute on function public.send_store_campaign(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.send_store_campaign(uuid, text, text, text, text)
  to authenticated;

-- ============================================================================
-- 3) Push bridge — add the 'store_campaign' case.
-- ============================================================================
-- Recreated VERBATIM from the current live definition (0117) with a single
-- 'store_campaign' case added (mirrors 'automation': title/body/url read straight
-- from the notification's data jsonb). EVERY existing case is preserved.
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $function$
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
end $function$;

-- ============================================================================
-- ROLLED-BACK TEST  (orchestrator: uncomment & run; it always raises to roll back)
-- ============================================================================
-- Expected: RESULT PASS notifs=2 sent_count=2 rate_limited=t
-- /*
-- do $$
-- declare
--   v_owner    uuid := gen_random_uuid();
--   v_follower uuid := gen_random_uuid();
--   v_customer uuid := gen_random_uuid();
--   v_store    uuid;
--   v_res      jsonb;
--   v_notifs   int;
--   v_sent     int;
--   v_rl       boolean := false;
-- begin
--   insert into auth.users (id) values (v_owner), (v_follower), (v_customer);
--   insert into public.profiles (id) values (v_owner), (v_follower), (v_customer);
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner, 'Campaign Test Store', 'active', 'pro')
--     returning id into v_store;
--
--   -- one follower and one distinct past customer (with an order)
--   insert into public.follows (user_id, store_id) values (v_follower, v_store);
--   insert into public.orders (store_id, customer_id, status, total)
--     values (v_store, v_customer, 'pending', 20);
--
--   -- can_manage_store() reads auth.uid(); impersonate the owner for this txn.
--   perform set_config('request.jwt.claims',
--                      json_build_object('sub', v_owner::text)::text, true);
--
--   v_res := public.send_store_campaign(
--              v_store, 'Big Sale', 'Everything 20% off today!', null, 'all');
--
--   select count(*) into v_notifs
--     from public.notifications
--     where type = 'store_campaign'
--       and (data->>'store_id')::uuid = v_store;
--
--   select sent_count into v_sent
--     from public.store_campaigns where id = (v_res->>'campaign_id')::uuid;
--
--   -- a second immediate call must be rate-limited
--   begin
--     perform public.send_store_campaign(v_store, 'Again', 'Second blast', null, 'all');
--   exception when others then
--     if sqlerrm = 'rate_limited' then v_rl := true; end if;
--   end;
--
--   if v_notifs = 2 and v_sent = 2 and v_rl then
--     raise exception 'RESULT PASS notifs=% sent_count=% rate_limited=%', v_notifs, v_sent, v_rl;
--   else
--     raise exception 'RESULT FAIL notifs=% sent_count=% rate_limited=%', v_notifs, v_sent, v_rl;
--   end if;
-- end $$;
-- */
