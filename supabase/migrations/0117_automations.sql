-- Automation Engine — the no-code "When X happens, if Y, do Z" core.
--
-- Merchants author automations against a FIXED vocabulary (the UI is built in
-- parallel against these exact strings — do not rename them):
--   triggers   : order_created | order_completed | low_stock | new_review | payment_recorded
--   conditions : { min_total, location_id, max_rating }   (all optional, AND-combined)
--   actions[]  : { type: notify|whatsapp|loyalty|coupon, ... }
--
-- There is NO WhatsApp Business API. Automatic channels are the existing in-app
-- notifications + web-push pipeline (0016/0049/0097). The "whatsapp" action just
-- drops the MERCHANT an in-app notification whose payload carries a one-tap
-- wa.me link (prefilled message) the merchant taps to actually send.
--
-- The dispatcher (run_automations) is fired from AFTER triggers that live inside
-- the customer's own transaction (placing an order, recording a payment, ...).
-- It is therefore built to be FAIL-SAFE: it can only ever swallow-and-log
-- errors, never RAISE — a raised exception here would roll back the customer's
-- order. Every layer is wrapped: per-action, per-automation, and an outer guard.

-- ============================================================================
-- 1) Tables
-- ============================================================================

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hot path: the dispatcher looks up enabled automations for one (store, trigger).
create index if not exists automations_store_trigger_idx
  on public.automations (store_id, trigger) where enabled;

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

alter table public.automations enable row level security;

-- Store managers (owner or permitted staff via can_manage_store) fully CRUD their
-- own store's automations; super_admin may read all. Modeled on coupons (0028).
create policy automations_select on public.automations
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_super_admin());
create policy automations_insert on public.automations
  for insert to authenticated
  with check (public.can_manage_store(store_id));
create policy automations_update on public.automations
  for update to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
create policy automations_delete on public.automations
  for delete to authenticated
  using (public.can_manage_store(store_id));

-- Append-only run log (fired | skipped | error). Written ONLY by the SECURITY
-- DEFINER dispatcher; managers may read their store's runs.
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations (id) on delete cascade,
  store_id uuid not null,
  trigger text not null,
  status text not null check (status in ('fired', 'skipped', 'error')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_runs_store_idx
  on public.automation_runs (store_id, created_at desc);

alter table public.automation_runs enable row level security;

create policy automation_runs_select on public.automation_runs
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_super_admin());
-- No insert/update/delete policies: direct writes are denied. The dispatcher
-- (SECURITY DEFINER) is the only writer.

