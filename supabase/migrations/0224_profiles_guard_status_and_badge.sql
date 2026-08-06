-- 0224: make a ban stick, and stop anyone awarding themselves the verified badge.
--
-- Same shape as 0217, on the last table that needed it. `profiles_update` is
-- `is_super_admin() OR auth.uid() = id` with no column list, and the two BEFORE
-- UPDATE guards that exist cover only `role` and `admin_permissions`. Everything
-- else on your own row was writable straight from the browser.
--
-- Two of those columns are not yours to write:
--
--   is_active           the suspension flag. A user the admin banned could send
--                       PATCH /rest/v1/profiles?id=eq.<self> {"is_active":true}
--                       and be back. A ban that the banned party can lift is
--                       not a ban, and nothing recorded that it happened.
--
--   freelancer_verified the trust badge the freelance marketplace is built on.
--                       lib/freelancer-trust.ts renders earned evidence tinted
--                       and declared evidence neutral, precisely so a shopper
--                       can tell a verdict from a promise — and this was the
--                       verdict, settable by the person being judged.
--                       freelancer_verified_at is guarded with it so a forged
--                       badge cannot be backdated either.
--
-- Every legitimate writer arrives another way, so nothing needed changing:
--   set_freelancer_verified()   SECURITY DEFINER  → runs as its owner
--   admin suspend/unsuspend     admin-users-client.tsx:77, as a super admin
--
-- Verified on production inside rolled-back transactions:
--   banned user PATCHes is_active=true, freelancer_verified=true
--                                        → both unchanged (false, false)
--   super admin sets is_active=false     → applies
--   user edits their own full_name       → applies
--   set_freelancer_verified() as admin   → sets both flag and timestamp

create or replace function public.guard_profile_platform_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- SECURITY INVOKER on purpose, as in 0217: current_user is the role PostgREST
  -- authenticated the request as, which is what separates a browser write from
  -- a SECURITY DEFINER RPC or the service role.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;

  new.is_active              := old.is_active;
  new.freelancer_verified    := old.freelancer_verified;
  new.freelancer_verified_at := old.freelancer_verified_at;
  return new;
end
$function$;

drop trigger if exists profiles_guard_platform_columns on public.profiles;
create trigger profiles_guard_platform_columns
  before update on public.profiles
  for each row execute function public.guard_profile_platform_columns();
