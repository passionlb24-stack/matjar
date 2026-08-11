-- 0242: browse_crafts returned nothing whenever there was no search term.
--
-- normalize_search('') returns NULL, not ''. So the "no query" guard
--
--   length(public.normalize_search(coalesce(p_q, ''))) = 0
--
-- evaluated to NULL rather than true, the surrounding AND collapsed to NULL,
-- and every row was filtered out.
--
-- Which means the directory landing page and every unfiltered trade page were
-- empty — and empty is exactly what a new section is supposed to look like, so
-- this would have sat there reading as "no tradesmen have signed up yet" for as
-- long as it took someone to notice. It was caught only because a seeded
-- provider that definitely existed did not appear.
--
-- The coalesce goes around length(), not inside it: the inner one only guards a
-- NULL argument, and the NULL was coming back out of the function.
--
-- Verified as an anonymous visitor against one live provider: no query → 1,
-- by trade → 1, by a covered area → 1, by an uncovered area → 0, "كهربجي" → 1,
-- "نجار" → 0.
do $do$
declare d text; d2 text;
begin
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace='public'::regnamespace and proname='browse_crafts';

  d2 := replace(d,
    'length(public.normalize_search(coalesce(p_q, ''''))) = 0',
    'coalesce(length(public.normalize_search(coalesce(p_q, ''''))), 0) = 0');
  if d2 = d then raise exception 'empty-query guard not found'; end if;

  execute d2;
end
$do$;
