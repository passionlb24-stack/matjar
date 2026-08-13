-- The enrolment code is six digits behind an open door, guessable forever.
--
-- /api/clock/register is public by design: the employee has no Matjar account,
-- so there is nothing to log in with. What stands in for a password is the
-- six-digit code the owner reads out, and nothing counts how many times it comes
-- back wrong. The clock page's address is derivable from the shop's own public
-- link — short_code is the first eight characters of the store id — so "nobody
-- knows the URL" was never the protection, and I should not have shipped the
-- code as though it were.
--
-- The window is narrow (a code lives ten minutes and dies on first use) and the
-- payoff is capped (an enrolled phone still has to stand inside the geofence to
-- punch). Neither is a reason to let a public endpoint take unlimited guesses at
-- a secret.
--
-- Five wrong codes lock the shop's enrolment for fifteen minutes. It cannot lock
-- anyone out of work: punching is a different function on a different
-- credential, and an owner interrupted mid-enrolment waits, or issues a fresh
-- code after.

-- Its own table, not the old clock_attempts: that one was dropped with the PIN
-- in 0263, and recreating it would resurrect a name that means "someone tried to
-- clock in". These are strangers guessing at a code, which is a different event
-- with a different retention story.
create table if not exists public.enrolment_attempts (
  id bigserial primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Null on a miss: a wrong code matches nobody, and guessing which employee was
  -- meant would put a name on an event that never identified one.
  employee_id uuid,
  ok boolean not null,
  at timestamptz not null default now()
);

create index if not exists enrolment_attempts_store_at_idx
  on public.enrolment_attempts (store_id, at desc);

-- RLS on with no policy at all: nothing reaches this table through PostgREST.
-- The only writer is the SECURITY DEFINER function below.
alter table public.enrolment_attempts enable row level security;
revoke all on table public.enrolment_attempts from public, anon, authenticated;

-- The return type changes from uuid to jsonb, so this cannot be a replace.
drop function if exists public.redeem_enrolment_code(uuid, text);

create function public.redeem_enrolment_code(p_store_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_emp uuid;
  v_bad integer;
begin
  select count(*) into v_bad
  from public.enrolment_attempts
  where store_id = p_store_id
    and not ok
    and at > now() - interval '15 minutes';

  if v_bad >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  select id, employee_id into v_id, v_emp
  from public.employee_enrolments
  where store_id = p_store_id
    and code = btrim(p_code)
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  -- This is why the function returns an outcome instead of raising, and 0259 is
  -- where I learned it: a `raise` rolls back the insert that records the
  -- failure, so the counter never moves and the limiter is decoration.
  if v_id is null then
    insert into public.enrolment_attempts (store_id, employee_id, ok)
    values (p_store_id, null, false);
    return jsonb_build_object('ok', false, 'reason', 'bad_code');
  end if;

  update public.employee_enrolments set used_at = now() where id = v_id;

  -- Successes are logged too, so a lockout window can never be read back without
  -- also showing the enrolment that legitimately ended it.
  insert into public.enrolment_attempts (store_id, employee_id, ok)
  values (p_store_id, v_emp, true);

  return jsonb_build_object('ok', true, 'employee_id', v_emp);
end
$function$;

-- Same posture as 0262: only the service role behind /api/clock/register calls
-- this. Revoking from `public` alone is not enough — Supabase grants anon and
-- authenticated directly, which is the hole 0258 existed to close.
revoke all on function public.redeem_enrolment_code(uuid, text)
  from public, anon, authenticated;
