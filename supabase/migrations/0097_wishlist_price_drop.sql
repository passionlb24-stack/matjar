-- Retention: when a product a customer saved to their WISHLIST drops in price,
-- that customer gets an in-app + push notification. This is the wishlist analog
-- of 0096 (follow -> new product), and reuses the same plumbing:
--   * one notification per wishlister, fanned out over public.wishlist;
--   * a SECURITY DEFINER trigger with an empty search_path, revoked from the
--     REST surface (trigger-only);
--   * a new notification `type` ('price_drop') wired into push_on_notification
--     and the /notifications UI.
--
-- "Effective price" is the durable price the shopper actually pays outside of a
-- time-boxed flash sale = coalesce(discount_price, price). We deliberately IGNORE
-- flash_price/flash_start/flash_end: a flash sale is transient and would spam the
-- wishlist every time it toggles. The trigger fires only when the effective price
-- strictly DROPS and the product is publicly visible right now (status = 'active'
-- AND is_available AND deleted_at IS NULL — mirrors products_select_public). The
-- store owner is excluded (a merchant re-pricing their own wishlisted product
-- should not ping themselves).

create or replace function public.notify_wishlist_price_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_price numeric(12, 2);
  v_new_price numeric(12, 2);
begin
  v_old_price := coalesce(old.discount_price, old.price);
  v_new_price := coalesce(new.discount_price, new.price);

  -- Fire only on a genuine drop of the durable effective price, and only while
  -- the product is publicly visible. Anything else (price rise, no change, a
  -- flash-only edit, a hidden/unavailable/deleted product) is a no-op.
  if v_new_price < v_old_price
     and new.status = 'active'
     and new.is_available
     and new.deleted_at is null then
    insert into public.notifications (user_id, type, data)
    select w.user_id,
           'price_drop',
           jsonb_build_object(
             'product_id', new.id,
             'store_id', new.store_id,
             'product_name', new.name,
             'old_price', v_old_price,
             'new_price', v_new_price
           )
    from public.wishlist w
    join public.stores s on s.id = new.store_id
    where w.product_id = new.id
      and w.user_id <> s.owner_id;  -- never notify the store owner themselves
  end if;

  return new;
end;
$function$;

drop trigger if exists products_notify_wishlist_price_drop on public.products;
create trigger products_notify_wishlist_price_drop
  after update on public.products
  for each row execute function public.notify_wishlist_price_drop();

-- Trigger-only: keep the function off the public REST surface.
revoke execute on function public.notify_wishlist_price_drop() from public, anon, authenticated;

-- The wishlist(product_id) fan-out lookup index (wishlist_product_id_idx) already
-- exists (0030); no new index required.

-- Wire the new 'price_drop' type into the push bridge. Recreated verbatim from
-- 0078 with the single 'price_drop' case added; every existing case is preserved.
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'store_new' then v_title := 'متجر جديد بانتظار المراجعة 🏪'; v_body := coalesce(new.data->>'store_name','متجر جديد') || ' — راجعه ووافق عليه'; v_url := '/ar/admin/stores';
    when 'price_drop' then v_title := 'انخفض السعر 🔻'; v_body := coalesce(new.data->>'product_name','منتج بقائمة رغباتك') || ' صار بسعر ' || coalesce(new.data->>'new_price','أقل') || ' — نزّل سعره'; v_url := coalesce('/ar/product/'||(new.data->>'product_id'), '/ar/wishlist');
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
