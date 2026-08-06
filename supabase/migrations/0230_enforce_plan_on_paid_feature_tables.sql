-- 0230: paid features stop working when the plan stops being paid.
--
-- Plan gating lived almost entirely in the UI. Seven merchant pages render
-- <ProGate requiredPlan="business"> instead of their content, and exactly two
-- functions in the whole database checked a plan: request_delivery (0213) and
-- import_products (0214). Every other paid feature was guarded by a screen.
--
-- A screen is not a gate. The tables behind those pages sit under the ordinary
-- "the owner may write their own store's rows" policy, so a merchant whose
-- trial had lapsed kept every automation, campaign, stock movement and supplier
-- ledger they built — and could keep adding more straight through PostgREST
-- with the publishable key. Since the paid tiers are the business model, and
-- there are 0 paying subscriptions today, that is the whole model resting on a
-- component that renders something else.
--
-- One generic BEFORE INSERT OR UPDATE trigger per feature-owned table, taking
-- the required plan as an argument, so adding the next paid feature is one line
-- rather than a new function.
--
-- Branches are handled separately. Every store gets a primary location from
-- create_primary_location, so gating store_locations outright would stop a free
-- store having an address at all. Only the second location onwards is the
-- Business feature, and only INSERT is gated — a free store can still edit the
-- one it has. create_primary_location is SECURITY DEFINER, so the trigger that
-- creates that first row is never gated either.
--
-- Deliberately unchanged: a store on trial gets Pro, not Business
-- (store_effective_plan), so these Business tables are closed to it — which is
-- exactly what its screens already say. The data layer now agrees with them
-- rather than quietly disagreeing.
--
-- Verified on production inside rolled-back transactions:
--   free store, trial expired  → plan_required:business
--   store on an active trial   → plan_required:business  (matches its ProGate)
--   paid business store        → writes normally
--   super admin                → writes normally

create or replace function public.enforce_store_plan()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare v_required text := tg_argv[0];
begin
  -- Invoker, like the other guards: current_user separates a browser write from
  -- a SECURITY DEFINER RPC, a trigger or the service role.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if not public.store_has_plan(new.store_id, v_required) then
    raise exception 'plan_required:%', v_required;
  end if;
  return new;
end
$function$;

do $do$
declare t text;
begin
  foreach t in array array['automations', 'store_campaigns', 'stock_movements',
                           'store_suppliers', 'supplier_transactions']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_plan_gate', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.enforce_store_plan(%L)',
      t || '_plan_gate', t, 'business');
  end loop;
end
$do$;

create or replace function public.enforce_branch_plan()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if exists (select 1 from public.store_locations l where l.store_id = new.store_id)
     and not public.store_has_plan(new.store_id, 'business') then
    raise exception 'plan_required:business';
  end if;
  return new;
end
$function$;

drop trigger if exists store_locations_plan_gate on public.store_locations;
create trigger store_locations_plan_gate
  before insert on public.store_locations
  for each row execute function public.enforce_branch_plan();
