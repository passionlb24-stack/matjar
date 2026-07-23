-- Platform visibility (growth) + moderation (messages, product Q&A). These
-- tables are all owner/participant-scoped — the platform is currently blind to
-- them. Additive admin policies via admin_can(section) (0149); super admins pass
-- automatically. 'growth' is read-only; messages/questions add delete for
-- moderation.

-- Growth visibility (read-only aggregates across all stores) ------------
create policy coupons_admin_select on public.coupons
  for select to authenticated using (public.admin_can('growth'));
create policy store_campaigns_admin_select on public.store_campaigns
  for select to authenticated using (public.admin_can('growth'));
create policy automations_admin_select on public.automations
  for select to authenticated using (public.admin_can('growth'));
create policy automation_runs_admin_select on public.automation_runs
  for select to authenticated using (public.admin_can('growth'));
create policy loyalty_ledger_admin_select on public.loyalty_ledger
  for select to authenticated using (public.admin_can('growth'));
create policy referrals_admin_select on public.referrals
  for select to authenticated using (public.admin_can('growth'));

-- Messaging moderation -------------------------------------------------
create policy conversations_admin_select on public.conversations
  for select to authenticated using (public.admin_can('messages'));
create policy participants_admin_select on public.conversation_participants
  for select to authenticated using (public.admin_can('messages'));
create policy messages_admin_select on public.messages
  for select to authenticated using (public.admin_can('messages'));
create policy messages_admin_delete on public.messages
  for delete to authenticated using (public.admin_can('messages'));

-- Product Q&A moderation (select is already public; add delete) ---------
create policy product_questions_admin_delete on public.product_questions
  for delete to authenticated using (public.admin_can('questions'));
