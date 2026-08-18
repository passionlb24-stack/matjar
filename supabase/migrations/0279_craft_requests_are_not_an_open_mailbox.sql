-- craft_requests took unlimited anonymous mail, and let the sender grade it
-- (MP-008 + MP-009).
--
-- Two holes in 0239, one table:
--
--   * INSERT had no rate limit. Anyone, signed in or not, could write unbounded
--     rows carrying a phone, a home address and photos into a tradesman's
--     inbox. Guests must stay able to ask — that is most of this market — so
--     the fix is a count, not a login wall.
--   * UPDATE had no WITH CHECK and no status rules. A customer could set their
--     own request to 'completed' — which is the precondition craft_reviews
--     uses for a "verified" review (0239:88-98), so the review gate was
--     self-attestable. They could also reassign the request to a different
--     provider, pushing their address and phone to a tradesman who never
--     received it.
--
-- The limits count committed successful rows, so 0259's raise-rolls-back-the-
-- evidence trap does not apply: a refused insert needs no record, because the
-- refusal is computed from inserts that succeeded. That is why this can be a
-- policy that raises (the client already shows a generic error for a failed
-- insert) instead of an RPC returning an outcome.

-- The counter must see all rows, but anon can read none of them (0239's read
-- policy is parties-only) — a plain subquery in the policy would count zero
-- and never limit anything. SECURITY DEFINER lifts the count above RLS; the
-- grant back to anon/authenticated is required because policy expressions run
-- as the inserting role. It returns only under/over, never the rows.
create or replace function public.craft_request_within_limits(p_provider uuid, p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- 5/hour per phone mirrors create_lead (0190); 15/hour per provider is the
  -- inbox backstop for a script inventing a fresh phone per row. Both are far
  -- above what a person asking for a plumber does in an hour.
  select (select count(*) from public.craft_requests
          where phone = p_phone
            and created_at > now() - interval '1 hour') < 5
     and (select count(*) from public.craft_requests
          where provider_id = p_provider
            and created_at > now() - interval '1 hour') < 15;
$$;

revoke all on function public.craft_request_within_limits(uuid, text)
  from public, anon, authenticated;
grant execute on function public.craft_request_within_limits(uuid, text)
  to anon, authenticated;

drop policy if exists craft_requests_insert on public.craft_requests;
create policy craft_requests_insert on public.craft_requests
  for insert with check (
    (customer_id is null or customer_id = (select auth.uid()))
    and public.craft_request_within_limits(provider_id, phone)
  );

-- WITH CHECK cannot see OLD, so immutability and transitions live in a
-- trigger, same shape as guard_order_status_transition (0246): invoker, out of
-- the way for server-side paths, admin as the escape hatch.
create or replace function public.guard_craft_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- SECURITY DEFINER RPCs and the service role carry their own rules.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;

  -- A request is addressed to one tradesman. Re-addressing it would hand the
  -- customer's phone and address to someone they never contacted.
  if new.provider_id is distinct from old.provider_id then
    raise exception 'craft_request_provider_immutable' using errcode = '42501',
      hint = 'A request cannot be moved to a different provider.';
  end if;

  if new.status is distinct from old.status then
    -- The provider moves the work along — accepted, in_progress, completed,
    -- declined are all statements about their own work.
    if public.owns_craft_provider(old.provider_id) then
      return new;
    end if;
    -- The customer's only move is to withdraw the ask, and a finished job can
    -- no longer be withdrawn. 'completed' in particular is the provider's word,
    -- because it is what unlocks a verified review.
    if new.status <> 'cancelled' or old.status = 'completed' then
      raise exception 'craft_request_status_not_yours' using errcode = '42501',
        hint = 'Customers can only cancel a request that is not completed.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists craft_requests_guard_update on public.craft_requests;
create trigger craft_requests_guard_update
  before update on public.craft_requests
  for each row execute function public.guard_craft_request_update();

revoke execute on function public.guard_craft_request_update()
  from public, anon, authenticated;

-- The 0239 policy had USING with no WITH CHECK, so an updated row was free to
-- leave the updater's own visibility. Mirror them.
drop policy if exists craft_requests_update on public.craft_requests;
create policy craft_requests_update on public.craft_requests
  for update using (
    customer_id = (select auth.uid())
    or public.owns_craft_provider(provider_id)
    or public.is_super_admin()
  )
  with check (
    customer_id = (select auth.uid())
    or public.owns_craft_provider(provider_id)
    or public.is_super_admin()
  );

-- ============================================================================
-- ROLLED-BACK TEST  (run against prod inside begin;…rollback; — it PASSED)
-- ============================================================================
-- Expected: RESULT PASS phone_cap=t inbox_cap=t self_complete_blocked=t
--           reassign_blocked=t cancel_ok=t provider_completes=t
-- As anon (set local role + jwt claims): the 6th same-phone insert in an hour
-- and the 16th same-provider insert were both refused with 42501; a fresh
-- phone passed. As the customer (authenticated): setting own request to
-- 'completed' and reassigning provider_id both refused; 'cancelled' allowed.
-- As the provider: 'completed' allowed.
