-- 0223: let a section-scoped admin read the section they were granted.
--
-- The page guards and the RPC guards disagreed. requireAdminSection("orders")
-- lets a granular admin onto /admin/orders, but admin_orders_report() raised
-- not_authorized unless is_super_admin() — so the page loaded, the RPC failed,
-- and `report ?? {}` followed by `?? 0` rendered "$0 collected · 0 orders". The
-- admin was shown a confident, wrong answer rather than a refusal.
--
-- admin_can(section) already existed and already returns true for a super admin
-- (`p.role = 'super_admin' or p.admin_permissions ? section`), so swapping the
-- gate cannot take access away from anyone who has it today.
--
--   admin_orders_report         → admin_can('orders')    (page: requireAdminSection "orders")
--   admin_platform_report       → admin_can('reports')   (page: requireAdminSection "reports")
--   admin_report_distributions  → admin_can('reports')   (same page)
--
-- admin_list_push_subscriptions deliberately stays super-admin only: it is not
-- behind a section page, and it lists every device token on the platform.
--
-- Dormant today and verified so: the platform has 1 super admin and 0 granular
-- admins, so nobody is currently hitting this. It comes alive the first time an
-- operations person is hired, which is exactly when nobody will be looking for
-- it.
--
-- Verified on production inside rolled-back transactions. Granting ["orders"]
-- to a normal profile (as the super admin, since prevent_admin_perm_change
-- reverts the write otherwise) and then acting as that user:
--   admin_can('orders')       → true
--   admin_can('reports')      → false
--   admin_orders_report()     → returns data (was: not_authorized)
--   admin_platform_report()   → still not_authorized  ← scope holds

do $do$
declare
  d text; d2 text;
  targets constant text[][] := array[
    array['admin_orders_report',        'orders'],
    array['admin_platform_report',      'reports'],
    array['admin_report_distributions', 'reports']
  ];
  t text[];
begin
  foreach t slice 1 in array targets loop
    select pg_get_functiondef(oid) into d from pg_proc
     where pronamespace = 'public'::regnamespace and proname = t[1];
    if d is null then raise exception '% not found', t[1]; end if;

    d2 := replace(d,
      '  if not public.is_super_admin() then',
      '  if not public.admin_can(' || quote_literal(t[2]) || ') then');
    if d2 = d then raise exception 'gate in % did not match', t[1]; end if;

    execute d2;
  end loop;
end
$do$;
