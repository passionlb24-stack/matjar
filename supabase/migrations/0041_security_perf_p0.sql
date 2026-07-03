-- P0 audit fixes (2026-07-03).

-- 1. Trigger functions were REST-callable via the default PUBLIC EXECUTE grant.
--    They only ever fire from triggers (owner context), so remove the exposure.
--    (is_super_admin / user_is_active are intentionally left callable — they are
--    used inside RLS policies and only reveal facts about the caller.)
revoke execute on function public.bump_coupon_use() from public;
revoke execute on function public.notify_followers_new_product() from public;

-- 2. Missing FK index flagged by the performance advisor.
create index if not exists listing_reports_reporter_id_idx
  on public.listing_reports (reporter_id);
