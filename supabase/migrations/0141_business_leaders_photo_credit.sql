-- Business Leaders: photo attribution. Photos are used ONLY when a freely
-- licensed image exists (e.g. Wikimedia Commons); photo_credit carries the
-- required attribution string and photo_source_url the license/file page.
-- (Applied to prod via MCP as migration `business_leaders_photo_credit`.)

alter table public.business_leaders
  add column if not exists photo_credit text,
  add column if not exists photo_source_url text;
