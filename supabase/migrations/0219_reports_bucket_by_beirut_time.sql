-- 0219: bucket the merchant reports by Beirut days, not UTC days.
--
-- store_report and store_audience grouped their per-day series with
-- `(created_at at time zone 'UTC')::date`, while the rest of the platform
-- already thinks in Beirut: the time automations (0118) and the booking engine
-- (0174) both use 'Asia/Beirut'. So the dashboard disagreed with the product
-- around it, and with the merchant's own clock.
--
-- Lebanon is UTC+3 in summer. Every sale between 21:00 and midnight Beirut time
-- was filed under tomorrow — the three hours that matter most to a restaurant
-- or a late-closing shop. A merchant looking at "today" before midnight saw an
-- evening that had not been counted yet, and a "yesterday" holding sales they
-- remember making the night before last.
--
-- Applied as a text substitution over the live function definitions rather than
-- by retyping their bodies. Both are long reporting functions whose logic is
-- not changing at all — only the time zone literal — and re-declaring them by
-- hand would risk silently dropping a clause while pretending to be a one-word
-- fix. This rewrites exactly the literal and nothing else.
--
-- Written as a loop over whatever still matches so it is idempotent and cannot
-- miss a third function that shares the same mistake. Verified after applying:
-- zero functions left using a UTC bucket, and both RPCs still return their full
-- key set when called as a store owner.

do $do$
declare r record;
begin
  for r in
    select oid, pg_get_functiondef(oid) as def
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and prokind = 'f'
      and pg_get_functiondef(oid) like '%time zone ''UTC''%'
  loop
    execute replace(r.def, 'time zone ''UTC''', 'time zone ''Asia/Beirut''');
  end loop;
end
$do$;
