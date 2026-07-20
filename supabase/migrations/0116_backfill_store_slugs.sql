-- Backfill a default vanity slug for every existing store that doesn't have one,
-- derived from its name (latin letters/digits). Arabic-only names slugify to empty
-- and are left null (the merchant sets their own handle in the edit page). Format,
-- reserved words, and uniqueness are enforced by 0115's trigger + unique index; we
-- generate a candidate, append -2/-3… on collision, and skip any store whose
-- candidate can't be made valid — each row runs in its own sub-block so one bad
-- name never blocks the rest. One-time, idempotent (only touches null-slug stores).
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in
    select id, name from public.stores
    where slug is null and deleted_at is null
  loop
    base := left(
      trim(both '-' from regexp_replace(lower(coalesce(r.name, '')), '[^a-z0-9]+', '-', 'g')),
      26
    );
    if length(base) < 3 then
      continue;
    end if;

    cand := base;
    n := 1;
    while exists (select 1 from public.stores where lower(slug) = cand) loop
      n := n + 1;
      cand := base || '-' || n;
      if n > 20 then
        cand := null;
        exit;
      end if;
    end loop;
    if cand is null then
      continue;
    end if;

    begin
      update public.stores set slug = cand where id = r.id;
    exception when others then
      -- reserved word / validation / race: leave this store without a slug.
      null;
    end;
  end loop;
end $$;