-- ============================================================================
-- 2) Helper: RFC-3986 percent-encoder (UTF-8, per-byte) for wa.me messages.
-- ============================================================================
-- Pure/immutable. Encodes per UTF-8 byte so Arabic messages survive intact
-- ('د8a7' would be wrong — we need '%D8%A7'). Only pg_catalog built-ins are
-- used, so an empty search_path is safe.
create or replace function public.matjar_urlencode(p_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_len int;
  i int;
  b int;
  v_out text := '';
begin
  if p_text is null then return ''; end if;
  v_bytes := convert_to(p_text, 'UTF8');
  v_len := octet_length(v_bytes);
  for i in 0 .. v_len - 1 loop
    b := get_byte(v_bytes, i);
    if (b between 48 and 57)     -- 0-9
       or (b between 65 and 90)  -- A-Z
       or (b between 97 and 122) -- a-z
       or b in (45, 46, 95, 126) -- - . _ ~  (unreserved)
    then
      v_out := v_out || chr(b);
    else
      v_out := v_out || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.matjar_urlencode(text) from public, anon, authenticated;

-- ============================================================================
-- 3) Dispatcher — run_automations(store, trigger, context)
-- ============================================================================
-- CRITICAL: must NEVER raise. Called from AFTER triggers inside the customer's
-- transaction; a raise would roll back their order. Guards, outermost -> in:
--   * outer `exception when others then null` — absolute backstop.
--   * per-automation block — one broken automation never blocks the others.
--   * per-action block — a failing action is logged as an 'error' run; siblings
--     still run.
create or replace function public.run_automations(
  p_store_id uuid,
  p_trigger text,
  p_context jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto public.automations;
  v_owner uuid;
  v_customer uuid;
  v_phone text;
  v_digits text;
  v_action jsonb;
  v_match boolean;
  v_count int;
  v_pts int;
  v_pct int;
  v_code text;
begin
  -- Recipient for merchant-facing actions = the store owner (managers).
  select owner_id into v_owner from public.stores where id = p_store_id;

  v_customer := nullif(p_context->>'customer_id', '')::uuid;
  v_phone := nullif(p_context->>'phone', '');

  for v_auto in
    select * from public.automations
    where store_id = p_store_id and trigger = p_trigger and enabled
  loop
    begin  -- ---- per-automation guard --------------------------------------
      -- Evaluate conditions (all optional, AND-combined).
      v_match := true;

      if v_auto.conditions ? 'min_total'
         and nullif(v_auto.conditions->>'min_total', '') is not null then
        if coalesce((p_context->>'total')::numeric, 0)
           < (v_auto.conditions->>'min_total')::numeric then
          v_match := false;
        end if;
      end if;

      if v_match
         and v_auto.conditions ? 'location_id'
         and nullif(v_auto.conditions->>'location_id', '') is not null then
        if (p_context->>'location_id') is distinct from (v_auto.conditions->>'location_id') then
          v_match := false;
        end if;
      end if;

      if v_match
         and v_auto.conditions ? 'max_rating'
         and nullif(v_auto.conditions->>'max_rating', '') is not null then
        -- Fire only when rating <= max_rating (a "low rating" alert).
        if coalesce((p_context->>'rating')::int, 2147483647)
           > (v_auto.conditions->>'max_rating')::int then
          v_match := false;
        end if;
      end if;

      if not v_match then
        insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
        values (v_auto.id, p_store_id, p_trigger, 'skipped',
                jsonb_build_object('reason', 'conditions'));
        continue;
      end if;

      -- Run each action in its own subtransaction.
      v_count := 0;
      for v_action in
        select value from jsonb_array_elements(coalesce(v_auto.actions, '[]'::jsonb))
      loop
        begin  -- ---- per-action guard --------------------------------------
          case v_action->>'type'

            -- In-app notification + push to the store OWNER (managers).
            when 'notify' then
              if v_owner is not null then
                insert into public.notifications (user_id, type, data)
                values (v_owner, 'automation', jsonb_build_object(
                  'title', v_action->>'title',
                  'body', v_action->>'body',
                  'store_id', p_store_id,
                  'url', '/merchant/' || p_store_id || '/orders',
                  'automation_id', v_auto.id
                ));
                v_count := v_count + 1;
              end if;

            -- One-tap wa.me link to the MERCHANT (semi-auto). Needs a phone in
            -- context; skip silently otherwise.
            when 'whatsapp' then
              if v_owner is not null and v_phone is not null then
                v_digits := regexp_replace(v_phone, '\D', '', 'g');
                if v_digits <> '' then
                  insert into public.notifications (user_id, type, data)
                  values (v_owner, 'automation', jsonb_build_object(
                    'title', 'راسل الزبون عبر واتساب 💬',
                    'body', coalesce(v_action->>'message', ''),
                    'store_id', p_store_id,
                    'url', 'https://wa.me/' || v_digits
                           || '?text=' || public.matjar_urlencode(coalesce(v_action->>'message', '')),
                    'whatsapp', true,
                    'message', coalesce(v_action->>'message', ''),
                    'customer_name', p_context->>'customer_name',
                    'automation_id', v_auto.id
                  ));
                  v_count := v_count + 1;
                end if;
              end if;

            -- Award loyalty points to the context customer (skip guests).
            when 'loyalty' then
              v_pts := coalesce((v_action->>'points')::int, 0);
              if v_customer is not null and v_pts <> 0 then
                insert into public.loyalty_ledger (user_id, delta, reason, store_id)
                values (v_customer, v_pts, 'automation', p_store_id);
                v_count := v_count + 1;
              end if;

            -- Mint a unique store coupon and notify the customer with the code.
            when 'coupon' then
              v_pct := coalesce((v_action->>'percent')::int, 0);
              if v_customer is not null and v_pct > 0 then
                loop
                  v_code := 'AUTO' || upper(left(md5(random()::text || clock_timestamp()::text), 5));
                  exit when not exists (
                    select 1 from public.coupons
                    where store_id = p_store_id and code = v_code
                  );
                end loop;
                insert into public.coupons (store_id, code, type, value, is_active)
                values (p_store_id, v_code, 'percent', v_pct, true);
                insert into public.notifications (user_id, type, data)
                values (v_customer, 'automation', jsonb_build_object(
                  'title', 'كوبون خصم 🎟️',
                  'body', 'كود خصمك ' || v_code || ' — خصم ' || v_pct || '٪',
                  'store_id', p_store_id,
                  'code', v_code,
                  'percent', v_pct,
                  'url', '/ar',
                  'automation_id', v_auto.id
                ));
                v_count := v_count + 1;
              end if;

            else
              null;  -- unknown action type: ignore
          end case;

        exception when others then
          -- Log the failing action, keep going with its siblings.
          insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
          values (v_auto.id, p_store_id, p_trigger, 'error',
                  jsonb_build_object('action', v_action->>'type', 'error', sqlerrm));
        end;
      end loop;

      insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
      values (v_auto.id, p_store_id, p_trigger, 'fired',
              jsonb_build_object('actions', v_count));

    exception when others then
      -- Last-resort per-automation guard; try to log, never propagate.
      begin
        insert into public.automation_runs (automation_id, store_id, trigger, status, detail)
        values (v_auto.id, p_store_id, p_trigger, 'error',
                jsonb_build_object('scope', 'automation', 'error', sqlerrm));
      exception when others then
        null;
      end;
    end;
  end loop;

exception when others then
  -- Absolute backstop: run_automations must never raise into the caller's txn.
  null;
end;
$$;

-- Trigger-only: keep the dispatcher off the REST surface. Event trigger
-- functions are SECURITY DEFINER owned by the same role, so they retain execute.
revoke execute on function public.run_automations(uuid, text, jsonb)
  from public, anon, authenticated;

-- ============================================================================
-- 4) Event triggers (AFTER, additive — never clobber existing triggers).
-- ============================================================================
-- Each is SECURITY DEFINER / empty search_path and delegates to the fail-safe
-- dispatcher, so building the context is the only thing that could throw (it
-- cannot — jsonb_build_object over NEW columns is total).

