-- A merchant can currently grant themselves a verification badge.
--
-- `store_verifications_manage` is FOR ALL USING (is_store_owner(store_id) OR
-- is_super_admin()), and `status` is an ordinary column. So the row a merchant
-- inserts to REQUEST verification can be written with status 'verified' in the
-- same request — and `store_verifications_public_read` is `status = 'verified'`,
-- so the badge appears on the storefront immediately. The admin queue filters
-- `status = 'submitted'`, so it never appears there. The person reviewing sees
-- nothing; the customer sees a verified business.
--
-- I executed this against the live policies as an ordinary merchant, in a
-- rolled-back transaction: insert with status 'verified' succeeded, the public
-- read returned it, and the review queue returned zero.
--
-- The same class of hole was closed on `profiles` (0224) and `stores` (0217)
-- with BEFORE-write guards. This table was missed. It is contained today only
-- because it has no rows.
--
-- The guard is SECURITY INVOKER — the default, and load-bearing rather than
-- incidental, exactly as 0217 explains. As invoker, `current_user` is the role
-- PostgREST authenticated the request as: `authenticated` for a signed-in user,
-- `anon` for a guest. Any legitimate writer of a verification outcome arrives
-- some other way (a SECURITY DEFINER RPC, or the postgres role), so none of them
-- need an exception. The admin UI is the one case that does arrive as
-- `authenticated`, and is_super_admin() lets exactly that through.

-- ---------------------------------------------------------------- the record --
-- A verification decision that records no reviewer and no reason is not a
-- decision, it is a value. The brief asks for evidence of who decided and why;
-- these are the minimum that makes the status defensible after the fact.
alter table public.store_verifications
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

-- 'submitted' is kept rather than renamed to 'pending': /admin/verifications
-- filters on it, and renaming a live vocabulary to match a document is how a
-- review queue silently empties.
alter table public.store_verifications
  drop constraint if exists store_verifications_status_known;
alter table public.store_verifications
  add constraint store_verifications_status_known
  check (status in ('submitted', 'verified', 'rejected', 'expired', 'suspended'));

comment on column public.store_verifications.status is
  'submitted = awaiting review (the admin queue). verified = a human approved it. rejected/expired/suspended = not shown publicly. Writable only by a super admin or a SECURITY DEFINER path — see the guard below.';

-- ----------------------------------------------------------------- the guard --
create or replace function public.guard_verification_outcome()
returns trigger
language plpgsql
as $function$
begin
  -- Not a browser: a SECURITY DEFINER RPC or the postgres role. Those are the
  -- paths that are allowed to decide, so nothing is reverted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A merchant may ASK. Asking is always 'submitted', whatever they sent.
    new.status := 'submitted';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
    return new;
  end if;

  -- A merchant may correct the details of their own submission — the title, the
  -- issuer, the number. They may not touch the verdict.
  new.status := old.status;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.rejection_reason := old.rejection_reason;
  return new;
end
$function$;

drop trigger if exists store_verifications_guard on public.store_verifications;
create trigger store_verifications_guard
  before insert or update on public.store_verifications
  for each row execute function public.guard_verification_outcome();

-- ------------------------------------------------------------ what is public --
-- An expired credential is not a current one. The public read used to say only
-- `status = 'verified'`, so a licence that lapsed last year kept its badge until
-- somebody noticed and edited the row by hand.
drop policy if exists store_verifications_public_read on public.store_verifications;
create policy store_verifications_public_read on public.store_verifications
  for select using (
    status = 'verified'
    and (expires_on is null or expires_on >= (now() at time zone 'Asia/Beirut')::date)
  );
