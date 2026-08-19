-- A suspension is an outcome with no explanation, no author and no date.
--
-- `stores.status` is a bare enum. When it flips to 'suspended' the merchant's
-- shop disappears from the platform and 0271 sends them "متجرك موقوف مؤقتاً —
-- تواصل معنا". That message carries no reason because there is nothing on the
-- row to carry. The admin who reviews the store later sees the same nothing.
--
-- Measured on production: 36 live stores, 15 active and 20 suspended. Fourteen
-- of the suspended belong to three tester accounts, but five or six belong to
-- distinct real people who have a suspended store and no active one
-- (forgetechsoftware ×2, nailsbysalam, raninehamido, halimashidiak3218r,
-- amjadchaarawi). Not one of them can be told why, because nobody wrote it down.
--
-- WHAT THIS ADDS, AND WHY IT IS NOT JUST audit_logs
--
-- `audit_logs` (0017) already logs 'store_status_changed' with actor_id and
-- created_at, and it does it well: every one of the 36 live stores has an audit
-- row whose `to` equals its current status, and all 60 such rows carry an actor.
-- So the history exists — this migration keeps it as the history and extends it
-- rather than starting a second one (see log_store_change below, which now
-- records the reason alongside from/to).
--
-- The three columns are still added to `stores`, for two reasons:
--
--   1. audit_logs is super-admin-only by RLS (audit_logs_select_admin). The
--      person who most needs to know when their shop was suspended and why is
--      the merchant, and they can never read that table. A column on their own
--      store row is a row they already own (stores_select: auth.uid() =
--      owner_id), so the surfaces that must tell them can just read it.
--   2. `status_reason` has no home in audit_logs either — nothing has ever
--      written a reason anywhere. That is the missing piece the whole feature
--      turns on.
--
-- status_changed_at / status_changed_by are therefore not a duplicate record but
-- the current status's provenance, denormalised onto the row so the owner can
-- see it; audit_logs remains the append-only history of every transition.
--
-- THE BACKFILL IS COPIED, NOT INVENTED
--
-- status_changed_at / status_changed_by are backfilled from audit_logs, and only
-- where the latest logged transition's `to` still equals the store's current
-- status — i.e. only where the audit trail actually describes the state the row
-- is in. That is relocating a fact we recorded, not manufacturing one.
--
-- status_reason is left NULL for all 36. No reason was ever recorded for the 20
-- suspended stores and none will be guessed here. Every surface treats NULL as
-- "no reason was recorded — contact us", never as an empty string and never as a
-- default sentence that would read like an explanation somebody gave.

-- ── the record ───────────────────────────────────────────────────────────────

alter table public.stores
  add column if not exists status_reason     text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id);

-- A blank reason is the bug this migration exists to fix, so the column refuses
-- to hold one: it is either absent (NULL, honestly unknown) or it says something.
alter table public.stores drop constraint if exists stores_status_reason_shape;
alter table public.stores
  add constraint stores_status_reason_shape
  check (
    status_reason is null
    or (btrim(status_reason) <> '' and char_length(status_reason) <= 500)
  );

comment on column public.stores.status_reason is
  'Why the store is in its current status, in the admin''s own words. NULL means no reason was recorded — never render it as an empty string or a default. Written only by set_store_status(); a browser cannot write it (see guard_store_platform_columns).';
comment on column public.stores.status_changed_at is
  'When the current status was set. Stamped server-side by stamp_store_status_change(); backfilled from audit_logs for rows that predate this migration.';
comment on column public.stores.status_changed_by is
  'Who set the current status. Stamped server-side from auth.uid(), never accepted from a client. NULL for changes made by cron or by hand in SQL.';

-- ── the backfill ─────────────────────────────────────────────────────────────

with latest as (
  select distinct on (a.entity_id)
    a.entity_id,
    a.created_at,
    a.actor_id,
    a.metadata->>'to' as to_status
  from public.audit_logs a
  where a.entity_type = 'store'
    and a.action = 'store_status_changed'
  order by a.entity_id, a.created_at desc
)
update public.stores s
   set status_changed_at = l.created_at,
       status_changed_by = l.actor_id
  from latest l
 where l.entity_id = s.id
   and l.to_status = s.status::text
   and s.status_changed_at is null;

