-- Lightweight demand-sensing for the Business Hub tools: which tools do merchants
-- actually use? One row per meaningful use (calculate/generate/print). Written
-- only through a SECURITY DEFINER RPC so the table itself stays locked; super
-- admins can read aggregates. This turns the tools into free user research.
-- Applied to production via Supabase migration `hub_tool_events`.

create table public.hub_tool_events (
  id         uuid primary key default gen_random_uuid(),
  tool       text not null,
  user_id    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index hub_tool_events_tool_idx on public.hub_tool_events (tool, created_at desc);

alter table public.hub_tool_events enable row level security;
-- No insert/select for the public; only super admins may read.
create policy hub_tool_events_admin_read on public.hub_tool_events
  for select using (is_super_admin());

create or replace function public.log_tool_use(p_tool text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_tool is null or length(p_tool) > 60 then return; end if;
  insert into public.hub_tool_events (tool, user_id) values (p_tool, auth.uid());
end;
$$;
revoke all on function public.log_tool_use(text) from public;
grant execute on function public.log_tool_use(text) to anon, authenticated;
