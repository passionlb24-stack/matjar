-- 0205: Public freelancer profile. In a services marketplace the buyer picks a
-- PERSON, not a single gig — but a personal account had only a name + avatar and
-- no way to see who someone is or everything they offer. Adds an optional bio +
-- skills to profiles, and a participant-safe way to read another lister's public
-- profile (profiles_select RLS is is_super_admin() OR auth.uid()=id, so a visitor
-- cannot read a freelancer's row directly).

alter table public.profiles
  add column if not exists bio text,
  add column if not exists skills jsonb;   -- string[] of short skill tags

-- Public profile for anyone who is a PUBLIC LISTER (has at least one active gig).
-- Scoped that way so this isn't a general profile-dump for arbitrary user ids;
-- it only exposes the handful of fields a listing already shows publicly.
create or replace function public.public_lister_profile(p_user uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  skills jsonb,
  gig_count int
)
language sql stable security definer set search_path to '' as $function$
  select p.id, p.full_name, p.avatar_url, p.bio, p.skills,
         (select count(*)::int from public.gigs g
          where g.freelancer_id = p.id and g.status = 'active')
  from public.profiles p
  where p.id = p_user
    and exists (
      select 1 from public.gigs g
      where g.freelancer_id = p.id and g.status = 'active'
    );
$function$;

-- Public listing pages are guest-visible, so the profile behind them must be too.
grant execute on function public.public_lister_profile(uuid) to anon, authenticated;
