-- Stream notification inserts to the signed-in user so the bell badge updates
-- live instead of only on refresh. RLS still applies to the realtime channel,
-- and the client also filters by user_id.
alter publication supabase_realtime add table public.notifications;
