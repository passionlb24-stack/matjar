-- 0210: give the merchant a margin, not just a revenue number.
--
-- products carries price, discount_price and flash_price — three selling prices
-- and no cost. store_accounting() and the reports therefore report turnover and
-- call it performance. A merchant cannot tell a good month from a busy one.
--
-- Cost belongs on the product, but margin cannot be computed from it: cost moves
-- (supplier raises a price, the rate moves), and recomputing an old sale against
-- today's cost is the same class of error 0209 just fixed for the exchange rate.
-- So the cost is snapshotted onto the sold line, exactly like fx_rate.
--
-- Where cost is unknown the report says so instead of assuming zero — a NULL cost
-- silently read as 0 would report 100% margin, which is worse than no number.

alter table public.products
  add column if not exists cost numeric(12,2) check (cost is null or cost >= 0);

alter table public.order_items    add column if not exists cost_at_sale numeric(12,2);
alter table public.pos_sale_items add column if not exists cost_at_sale numeric(12,2);

comment on column public.products.cost is
  'Purchase / production cost per unit, merchant-entered. NULL = not entered; such lines are excluded from margin rather than counted as free.';
comment on column public.order_items.cost_at_sale is
  'products.cost as it stood when this line was created. Never recompute from products — cost moves.';

create or replace function public.stamp_cost_at_sale()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.cost_at_sale is null and new.product_id is not null then
    select p.cost into new.cost_at_sale
    from public.products p
    where p.id = new.product_id;
  end if;
  return new;
end $function$;

drop trigger if exists order_items_stamp_cost on public.order_items;
create trigger order_items_stamp_cost before insert on public.order_items
  for each row execute function public.stamp_cost_at_sale();

drop trigger if exists pos_sale_items_stamp_cost on public.pos_sale_items;
create trigger pos_sale_items_stamp_cost before insert on public.pos_sale_items
  for each row execute function public.stamp_cost_at_sale();

-- ── Margin, with its own coverage stated ────────────────────────────────────
-- coverage_pct is part of the answer, not a footnote: at 20% coverage the margin
-- figure is noise, and the merchant should see that before trusting it.
create or replace function public.store_margin_report(p_store_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_result jsonb;
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'not allowed';
  end if;

  with lines as (
    select oi.unit_price * oi.quantity as revenue,
           oi.cost_at_sale * oi.quantity as cogs,
           (oi.cost_at_sale is null) as cost_unknown
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.store_id = p_store_id
      and o.status = 'completed'
      and o.created_at >= now() - make_interval(days => p_days)
    union all
    select psi.price * psi.qty,
           psi.cost_at_sale * psi.qty,
           (psi.cost_at_sale is null)
    from public.pos_sale_items psi
    join public.pos_sales ps on ps.id = psi.sale_id
    where ps.store_id = p_store_id
      and ps.created_at >= now() - make_interval(days => p_days)
  )
  select jsonb_build_object(
    'days',          p_days,
    'revenue',       coalesce(round(sum(revenue), 2), 0),
    'cogs',          coalesce(round(sum(cogs) filter (where not cost_unknown), 2), 0),
    'gross_profit',  coalesce(round(sum(revenue - cogs) filter (where not cost_unknown), 2), 0),
    'lines_total',   count(*),
    'lines_no_cost', count(*) filter (where cost_unknown),
    'coverage_pct',  case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where not cost_unknown) / count(*), 1)
                     end
  ) into v_result
  from lines;

  return v_result;
end $function$;

comment on function public.store_margin_report is
  'Gross margin over completed orders + POS sales. coverage_pct = share of sold lines that had a cost; the margin is only meaningful as it approaches 100.';