-- ── the guard: these three are not browser-writable ──────────────────────────
--
-- Rebuilt whole from the live definition (0217). The existing posture is
-- untouched — plan/status/trial_ends_at/rating/owner_id/invoice_next_no are
-- still reverted for everyone except a super admin, so who may suspend a store
-- does not change.
--
-- The three new columns sit ABOVE the is_super_admin() escape, which is the one
-- deliberate difference: a super admin may still flip the status from a browser,
-- but nobody may hand the database a reason, an author or a timestamp over
-- PostgREST. Those are stamped server-side or not at all — otherwise the record
-- of who suspended a store is whatever the client typed into a JSON body.
-- set_store_status() is SECURITY DEFINER, so it arrives as the function owner
-- rather than `authenticated` and returns at the first branch, as does cron and
-- the service role.
create or replace function public.guard_store_platform_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Anything not coming straight from PostgREST is a trusted path: a SECURITY
  -- DEFINER RPC, a trigger, pg_cron, or the service role.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- No browser writes the provenance of a status, not even an admin's.
  new.status_reason     := old.status_reason;
  new.status_changed_at := old.status_changed_at;
  new.status_changed_by := old.status_changed_by;

  if public.is_super_admin() then
    return new;
  end if;

  new.plan          := old.plan;
  new.status        := old.status;
  new.trial_ends_at := old.trial_ends_at;
  new.rating_avg    := old.rating_avg;
  new.rating_count  := old.rating_count;
  new.owner_id      := old.owner_id;
  new.invoice_next_no := old.invoice_next_no;
  return new;
end
$function$;

-- ── the stamp ────────────────────────────────────────────────────────────────
--
-- Every path that changes a status gets an actor and a timestamp, whether it
-- came through the RPC, through the admin UI's plain update, through cron or
-- through psql. Putting this in a trigger rather than in the RPC means there is
-- no way to change a status and leave the provenance stale.
--
-- SECURITY INVOKER (the default) on purpose, like 0217/0272: it has to see
-- `current_user` to tell a browser from a trusted caller.
--
-- Named to sort after stores_guard_platform_columns: BEFORE triggers of the same
-- event fire in name order, and this must run after the guard has finished
-- reverting, or the guard would put the old provenance back over the new stamp.
create or replace function public.stamp_store_status_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
    -- A browser cannot supply a reason (the guard above just reverted it to the
    -- old one), and the old one explains the status the store has just left. It
    -- would be worse than nothing to leave it attached to the new one.
    if current_user in ('authenticated', 'anon') then
      new.status_reason := null;
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.stamp_store_status_change() from public, anon, authenticated;

drop trigger if exists stores_stamp_status_change on public.stores;
create trigger stores_stamp_status_change
  before update on public.stores
  for each row execute function public.stamp_store_status_change();

-- ── the one way to decide ────────────────────────────────────────────────────
--
-- Returns an outcome instead of raising. 0259's lesson: a raise rolls back the
-- whole statement, including any row written to record the attempt, and it gives
-- the UI a Postgres error string where it needs to tell "you are not an admin"
-- from "you forgot the reason". Every branch here is a case the admin screen
-- renders differently.
--
-- Calling it on a store that is already in the requested status is allowed and
-- is how a reason gets recorded for the 20 stores suspended before this existed:
-- the status does not move, so no notification is sent and no audit row is
-- written, but the explanation finally lands on the row where the merchant can
-- read it. Deliberate: an admin fixing a typo should not push a second "your
-- store was suspended" to someone whose store was suspended weeks ago.
create or replace function public.set_store_status(
  p_store_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old    public.store_status;
  v_reason text;
  v_row    public.stores%rowtype;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_status not in ('pending', 'active', 'suspended', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'unknown_status');
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  -- An active shop and one waiting its turn explain themselves; carrying the
  -- sentence that justified a suspension into 'active' would make the merchant
  -- read their own reinstatement as a second telling-off.
  if p_status in ('pending', 'active') then
    v_reason := null;
  end if;

  -- The whole point. An outcome with no explanation is what created this mess.
  if p_status in ('suspended', 'rejected') and v_reason is null then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    return jsonb_build_object('ok', false, 'error', 'reason_too_long', 'max', 500);
  end if;

  select * into v_row from public.stores
   where id = p_store_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_old := v_row.status;

  -- status_changed_at / status_changed_by are absent from this SET on purpose:
  -- stamp_store_status_change() writes them from now() and auth.uid(), so they
  -- cannot be influenced by anything the caller sent.
  update public.stores
     set status        = p_status::public.store_status,
         status_reason = v_reason
   where id = p_store_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'changed', v_old is distinct from v_row.status,
    'from', v_old,
    'status', v_row.status,
    'reason', v_row.status_reason,
    'changed_at', v_row.status_changed_at,
    'changed_by', v_row.status_changed_by
  );
