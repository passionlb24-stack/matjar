-- record_checkout_intent takes any phone number from anyone, forever (MP-006).
--
-- It is anon-callable by design — guest checkout is the whole point — but
-- nothing counted how often it was called. Anyone could plant arbitrary phone
-- numbers against any active store; thirty minutes later the scanner hands the
-- merchant a one-tap wa.me link to a number whose owner never visited the
-- site, and checkout_intents grows without bound.
--
-- Two counts, both generous, both silently no-oping (the function's contract
-- since 0120 is fire-and-forget: it must NEVER raise into checkout — which is
-- also 0259's lesson satisfied for free, since what we count are committed
-- successful rows, not failure records a raise would destroy):
--
--   * A phone may appear in at most 5 intents created in the last hour. A real
--     shopper reaching the confirm button at 5 different stores inside an hour
--     is not a customer, it is a script. Re-arming an intent a store already
--     holds is always allowed: that store already has this phone, so repeating
--     it adds no new exposure — and a customer retrying a failed order at the
--     same shop must not be counted like an attacker.
--   * A store may gain at most 60 new intents in the last hour. The per-phone
--     cap does nothing against a script inventing a fresh number per call;
--     this is the flood backstop for the table itself. Legit intents are now
--     one per tapped confirm button (the client stopped capturing on blur),
--     so 60/hour is far above a busy Lebanese storefront.
--
-- No IP is visible from SQL, so the keys are what actually exists in the row:
-- the phone being planted and the store being flooded.

-- The two counting queries need these; the existing scan index is partial
-- (notified_at is null) and ordered by updated_at, so neither count can use it.
create index if not exists checkout_intents_phone_created_idx
  on public.checkout_intents (phone, created_at desc);
create index if not exists checkout_intents_store_created_idx
  on public.checkout_intents (store_id, created_at desc);

create or replace function public.record_checkout_intent(
  p_store_id uuid,
  p_phone text,
  p_name text default null,
  p_items jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  -- Store must exist and be active.
  perform 1 from public.stores where id = p_store_id and status = 'active';
  if not found then
    return;
  end if;

  -- Plausible phone only (trimmed length >= 4).
  v_phone := btrim(coalesce(p_phone, ''));
  if length(v_phone) < 4 then
    return;
  end if;

  -- Rate limits apply only to NEW rows; re-arming an existing (store, phone)
  -- intent is always allowed — see the header.
  if not exists (
    select 1 from public.checkout_intents
    where store_id = p_store_id and phone = v_phone
  ) then
    if (select count(*) from public.checkout_intents
        where phone = v_phone
          and created_at > now() - interval '1 hour') >= 5 then
      return;
    end if;
    if (select count(*) from public.checkout_intents
        where store_id = p_store_id
          and created_at > now() - interval '1 hour') >= 60 then
      return;
    end if;
  end if;

  insert into public.checkout_intents
    (store_id, phone, customer_name, customer_id, items, updated_at, notified_at)
  values
    (p_store_id, v_phone, nullif(btrim(coalesce(p_name, '')), ''),
     auth.uid(), coalesce(p_items, '[]'::jsonb), now(), null)
  on conflict (store_id, phone) do update
    set customer_name = excluded.customer_name,
        customer_id   = excluded.customer_id,
        items         = excluded.items,
        updated_at    = now(),
        notified_at   = null;  -- re-arm: a new attempt is not yet "abandoned"

exception when others then
  null;  -- fire-and-forget: never surface an error into checkout.
end;
$$;

-- Same audience as 0120: the public storefront, guests included. CREATE OR
-- REPLACE keeps the existing ACL, but the house rule (0258) is to say it out
-- loud rather than trust what happens to be there.
revoke all on function public.record_checkout_intent(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_checkout_intent(uuid, text, text, jsonb)
  to anon, authenticated;

-- ============================================================================
-- ROLLED-BACK TEST  (run against prod inside begin;…rollback; — it PASSED)
-- ============================================================================
-- Expected: RESULT PASS blocked_at_5=5 rearm_name=Rearmed fresh_ok=1 flood_held=60
-- Seeded 7 stores; planted one phone at 5 of them, saw the 6th silently no-op;
-- re-armed the intent at store 1 (allowed, name updated); inserted a fresh
-- phone (allowed); seeded 60 intents at store 7 and saw the 61st no-op.
