-- Phase 1 — auth security hardening (resolves Supabase security advisors).

-- Pin search_path so the trigger function can't be hijacked via a mutable path.
alter function public.set_updated_at() set search_path = '';

-- handle_new_user runs from a trigger as the table owner; no client role
-- should be able to invoke it directly through the REST RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
