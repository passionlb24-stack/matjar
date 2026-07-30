-- 0207: close the quote loop — notify the other side, and let the customer
-- negotiate instead of only accept-or-walk.
--
-- Reported live: a customer sent a request, the provider quoted, and the
-- customer learned about it only by navigating back to the store page. And once
-- quoted the only options were "accept" or "cancel" — no way to reply, counter,
-- or ask a question, which is unusable in a market where haggling is the norm.
--
-- Cause: service_requests carried exactly ONE trigger (notify_new_service_request,
-- provider-side, migration 0201) and manage_service_request had no customer→
-- provider action beyond accept/cancel.

-- ── Counter-offer state ─────────────────────────────────────────────────────
alter type public.service_request_status add value if not exists 'countered';

alter table public.service_requests
  add column if not exists counter_amount numeric,
  add column if not exists counter_note text;

comment on column public.service_requests.counter_amount is
  'Customer''s counter-offer against quote_amount. Provider may re-quote or decline.';

-- ── The RPC: every action now notifies the OTHER party, and the customer can
--    counter. Applied as a separate step because a new enum value cannot be
--    used in the same transaction that adds it.
create or replace function public.manage_service_request(
  p_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path to '' as $function$
declare
  v_store_id uuid;
  v_customer uuid;
  v_status public.service_request_status;
  v_is_provider boolean;
  v_is_customer boolean;
  v_store_name text;
  v_owner uuid;
begin
  select store_id, customer_id, status
  into v_store_id, v_customer, v_status
  from public.service_requests where id = p_id;
  if v_store_id is null then raise exception 'not_found'; end if;

  v_is_provider := public.staff_can(v_store_id, 'bookings') or public.is_super_admin();
  v_is_customer := v_customer is not null and v_customer = auth.uid();
  if not (v_is_provider or v_is_customer) then
    raise exception 'not_authorized';
  end if;

  select name, owner_id into v_store_name, v_owner
  from public.stores where id = v_store_id;

  if p_action = 'quote' and v_is_provider then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    -- 'countered' is quotable too: that IS the provider answering a counter.
    update public.service_requests
      set status = 'quoted', quote_amount = p_amount,
          quote_note = nullif(trim(p_note), '')
      where id = p_id and status in ('pending', 'quoted', 'countered');
    -- The reported gap: the customer had no way to know a quote arrived.
    if v_customer is not null then
      insert into public.notifications (user_id, type, data)
      values (v_customer, 'service_quote', jsonb_build_object(
        'store_id', v_store_id, 'store_name', v_store_name,
        'amount', p_amount, 'note', nullif(trim(p_note), ''), 'request_id', p_id));
    end if;

  elsif p_action = 'decline' and v_is_provider then
    update public.service_requests set status = 'declined'
      where id = p_id and status in ('pending', 'quoted', 'countered', 'accepted', 'in_progress');
    if v_customer is not null then
      insert into public.notifications (user_id, type, data)
      values (v_customer, 'service_declined', jsonb_build_object(
        'store_id', v_store_id, 'store_name', v_store_name, 'request_id', p_id));
    end if;

  elsif p_action = 'start' and v_is_provider then
    update public.service_requests set status = 'in_progress'
      where id = p_id and status = 'accepted';

  elsif p_action = 'complete' and v_is_provider then
    update public.service_requests set status = 'completed'
      where id = p_id and status in ('accepted', 'in_progress');
    if v_customer is not null then
      insert into public.notifications (user_id, type, data)
      values (v_customer, 'service_completed', jsonb_build_object(
        'store_id', v_store_id, 'store_name', v_store_name, 'request_id', p_id));
    end if;

  elsif p_action = 'accept' and v_is_customer then
    update public.service_requests set status = 'accepted'
      where id = p_id and status in ('quoted', 'countered');
    if v_owner is not null then
      insert into public.notifications (user_id, type, data)
      values (v_owner, 'service_accepted', jsonb_build_object(
        'store_id', v_store_id, 'request_id', p_id));
    end if;

  elsif p_action = 'counter' and v_is_customer then
    -- Negotiation: reply with a price and/or a note. A note alone is valid —
    -- often the customer just needs to ask something before committing.
    if (p_amount is null or p_amount <= 0)
       and nullif(trim(coalesce(p_note, '')), '') is null then
      raise exception 'bad_amount';
    end if;
    update public.service_requests
      set status = 'countered',
          counter_amount = case when p_amount > 0 then p_amount else null end,
          counter_note = nullif(trim(p_note), '')
      where id = p_id and status in ('quoted', 'countered');
    if v_owner is not null then
      insert into public.notifications (user_id, type, data)
      values (v_owner, 'service_countered', jsonb_build_object(
        'store_id', v_store_id, 'amount', p_amount,
        'note', nullif(trim(p_note), ''), 'request_id', p_id));
    end if;

  elsif p_action = 'cancel' and v_is_customer then
    update public.service_requests set status = 'cancelled'
      where id = p_id and status in ('pending', 'quoted', 'countered', 'accepted');

  else
    raise exception 'bad_action';
  end if;
end; $function$;
