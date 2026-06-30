-- is_super_admin() is referenced by the profiles SELECT policy, and the function
-- itself reads from profiles. Without SECURITY DEFINER the inner read re-triggers
-- the policy -> infinite recursion ("stack depth limit exceeded") for any
-- super_admin reading other users' rows (e.g. the admin dashboard user count).
-- SECURITY DEFINER makes the internal profiles read bypass RLS, breaking the
-- cycle. Safe: no dynamic SQL, empty search_path, returns only a boolean about
-- the current auth.uid().
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$function$;
