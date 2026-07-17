-- Retention: when a store you FOLLOW publishes a new product, its followers get
-- a notification. This replaces the original 0029 trigger, which had gaps:
--   * it fired only on INSERT, so a product created as a draft and later flipped
--     to active never notified anyone;
--   * it checked only status = 'active', ignoring is_available / deleted_at, so a
--     hidden-but-active row would notify;
--   * it notified the store owner too (if the owner followed their own store).
--
-- "Publicly visible" for a product = status = 'active' AND is_available AND
-- deleted_at IS NULL (mirrors the products_select_public RLS policy at the row
-- level). We fan out one notification per follower — reusing the existing
-- `store_product` notification type, which is already wired into the push bridge
-- (push_on_notification) and the /notifications UI. The owner is excluded and the
-- fan-out naturally no-ops when the store has zero followers.

create or replace function public.notify_followers_new_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now_visible boolean;
  v_was_visible boolean;
begin
  v_now_visible := (new.status = 'active'
                    and new.is_available
                    and new.deleted_at is null);

  -- On INSERT there is no OLD row, so treat it as "was not visible".
  v_was_visible := (tg_op = 'UPDATE'
                    and old.status = 'active'
                    and old.is_available
                    and old.deleted_at is null);

  -- Only notify on the transition INTO visibility. Re-saving an already-visible
  -- product (v_was_visible = true) is a no-op, preventing duplicate notifications.
  if v_now_visible and not v_was_visible then
    insert into public.notifications (user_id, type, data)
    select f.user_id,
           'store_product',
           jsonb_build_object(
             'store_id', new.store_id,
             'product_id', new.id,
             'store_name', s.name
           )
    from public.follows f
    join public.stores s on s.id = new.store_id
    where f.store_id = new.store_id
      and f.user_id <> s.owner_id;  -- never notify the store owner themselves
  end if;

  return new;
end;
$function$;

-- Trigger now covers INSERT (product created already-visible) and UPDATE
-- (product transitioning into visibility, e.g. draft -> active).
drop trigger if exists products_notify_followers on public.products;
create trigger products_notify_followers
  after insert or update on public.products
  for each row execute function public.notify_followers_new_product();

-- Keep the function off the public REST surface; it only runs from the trigger.
revoke execute on function public.notify_followers_new_product() from public, anon, authenticated;

-- The follows-by-store lookup index (follows_store_id_idx) already exists (0029);
-- no new index required.
