-- Two fields were asking the same question.
--
-- stores.hours is the structured one: a span per weekday. It decides the
-- مفتوح/مسكّر badge and which booking slots exist. stores.opening_hours is a
-- free-text leftover, and eight of the eleven stores that filled it had ALSO
-- filled the grid — three of them with different answers ("9 صباحا الى 4 عصرا"
-- next to a grid saying 09:00–18:00). A field that can contradict the badge
-- beside it is worse than no field, so the input is being removed from the
-- merchant form and the text is folded into the grid here.
--
-- Nothing is deleted. The column and every value in it stay exactly as typed;
-- this only fills the grid for merchants who had never filled it, so that
-- removing the input costs them nothing.

create or replace function pg_temp.h24(h int, marker text) returns text
language sql immutable as $$
  select lpad((case
    when marker like 'صباح%' then (case when h = 12 then 0 else h end)
    when marker like 'ظهر%'  then 12
    else (case when h = 12 then 12 else h + 12 end)
  end)::text, 2, '0') || ':00'
$$;

-- Every day of the week, because that is what the sentence claimed — and it is
-- strictly more honest than today, where unconfigured hours read as "always
-- open" to the badge.
with parsed as (
  select id,
         regexp_match(
           translate(opening_hours, '٠١٢٣٤٥٦٧٨٩', '0123456789'),
           '(\d{1,2})\s*(صباح|مساء|ظهر|عصر|ليل)[^0-9]*(\d{1,2})\s*(صباح|مساء|ظهر|عصر|ليل)'
         ) as m
  from public.stores
  where coalesce(btrim(opening_hours), '') <> ''
    and (hours is null or hours::text = '{}')
)
update public.stores s
set hours = (
      select jsonb_object_agg(
               d::text,
               jsonb_build_object('open',  pg_temp.h24(p.m[1]::int, p.m[2]),
                                  'close', pg_temp.h24(p.m[3]::int, p.m[4]))
             )
      from generate_series(0, 6) as d
    )
from parsed p
where p.id = s.id and p.m is not null;
