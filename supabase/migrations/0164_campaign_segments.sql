-- Customer segments as campaign audiences. The campaign sender already targeted
-- 'followers' / 'customers' / 'all'; this adds behavioural segments so a
-- merchant can message just their repeat buyers, top customers, or dormant ones
-- (Salla's customer-groups value: segments that are actually actionable).
--
-- Segments are computed from order history per registered customer:
--   repeat   → 2+ orders
--   vip      → 3+ orders
--   inactive → has ordered, but last order was over 60 days ago (win-back)

create or replace function public.send_store_campaign(
  p_store_id uuid,
  p_title text,
  p_body text,
  p_url text default null,
  p_audience text default 'all'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_sent int;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body  text := btrim(coalesce(p_body, ''));
  v_url   text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'not_authorized';
  end if;

  if v_body = '' then
    raise exception 'empty_body';
  end if;

  if p_audience is null or p_audience not in
     ('followers', 'customers', 'all', 'repeat', 'vip', 'inactive') then
    raise exception 'bad_audience';
  end if;

  if exists (
    select 1 from public.store_campaigns
    where store_id = p_store_id
      and created_at > now() - interval '6 hours'
  ) then
    raise exception 'rate_limited';
  end if;

  insert into public.store_campaigns (store_id, title, body, url, audience, created_by)
  values (p_store_id, v_title, v_body, v_url, p_audience, auth.uid())
  returning id into v_campaign_id;

  -- Per-customer order stats, used by the behavioural segments.
  with cust as (
    select o.customer_id as uid,
           count(*) as cnt,
           max(o.created_at) as last_at
      from public.orders o
     where o.store_id = p_store_id and o.customer_id is not null
     group by o.customer_id
  ),
  recips as (
    -- Followers (only for the follower-inclusive audiences).
    select f.user_id as uid
      from public.follows f
     where f.store_id = p_store_id
       and p_audience in ('followers', 'all')
    union
    -- Everyone who ordered (for 'customers'/'all') or a specific segment.
    select c.uid
      from cust c
     where (p_audience in ('customers', 'all'))
        or (p_audience = 'repeat'   and c.cnt >= 2)
        or (p_audience = 'vip'      and c.cnt >= 3)
        or (p_audience = 'inactive' and c.last_at < now() - interval '60 days')
  ),
  capped as (
    select uid from recips limit 5000
  ),
  inserted as (
    insert into public.notifications (user_id, type, data)
    select c.uid,
           'store_campaign',
           jsonb_build_object(
             'title', v_title,
             'body', v_body,
             'url', coalesce(v_url, '/ar/store/' || p_store_id),
             'store_id', p_store_id,
             'campaign_id', v_campaign_id
           )
    from capped c
    returning 1
  )
  select count(*)::int into v_sent from inserted;

  update public.store_campaigns
    set sent_count = v_sent
    where id = v_campaign_id;

  return jsonb_build_object('campaign_id', v_campaign_id, 'sent', v_sent);
end;
$$;

revoke execute on function public.send_store_campaign(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.send_store_campaign(uuid, text, text, text, text)
  to authenticated;
