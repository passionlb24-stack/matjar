-- Fix: in the messages list, the sender's name never showed to the recipient.
-- my_conversations returned store_name + other_name and the UI always preferred
-- store_name — so a STORE OWNER saw their OWN store's name instead of the
-- customer who messaged them, and unnamed users fell through to "unknown".
-- Add a viewer-aware display_name: a customer talking to a store sees the store;
-- the store owner (and any person-to-person chat) sees the other person's name,
-- falling back to their email when they never set a full name.
-- Return type gains display_name, so the old signature must be dropped first.
drop function if exists public.my_conversations();
create or replace function public.my_conversations()
returns table (
  conversation_id uuid, store_id uuid, store_name text,
  other_name text, display_name text, last_body text,
  last_at timestamptz, unread boolean
) language sql stable security definer set search_path = '' as $$
  select c.id, c.store_id, s.name as store_name,
    op.full_name as other_name,
    case
      when c.store_id is not null and s.owner_id <> mp.user_id then s.name
      else coalesce(nullif(trim(op.full_name), ''), op.email)
    end as display_name,
    lm.body as last_body, c.last_message_at as last_at,
    (mp.last_read_at is null or c.last_message_at > mp.last_read_at) as unread
  from public.conversation_participants mp
  join public.conversations c on c.id = mp.conversation_id
  left join public.stores s on s.id = c.store_id
  left join lateral (
    select p.full_name, u.email
    from public.conversation_participants cp2
    join public.profiles p on p.id = cp2.user_id
    left join auth.users u on u.id = p.id
    where cp2.conversation_id = c.id and cp2.user_id <> mp.user_id
    limit 1
  ) op on true
  left join lateral (
    select body from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where mp.user_id = auth.uid()
  order by c.last_message_at desc;
$$;
grant execute on function public.my_conversations() to authenticated;
