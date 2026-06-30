-- Section 5 — let super admins read all profiles (for the users overview).
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_super_admin());
