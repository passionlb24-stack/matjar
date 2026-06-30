-- Performance: wrap bare auth.uid() in (select auth.uid()) so Postgres evaluates
-- it once per query (initplan) instead of once per row. Semantically identical.
-- Applied across every public-schema policy that used a bare auth.uid().
do $$
declare
  r record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual is not null and qual like '%auth.uid()%' and qual not like '%( SELECT auth.uid()%')
        or (with_check is not null and with_check like '%auth.uid()%' and with_check not like '%( SELECT auth.uid()%')
      )
  loop
    v_qual := replace(r.qual, 'auth.uid()', '(select auth.uid())');
    v_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
    if r.qual is not null and r.with_check is not null then
      v_sql := format('alter policy %I on %I.%I using (%s) with check (%s)',
                      r.policyname, r.schemaname, r.tablename, v_qual, v_check);
    elsif r.qual is not null then
      v_sql := format('alter policy %I on %I.%I using (%s)',
                      r.policyname, r.schemaname, r.tablename, v_qual);
    else
      v_sql := format('alter policy %I on %I.%I with check (%s)',
                      r.policyname, r.schemaname, r.tablename, v_check);
    end if;
    execute v_sql;
  end loop;
end $$;
