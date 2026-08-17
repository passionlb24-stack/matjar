-- A cashier can read every colleague's salary. This one is mine.
--
-- `can_manage_store(store_id)` returns true for ANY row in `store_staff`,
-- regardless of that row's permission flags:
--
--   select exists (... stores where owner_id = auth.uid())
--       or exists (... store_staff where user_id = auth.uid());
--
-- and it is the entire USING clause on nine HR policies. So a person added as
-- staff with {"products": true} — a cashier, a stock clerk — can read
-- `store_employees` (pay_rate, id_number, residency_expires_on),
-- `employee_attendance` (GPS coordinates of every punch), `employee_advances`,
-- `payroll_runs` and `payroll_lines`.
--
-- And `employee_enrolments`, which holds the six-digit codes in plain text while
-- they are live. I argued at length that those codes must be read out face to
-- face because they stand in for a password. That was true about the door and
-- false about the database: any staff member could read a live code and enrol
-- their own phone against a colleague's name — which is precisely the
-- buddy-punching the WebAuthn clock-in exists to prevent.
--
-- HR is already `ownerOnly: true` in OS_MODULE_META (sectors.ts). The menu knew.
-- The row-level policies did not.
--
-- `can_manage_store` itself is NOT changed here. It has 221 occurrences across
-- 81 migrations, and quietly narrowing it would revoke access that orders,
-- products and bookings staff legitimately rely on. The permission-aware
-- alternative already exists as `staff_can(store_id, perm)`; HR simply has no
-- staff permission that should grant it, so owner-or-admin is the correct and
-- narrowest expression.

-- store_employees — pay rates, national id numbers, residency dates
drop policy if exists store_employees_all on public.store_employees;
create policy store_employees_all on public.store_employees
  for all using (public.is_store_owner(store_id) or public.is_super_admin())
  with check (public.is_store_owner(store_id) or public.is_super_admin());

-- employee_attendance — where each person was, to six decimal places
drop policy if exists employee_attendance_all on public.employee_attendance;
create policy employee_attendance_all on public.employee_attendance
  for all using (public.is_store_owner(store_id) or public.is_super_admin())
  with check (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists employee_breaks_read on public.employee_breaks;
create policy employee_breaks_read on public.employee_breaks
  for select using (
    exists (
      select 1 from public.employee_attendance a
      where a.id = employee_breaks.attendance_id
        and (public.is_store_owner(a.store_id) or public.is_super_admin())
    )
  );

-- employee_advances / payroll — money owed to and paid to named people
drop policy if exists employee_advances_all on public.employee_advances;
create policy employee_advances_all on public.employee_advances
  for all using (public.is_store_owner(store_id) or public.is_super_admin())
  with check (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists payroll_runs_all on public.payroll_runs;
create policy payroll_runs_all on public.payroll_runs
  for all using (public.is_store_owner(store_id) or public.is_super_admin())
  with check (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists payroll_lines_read on public.payroll_lines;
create policy payroll_lines_read on public.payroll_lines
  for select using (
    exists (
      select 1 from public.payroll_runs r
      where r.id = payroll_lines.run_id
        and (public.is_store_owner(r.store_id) or public.is_super_admin())
    )
  );

-- The credential surface. These two are the buddy-punching path.
drop policy if exists employee_enrolments_read on public.employee_enrolments;
create policy employee_enrolments_read on public.employee_enrolments
  for select using (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists employee_devices_read on public.employee_devices;
create policy employee_devices_read on public.employee_devices
  for select using (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists employee_devices_delete on public.employee_devices;
create policy employee_devices_delete on public.employee_devices
  for delete using (public.is_store_owner(store_id) or public.is_super_admin());

-- ------------------------------------------------------------ anon-callable --
-- Two SECURITY DEFINER functions are executable by `anon`.
--
-- `get_push_subs(p_uid, p_secret)` returns a user's push endpoint and keys for
-- any uid, gated only by a shared secret passed as an argument. 0196 named this
-- MJ-A02 and declined to fix it. It is harmless today because the platform has
-- zero push subscriptions — and stops being harmless the moment anyone enables
-- notifications, which is advice I gave this week.
--
-- `run_trial_maintenance()` expires trials and parks merchant products. Nothing
-- inside it checks the caller.
--
-- Both are called by trusted paths that hold the service role, so revoking the
-- browser roles costs those paths nothing. 0258 is the precedent: revoking from
-- `public` alone does not remove Supabase's direct grants to `anon` and
-- `authenticated`, so both are named explicitly.
revoke all on function public.get_push_subs(uuid, text) from public, anon, authenticated;
revoke all on function public.run_trial_maintenance() from public, anon, authenticated;

-- ------------------------------------------- deliberately NOT changed here --
-- `store_assets_auth_insert` is `with check (bucket_id = 'store-assets')` and
-- nothing else, so any signed-in user may write anywhere in the public bucket.
-- Real, and it is NOT fixed in this migration on purpose.
--
-- The obvious fix — copy `digital_goods_owner_write` and require the first path
-- segment to be a store you own — would break uploads, because the paths are not
-- uniform: image-upload.tsx is handed `storeId` in 8 places but also the literals
-- `wholesale`, `gigs`, `reviews`, `listings`, and `crafts/${userId}`,
-- `verifications/${storeId}`, `portfolio/${storeId}`. A policy assuming one
-- shape would silently reject the others, and existing objects keep their old
-- paths regardless.
--
-- Fixing it properly means normalising the path convention across ~15 call sites
-- first, then scoping the policy. That is a code change with a migration behind
-- it, not a one-line policy edit, and it is tracked in ISSUES.csv rather than
-- half-done here. Scope note: the policy is granted to `authenticated` only —
-- an anonymous visitor cannot upload.
