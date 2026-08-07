-- 0233: count every paid tier, and stop the CRM guessing past 1000 orders.
--
-- 1. admin_platform_report counted `plan = 'pro'` and published it as
--    pro_stores, with the conversion rate derived from it. Basic and Business
--    stores were invisible — a Business store, the most expensive tier, did not
--    register as a paying customer at all. On live data the figure moves from
--    10 to 13 the moment Basic and Business are included.
--
--    Worth knowing while reading that number: 13 stores carry a paid plan and
--    public.subscriptions holds zero rows. stores.plan is set directly by the
--    admin UI, so today it is the only record of who pays, and it does not
--    agree with the billing table. That is a data question, not a code one.
--
-- 2. The CRM built each customer's lifetime spend by fetching every order for
--    the store and reducing in JavaScript. PostgREST returns at most 1000 rows
--    and does not say when it truncated, so beyond a thousand orders every
--    total on that screen was wrong — and wrong quietly, with a believable
--    number in place of the real one. store_customer_order_totals does the same
--    grouping in the database: signed-in customers key on their id, guests on
--    their phone, exactly as the JavaScript did.
--
-- The RPC is SECURITY DEFINER and re-checks can_manage_store inside the query,
-- so it cannot be used to read another store's customer book.

do $do$
declare d text; d2 text;
begin
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace='public'::regnamespace and proname='admin_platform_report';
  if d is null then raise exception 'admin_platform_report not found'; end if;

  d2 := replace(d,
    $q$    count(*) filter (where plan = 'pro')::int,$q$,
    $q$    count(*) filter (where plan in ('basic', 'pro', 'business'))::int,$q$);
  if d2 = d then raise exception 'pro count did not match'; end if;

  execute d2;
end
$do$;

create or replace function public.store_customer_order_totals(p_store_id uuid)
returns table(
  customer_key  text,
  customer_id   uuid,
  customer_name text,
  phone         text,
  order_count   int,
  total_spent   numeric,
  last_order    timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    coalesce(o.customer_id::text, o.phone, 'anon')                  as customer_key,
    (array_agg(o.customer_id) filter (where o.customer_id is not null))[1] as customer_id,
    (array_agg(o.customer_name) filter (where o.customer_name is not null))[1] as customer_name,
    (array_agg(o.phone) filter (where o.phone is not null))[1]      as phone,
    count(*)::int                                                   as order_count,
    coalesce(sum(o.total), 0)                                       as total_spent,
    max(o.created_at)                                               as last_order
  from public.orders o
  where o.store_id = p_store_id
    and public.can_manage_store(p_store_id)
  group by coalesce(o.customer_id::text, o.phone, 'anon');
$function$;

revoke execute on function public.store_customer_order_totals(uuid) from anon;
grant execute on function public.store_customer_order_totals(uuid) to authenticated;