end
$function$;

-- Audience, per 0281: a signed-in admin calls it from the admin screen; the
-- internal is_super_admin() check is what actually authorises it.
revoke all on function public.set_store_status(uuid, text, text) from public, anon;
grant execute on function public.set_store_status(uuid, text, text) to authenticated;

-- ── the history keeps the reason ─────────────────────────────────────────────
--
-- Rebuilt from the live definition of 0017's logger; the plan branch and both
-- inserts are otherwise unchanged. AFTER UPDATE, so new.status_reason is already
-- whatever the stamp left, and the log records the explanation that was live at
-- the moment of the change rather than whatever it was later edited to.
create or replace function public.log_store_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'store_status_changed', 'store', new.id,
            jsonb_build_object('from', old.status, 'to', new.status,
                               'reason', new.status_reason));
  end if;
  if new.plan is distinct from old.plan then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'store_plan_changed', 'store', new.id,
            jsonb_build_object('from', old.plan, 'to', new.plan));
  end if;
  return new;
end
$function$;

revoke all on function public.log_store_change() from public, anon, authenticated;

-- ── the message carries it ───────────────────────────────────────────────────
--
-- 0271's notifier, with the reason added to the payload. Everything else is
-- unchanged, including the silence on the way back into 'pending'.
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
      'status', new.status,
      'reason', new.status_reason
    )
  );

  return new;
end
$function$;

revoke execute on function public.on_store_status_change() from public, anon, authenticated;

-- ── the push copy says why ───────────────────────────────────────────────────
--
-- Rebuilt whole because plpgsql cannot have a branch added to an existing case,
-- and taken from the live definition so no type is lost. Exactly one branch
-- changes — 'store_suspended' — and it still produces today's byte-identical
-- sentence when no reason was recorded. A push body is a glance, not a letter,
-- so a long reason is cut at 120 characters and the full text waits on the
-- dashboard.
create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_title text; v_body text; v_url text; v_lid text; v_reason text;
begin
  v_lid := new.data->>'listing_id';
  v_reason := nullif(btrim(coalesce(new.data->>'reason', '')), '');
  if char_length(coalesce(v_reason, '')) > 120 then
    v_reason := left(v_reason, 119) || '…';
  end if;
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
    when 'store_approved' then v_title := 'تمت الموافقة على متجرك 🎉'; v_body := coalesce(new.data->>'store_name','متجرك') || ' صار منشور على متجر — ابدأ ضيف منتجاتك'; v_url := '/ar/merchant';
    when 'store_rejected' then v_title := 'بخصوص متجرك'; v_body := 'ما قدرنا نوافق على ' || coalesce(new.data->>'store_name','متجرك') || ' — تواصل معنا لنساعدك'; v_url := '/ar/merchant';
    when 'store_suspended' then v_title := 'تم إيقاف متجرك مؤقتاً'; v_body := coalesce(new.data->>'store_name','متجرك') || ' موقوف مؤقتاً' || coalesce(': ' || v_reason, '') || ' — تواصل معنا'; v_url := '/ar/merchant';
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

revoke all on function public.push_on_notification() from public, anon, authenticated;