-- orders INSERT -> order_created
create or replace function public.automations_on_order_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.run_automations(new.store_id, 'order_created', jsonb_build_object(
    'order_id', new.id,
    'total', new.total,
    'customer_id', new.customer_id,
    'phone', new.phone,
    'location_id', new.location_id,
    'customer_name', new.customer_name
  ));
  return new;
end $$;
drop trigger if exists orders_automations_insert on public.orders;
create trigger orders_automations_insert
  after insert on public.orders
  for each row execute function public.automations_on_order_insert();

-- orders UPDATE (-> completed) -> order_completed
create or replace function public.automations_on_order_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.run_automations(new.store_id, 'order_completed', jsonb_build_object(
      'order_id', new.id,
      'total', new.total,
      'customer_id', new.customer_id,
      'phone', new.phone,
      'location_id', new.location_id,
      'customer_name', new.customer_name
    ));
  end if;
  return new;
end $$;
drop trigger if exists orders_automations_complete on public.orders;
create trigger orders_automations_complete
  after update on public.orders
  for each row execute function public.automations_on_order_complete();

-- products UPDATE (crossing down to <= 5) -> low_stock
create or replace function public.automations_on_low_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stock is not null and new.stock <= 5
     and (old.stock is null or old.stock > 5) then
    perform public.run_automations(new.store_id, 'low_stock', jsonb_build_object(
      'product_id', new.id,
      'product_name', new.name,
      'stock', new.stock
    ));
  end if;
  return new;
end $$;
drop trigger if exists products_automations_low_stock on public.products;
create trigger products_automations_low_stock
  after update on public.products
  for each row execute function public.automations_on_low_stock();

-- order_payments INSERT (payment) -> payment_recorded
-- Customer + phone are looked up from the parent order (order_payments has neither).
create or replace function public.automations_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_customer uuid; v_phone text;
begin
  if new.kind = 'payment' then
    select o.customer_id, o.phone into v_customer, v_phone
    from public.orders o where o.id = new.order_id;
    perform public.run_automations(new.store_id, 'payment_recorded', jsonb_build_object(
      'order_id', new.order_id,
      'amount', new.amount,
      'customer_id', v_customer,
      'phone', v_phone
    ));
  end if;
  return new;
