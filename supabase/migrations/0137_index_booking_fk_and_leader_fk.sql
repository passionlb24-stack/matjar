-- Cover the FKs the availability RPCs and admin queue filter on. class_spots_taken
-- and resource_booked_times scan bookings by (class_id/resource_id + date); index
-- them composite. Also index the two new submitter FKs.
-- Applied to production via Supabase migration `index_booking_fk_and_leader_fk`.

create index if not exists bookings_class_date_idx on public.bookings (class_id, requested_date) where class_id is not null;
create index if not exists bookings_resource_date_idx on public.bookings (resource_id, requested_date) where resource_id is not null;
create index if not exists business_leaders_submitter_idx on public.business_leaders (submitted_by);
create index if not exists hub_tool_events_user_idx on public.hub_tool_events (user_id);
