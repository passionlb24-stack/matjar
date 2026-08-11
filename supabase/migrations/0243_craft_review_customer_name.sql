-- A review signed by nobody is worth less than one signed by a name.
--
-- profiles is private (only you and an admin can read your row), so a public
-- profile page cannot join a name onto a review. The store `reviews` table
-- already solved this by denormalising customer_name; craft_reviews now does
-- the same, except the value is never accepted from the client: it is copied
-- from the request the review is attached to, so a reviewer cannot sign a
-- stranger's name to their opinion.
alter table public.craft_reviews add column if not exists customer_name text;

create or replace function public.fill_craft_review_name()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' then
    -- Editing the comment or the stars must not rewrite the signature.
    new.customer_name := old.customer_name;
    return new;
  end if;

  select coalesce(
           nullif(btrim(r.customer_name), ''),
           nullif(btrim(pr.full_name), '')
         )
    into new.customer_name
  from public.craft_requests r
  left join public.profiles pr on pr.id = new.customer_id
  where r.id = new.request_id;

  return new;
end
$function$;

drop trigger if exists fill_craft_review_name on public.craft_reviews;
create trigger fill_craft_review_name
before insert or update on public.craft_reviews
for each row execute function public.fill_craft_review_name();

-- Anything already written keeps its name too.
update public.craft_reviews cr
set customer_name = coalesce(
      nullif(btrim(r.customer_name), ''),
      nullif(btrim((select pr.full_name from public.profiles pr where pr.id = cr.customer_id)), '')
    )
from public.craft_requests r
where r.id = cr.request_id and cr.customer_name is null;