end $$;
drop trigger if exists order_payments_automations on public.order_payments;
create trigger order_payments_automations
  after insert on public.order_payments
  for each row execute function public.automations_on_payment();

-- reviews INSERT -> new_review  (public.reviews is store-level; it has no
-- product_id column, so the context omits it.)
create or replace function public.automations_on_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.run_automations(new.store_id, 'new_review', jsonb_build_object(
    'review_id', new.id,
    'rating', new.rating,
    'customer_id', new.customer_id
  ));
  return new;
end $$;
drop trigger if exists reviews_automations on public.reviews;
create trigger reviews_automations
  after insert on public.reviews
  for each row execute function public.automations_on_review();

revoke execute on function public.automations_on_order_insert()   from public, anon, authenticated;
revoke execute on function public.automations_on_order_complete() from public, anon, authenticated;
revoke execute on function public.automations_on_low_stock()      from public, anon, authenticated;
revoke execute on function public.automations_on_payment()        from public, anon, authenticated;
revoke execute on function public.automations_on_review()         from public, anon, authenticated;

-- ============================================================================
-- 5) Push bridge — add the 'automation' case.
-- ============================================================================
-- Recreated from the latest definition (0097) with a single 'automation' case
-- added; EVERY existing case is preserved verbatim. Automation pushes read
-- title/body/url straight out of the notification's data jsonb.
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
    when 'price_drop' then v_title := 'انخفض السعر 🔻'; v_body := coalesce(new.data->>'product_name','منتج بقائمة رغباتك') || ' صار بسعر ' || coalesce(new.data->>'new_price','أقل') || ' — نزّل سعره'; v_url := coalesce('/ar/product/'||(new.data->>'product_id'), '/ar/wishlist');
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    when 'automation' then v_title := coalesce(new.data->>'title','متجر'); v_body := coalesce(new.data->>'body',''); v_url := coalesce(new.data->>'url','/ar/notifications');
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;

-- ============================================================================
-- ROLLED-BACK TEST  (orchestrator: uncomment & run; it always raises to roll back)
-- ============================================================================
-- Expected: RESULT PASS notifications=1 loyalty=10 fired=1
-- /*
-- do $$
-- declare
--   v_owner uuid := gen_random_uuid();
--   v_cust  uuid := gen_random_uuid();
--   v_store uuid;
--   v_auto  uuid;
--   v_order uuid;
--   v_notif int;
--   v_loyal int;
--   v_fired int;
-- begin
--   insert into auth.users (id) values (v_owner), (v_cust);
--   insert into public.profiles (id) values (v_owner), (v_cust);
--   insert into public.stores (owner_id, name, status, plan)
--     values (v_owner, 'Automation Test Store', 'active', 'pro')
--     returning id into v_store;
--
--   insert into public.automations (store_id, name, trigger, conditions, actions, enabled, created_by)
--   values (v_store, 'Thank + reward on completion', 'order_completed', '{}'::jsonb,
--           jsonb_build_array(
--             jsonb_build_object('type','notify','title','Order completed','body','Thanks for your order!'),
--             jsonb_build_object('type','loyalty','points',10)
--           ), true, v_owner)
--   returning id into v_auto;
--
--   insert into public.orders (store_id, customer_id, status, total)
--     values (v_store, v_cust, 'pending', 25) returning id into v_order;
--
--   update public.orders set status = 'completed' where id = v_order;
--
--   select count(*) into v_notif
--     from public.notifications where user_id = v_owner and type = 'automation';
--   select coalesce(sum(delta),0) into v_loyal
--     from public.loyalty_ledger
--     where user_id = v_cust and store_id = v_store and reason = 'automation';
--   select count(*) into v_fired
--     from public.automation_runs where automation_id = v_auto and status = 'fired';
--
--   if v_notif = 1 and v_loyal = 10 and v_fired = 1 then
--     raise exception 'RESULT PASS notifications=% loyalty=% fired=%', v_notif, v_loyal, v_fired;
--   else
--     raise exception 'RESULT FAIL notifications=% loyalty=% fired=%', v_notif, v_loyal, v_fired;
--   end if;
-- end $$;
-- */
