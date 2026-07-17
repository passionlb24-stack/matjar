-- Consistency hardening: trigger functions default to PUBLIC execute. They can't
-- actually be invoked directly (Postgres rejects a `returns trigger` call outside
-- a trigger), so this is not exploitable — but every other function in the schema
-- revokes public/anon, and the advisor flags these. Bring them in line.
revoke execute on function public.log_order_status_change() from public, anon;
revoke execute on function public.create_primary_location() from public, anon;
revoke execute on function public.enforce_single_primary_location() from public, anon;
