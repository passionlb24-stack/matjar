-- In-app messaging: 1:1 conversations (optionally about a store) + messages.
-- This is the connective tissue for buyer<->seller, and later client<->freelancer,
-- employer<->applicant, wholesale, etc. WhatsApp stays as a fallback.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conv_participants_user_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Membership check (SECURITY DEFINER avoids recursive RLS on the participants table).
create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated using (public.is_conversation_participant(id));

drop policy if exists participants_select on public.conversation_participants;
create policy participants_select on public.conversation_participants
  for select to authenticated using (public.is_conversation_participant(conversation_id));

drop policy if exists participants_update_own on public.conversation_participants;
create policy participants_update_own on public.conversation_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  );

-- On a new message: bump the conversation and notify the other participant(s),
-- which flows into the existing notification -> web-push pipeline.
create or replace function public.on_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
    set last_message_at = new.created_at where id = new.conversation_id;
  insert into public.notifications (user_id, type, data)
  select cp.user_id, 'message',
         jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id;
  return new;
end; $$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_new_message();

-- Find or create a 1:1 conversation with another user (same store context).
create or replace function public.start_conversation(p_other_user uuid, p_store_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_conv uuid;
begin
  if v_me is null or p_other_user is null or p_other_user = v_me then
    raise exception 'invalid_conversation';
  end if;
  select c.id into v_conv
  from public.conversations c
  where (c.store_id is not distinct from p_store_id)
    and (select count(*) from public.conversation_participants cp
         where cp.conversation_id = c.id) = 2
    and exists (select 1 from public.conversation_participants
                where conversation_id = c.id and user_id = v_me)
    and exists (select 1 from public.conversation_participants
                where conversation_id = c.id and user_id = p_other_user)
  limit 1;
  if v_conv is not null then return v_conv; end if;

  insert into public.conversations (store_id) values (p_store_id) returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_me), (v_conv, p_other_user);
  return v_conv;
end; $$;
grant execute on function public.start_conversation(uuid, uuid) to authenticated;

-- Message a store: resolves the owner and starts/reuses the conversation.
create or replace function public.start_store_conversation(p_store_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.stores
    where id = p_store_id and status = 'active' and deleted_at is null;
  if v_owner is null then raise exception 'store_unavailable'; end if;
  return public.start_conversation(v_owner, p_store_id);
end; $$;
grant execute on function public.start_store_conversation(uuid) to authenticated;

-- Enriched inbox for the current user (one round-trip, no N+1).
create or replace function public.my_conversations()
returns table (
  conversation_id uuid, store_id uuid, store_name text,
  other_name text, last_body text, last_at timestamptz, unread boolean
) language sql stable security definer set search_path = '' as $$
  select c.id, c.store_id, s.name as store_name,
    op.full_name as other_name,
    lm.body as last_body, c.last_message_at as last_at,
    (mp.last_read_at is null or c.last_message_at > mp.last_read_at) as unread
  from public.conversation_participants mp
  join public.conversations c on c.id = mp.conversation_id
  left join public.stores s on s.id = c.store_id
  left join lateral (
    select p.full_name from public.conversation_participants cp2
    join public.profiles p on p.id = cp2.user_id
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

-- Count unread conversations (for the nav badge).
create or replace function public.unread_conversation_count()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.conversation_participants mp
  join public.conversations c on c.id = mp.conversation_id
  where mp.user_id = auth.uid()
    and (mp.last_read_at is null or c.last_message_at > mp.last_read_at)
    and exists (select 1 from public.messages m where m.conversation_id = c.id);
$$;
grant execute on function public.unread_conversation_count() to authenticated;

-- Add a 'message' case to the push mapping (else-fallback already handles it,
-- but a dedicated label is nicer).
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
