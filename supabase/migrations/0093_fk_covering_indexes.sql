-- Covering indexes for foreign keys flagged by the Supabase performance advisor
-- (unindexed FKs make the referenced-side deletes + join filters do sequential
-- scans as tables grow). All `if not exists` so this is safe/idempotent.
create index if not exists conversations_store_id_idx on public.conversations (store_id);
create index if not exists job_applications_applicant_idx on public.job_applications (applicant_id);
create index if not exists job_postings_store_idx on public.job_postings (store_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id);
create index if not exists order_payments_actor_idx on public.order_payments (actor_id);
create index if not exists pos_sale_items_product_idx on public.pos_sale_items (product_id);
create index if not exists pos_sales_created_by_idx on public.pos_sales (created_by);
create index if not exists pos_sales_customer_idx on public.pos_sales (customer_id);
create index if not exists product_questions_asker_idx on public.product_questions (asker_id);
create index if not exists product_reviews_customer_idx on public.product_reviews (customer_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements (created_by);
create index if not exists store_couriers_company_idx on public.store_couriers (company_id);
create index if not exists store_tasks_created_by_idx on public.store_tasks (created_by);
