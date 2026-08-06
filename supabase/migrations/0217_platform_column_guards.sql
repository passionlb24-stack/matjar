-- 0217: make the platform-owned columns unwritable from a browser.
--
-- `stores_update` and `orders_update` both authorise the row and say nothing
-- about columns:
--
--   stores_update  →  is_super_admin() OR auth.uid() = owner_id
--   orders_update  →  staff_can(store_id,'orders') OR owner of the store
--
-- Correct as far as they go, and that is the problem: "the owner may edit their
-- store" also means the owner may edit their plan. With the publishable key and
-- their own session, a merchant could send
--
--   PATCH /rest/v1/stores?id=eq.<their-store>
--   {"status":"active","plan":"business","trial_ends_at":"2030-01-01"}
--
-- and go live unreviewed on Business tier, permanently, for free — defeating
-- both the moderation queue and the entire subscription model in one request.
-- The same shape on `orders` rewrites `total`, which is the source of every
-- money figure in the product (store_report, accounting, admin_platform_report,
-- best-sellers) and of loyalty accrual, since award_loyalty_on_complete does
-- `floor(new.total)`. Neither table had a BEFORE UPDATE guard: `stores` only had
-- stores_guard_featured (which reverts featured_until and commercial_reg_verified
-- and nothing else) and `orders` only had orders_set_updated_at.
--
-- HOW THE GUARDS TELL A BROWSER FROM THE BACKEND
--
-- These two functions are deliberately SECURITY INVOKER — the default, stated
-- here because it is load-bearing rather than incidental. A SECURITY DEFINER
-- trigger would run as its own owner and could no longer see who called it.
--
-- As invoker, `current_user` is the role PostgREST authenticated the request as:
-- `authenticated` for a signed-in user, `anon` for a guest. Every legitimate
-- writer of these columns arrives some other way, so none of them need to be
-- modified or given an escape hatch:
--
--   start_pro_trial            SECURITY DEFINER  → writes trial_ends_at
--   transfer_store_ownership   SECURITY DEFINER  → writes owner_id
--   sync_store_rating          SECURITY DEFINER  → writes rating_avg/rating_count
--   trial maintenance cron     runs as postgres  → writes plan/trial_ends_at
--   place_customer_order etc.  SECURITY DEFINER  → write the order totals
--
-- Admin actions are the exception that does arrive as `authenticated`: approving
-- a store and changing a tier are plain client-side updates from the admin UI
-- (admin-store-actions.tsx:44, admin-stores-client.tsx:88, admin-subs-client.tsx
-- :127,:157). is_super_admin() lets exactly those through.
--
-- The merchant-facing forms were checked against this list: edit-store-form and
-- store-settings-form write only descriptive columns, and the order components
-- write only status, assigned_to, tags and store_note. Nothing a merchant can
-- legitimately do touches a guarded column.
--
-- Reverting rather than raising is on purpose. An exception would tell a prober
-- exactly which columns are protected, and would turn a merchant's harmless
-- full-row PATCH into a hard failure. Silently restoring the old value means the
-- honest client keeps working and the dishonest one gets nothing.

-- ── stores ───────────────────────────────────────────────────────────────────

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

-- Named to sort after stores_clear_trial_on_paid: that one nulls trial_ends_at
-- when the plan moves off free, so it has to see the plan change before this
-- decides whether the plan change was allowed at all. Triggers of the same
-- timing fire in name order.
drop trigger if exists stores_guard_platform_columns on public.stores;
create trigger stores_guard_platform_columns
  before update on public.stores
  for each row execute function public.guard_store_platform_columns();

-- ── orders ───────────────────────────────────────────────────────────────────

create or replace function public.guard_order_money_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- No super-admin exemption here. Admins have no UI that edits an order's
  -- money, and a booked total should not be silently editable by anyone from a
  -- browser — corrections belong in order_payments, which is an append-only
  -- ledger with its own audit trail.
  new.subtotal     := old.subtotal;
  new.discount     := old.discount;
  new.delivery_fee := old.delivery_fee;
  new.total        := old.total;
  new.tax_rate     := old.tax_rate;
  new.tax_amount   := old.tax_amount;
  new.currency     := old.currency;
  new.fx_rate      := old.fx_rate;
  return new;
end
$function$;

drop trigger if exists orders_guard_money_columns on public.orders;
create trigger orders_guard_money_columns
  before update on public.orders
  for each row execute function public.guard_order_money_columns();
