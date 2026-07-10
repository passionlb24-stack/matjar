-- Fix: guest orders (customer_id IS NULL, added in 0053) broke order-status
-- updates. notify_order_status inserts a notification for new.customer_id, but
-- notifications.user_id is NOT NULL — so a merchant changing a guest order's
-- status hit a not-null violation and the whole UPDATE rolled back, making
-- guest orders un-processable. Skip the customer notification when there's no
-- account to notify (guests track their order over WhatsApp/phone).

create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status and new.customer_id is not null then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'order_status',
            jsonb_build_object('order_id', new.id, 'status', new.status));
  end if;
  return new;
end; $function$;
