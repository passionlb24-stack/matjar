-- Booking has two exclusion constraints and neither one is doing anything.
--
-- `bookings_provider_no_overlap` and `bookings_solo_exclusive_no_overlap` are
-- both predicated on `starts_at IS NOT NULL` plus a specific `allocation_mode`.
-- On all 22 live bookings, **both of those columns are NULL** — the v2 engine
-- from 0174 shipped and nothing writes to it, so every real booking arrives
-- through the legacy shape (`requested_date` + `requested_time`) and matches
-- neither predicate. Verified against the live rows, not inferred.
--
-- The constraints are correct and are left alone: the day the v2 path starts
-- writing `starts_at`, they begin protecting those rows. What is missing is a
-- guard for the shape the product actually uses today.
--
-- WHAT MUST NOT BE GUARDED
--
-- Not every same-slot booking is a conflict. A restaurant taking three tables at
-- 20:00 is a restaurant having a good evening — those rows carry no `doctor_id`
-- and no `resource_id`, and there are three such rows in the data right now.
-- Uniqueness is therefore scoped to the two cases where the resource genuinely
-- cannot be in two places: a named provider, and a bookable resource (a court, a
-- room, a chair).
--
-- The store-wide case — a solo practitioner with no `doctor_id` row — cannot be
-- distinguished from a restaurant table on the legacy shape, because
-- `allocation_mode` is NULL there too. That gap is real and is recorded in
-- ISSUES.csv rather than papered over with a guess that would break restaurants.
--
-- Checked before writing: zero provider conflicts, zero resource conflicts and
-- zero over-capacity classes exist today, so none of this fails on creation.

-- A named provider is one person. Two customers cannot both have 15:00.
create unique index if not exists bookings_provider_slot_unique
  on public.bookings (doctor_id, requested_date, requested_time)
  where doctor_id is not null
    and status in ('pending', 'accepted', 'scheduled');

-- A court, a room, a chair. Same argument, different noun.
create unique index if not exists bookings_resource_slot_unique
  on public.bookings (resource_id, requested_date, requested_time)
  where resource_id is not null
    and status in ('pending', 'accepted', 'scheduled');

-- ------------------------------------------------------------ class capacity --
-- A class holds twelve people because the room holds twelve people. The only
-- thing enforcing that today is a count taken in the browser before a raw insert
-- (classes-booking.tsx) — which is not a check, it is a hope: two people tapping
-- together both read eleven and both insert.
--
-- The lock is the point. `for update` on the class row serialises concurrent
-- bookings for that class, so the count below cannot be read stale. Without it
-- this trigger would have exactly the race it exists to close.
create or replace function public.enforce_class_capacity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cap integer;
  v_taken integer;
begin
  if new.class_id is null then
    return new;
  end if;
  if new.status not in ('pending', 'accepted', 'scheduled') then
    return new;
  end if;

  select capacity into v_cap
  from public.store_classes
  where id = new.class_id
  for update;

  -- No class row, or no stated capacity, means nothing to enforce.
  if v_cap is null or v_cap <= 0 then
    return new;
  end if;

  select count(*) into v_taken
  from public.bookings
  where class_id = new.class_id
    and status in ('pending', 'accepted', 'scheduled')
    and id is distinct from new.id;

  if v_taken >= v_cap then
    raise exception 'class_full';
  end if;

  return new;
end
$function$;

drop trigger if exists bookings_class_capacity on public.bookings;
create trigger bookings_class_capacity
  before insert or update of class_id, status on public.bookings
  for each row execute function public.enforce_class_capacity();
