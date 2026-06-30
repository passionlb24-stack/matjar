-- Lightweight platform settings (key/value). First use: the USD→LBP exchange
-- rate, shown to buyers next to USD prices. Admin-editable.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('usd_lbp_rate', '89500')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Public config is readable by anyone; only admins can change it.
create policy app_settings_select on public.app_settings
  for select using (true);
create policy app_settings_write_admin on public.app_settings
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());
