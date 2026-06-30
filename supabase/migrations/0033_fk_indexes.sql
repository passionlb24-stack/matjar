-- Cover foreign keys that lacked an index (flagged by the performance advisor).
-- Pure additions — they speed up joins/filters as data grows, zero behaviour change.
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists bookings_product_id_idx on public.bookings(product_id);
create index if not exists favorites_store_id_idx on public.favorites(store_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists payments_recorded_by_idx on public.payments(recorded_by);
create index if not exists payments_subscription_id_idx on public.payments(subscription_id);
create index if not exists reviews_customer_id_idx on public.reviews(customer_id);
create index if not exists stores_business_type_id_idx on public.stores(business_type_id);
