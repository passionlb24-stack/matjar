-- 0297: the questions that stop the callback.
--
-- MJ-016 / MJ-017 / MJ-020 (audit/matjar-vertical-commerce-audit/23_CATEGORY_ISSUES.csv).
-- The complaint behind all three is the same: the customer sends "my sink is
-- broken" and the provider has to phone back to learn everything that decides
-- whether the job is worth taking. This adds the two or three answers per
-- sector that remove that call — and nothing else. A form with fifteen fields
-- is abandoned, so every column here had to earn its place against "the
-- provider can just ask".
--
-- WHAT THE AUDIT ROWS GOT WRONG (measured against production today, not read
-- off the CSV):
--   * MJ-016 lists service_area and preferred_at as missing. On craft_requests
--     they have existed since 0239 (`area_id`, `when_pref`) and the form asks
--     both. `photos` has existed since 0239 too — as a column nothing writes.
--     So for the crafts side MJ-016 is one missing UI, not four columns.
--   * MJ-020 lists structured insurance as missing. `stores.insurance` exists
--     and StoreHealthcareInfo already shows it to the patient before the
--     calendar. Nothing is added for it here (see REJECTED below).
--
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY
-- ---------------------------------------------------------------------------
-- New nullable columns and one new function. No deployed function changes
-- signature, no policy is narrowed, no grant is revoked. Deployed code that
-- knows none of these columns keeps inserting exactly as it does today:
-- `photos` carries a default and everything else is nullable. The grants on
-- all three tables are table-level (checked: 14/14, 14/14 and 24/24 columns
-- for authenticated), so new columns inherit them and no grant is needed.

-- ---------------------------------------------------------------------------
-- service_requests — the generic desc+address+phone form (MJ-016, MJ-017)
-- ---------------------------------------------------------------------------
alter table public.service_requests
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- Severity, not timing. A field-service provider triages by this before
-- anything else, and "today vs whenever" is the single answer that decides
-- whether they drop what they are doing.
alter table public.service_requests
  add column if not exists urgency text
    check (urgency in ('emergency', 'soon', 'flexible'));

-- Professional services only. A consultancy that cannot see a number spends
-- the first call establishing one. Four buckets and no "not sure" option:
-- leaving it blank already says that, and two ways to say nothing is how a
-- select turns into a guess.
alter table public.service_requests
  add column if not exists budget_range text
    check (budget_range in
      ('under_500', '500_2000', '2000_10000', 'over_10000'));

alter table public.service_requests
  add column if not exists timeline text
    check (timeline in ('asap', 'weeks', 'months', 'exploring'));

comment on column public.service_requests.photos is
  'Public store-assets URLs the customer attached. Written under '
  'crafts/<customer uid>/requests/ — the only identity-scoped prefix '
  'can_write_store_asset (0283) grants a plain customer.';
comment on column public.service_requests.urgency is
  'emergency | soon | flexible. Customer-stated severity, never a promise.';
comment on column public.service_requests.budget_range is
  'Professional-services brief. A range, not a number — a number reads as a '
  'commitment and gets skipped.';

-- ---------------------------------------------------------------------------
-- stores.request_intake — the merchant's off-switch
-- ---------------------------------------------------------------------------
-- A shop that does not want to ask for a budget should not have to. Keys are
-- 'photos' | 'urgency' | 'budget' | 'timeline', values boolean. NULL, or an
-- absent key, means "use the default for this sector" — so nothing has to be
-- backfilled and a merchant who never opens the setting gets the sensible
-- shape. Deliberately one jsonb rather than four boolean columns: these are
-- presentation preferences, not facts anything queries or indexes.
alter table public.stores
  add column if not exists request_intake jsonb
    check (request_intake is null or jsonb_typeof(request_intake) = 'object');

comment on column public.stores.request_intake is
  'Per-store overrides for which optional questions the service-request form '
  'asks. {"photos":bool,"urgency":bool,"budget":bool,"timeline":bool}; an '
  'absent key falls back to the sector default resolved in the client.';

-- ---------------------------------------------------------------------------
-- bookings.patient_status — MJ-020
-- ---------------------------------------------------------------------------
-- The one clinic answer that is genuinely unknowable from the booking and
-- changes what the practice does with it: a first visit needs a longer slot
-- and a file that does not exist yet. See REJECTED below for the rest of the
-- MJ-020 list.
alter table public.bookings
  add column if not exists patient_status text
    check (patient_status in ('new', 'returning'));

comment on column public.bookings.patient_status is
  'new | returning, stated by the customer. Not a medical record and never '
  'to become one — 0105 and the MJ-020 audit row both say this platform '
  'holds no patient data.';

-- The customer cannot write it directly: bookings_update is store-side only
-- (`staff_can(store_id,''bookings'') or owner`), by design — a customer must
-- not be able to edit a booking row. And place_booking's signature is a
-- contract with deployed code, so it cannot grow a parameter: adding one with
-- a default would create an 11-argument sibling and make every deployed
-- 10-argument call ambiguous ("function is not unique"), which would break
-- booking outright. Hence a separate, narrow definer that writes this one
-- column and nothing else, called with the id place_booking already returns.
create or replace function public.set_booking_intake(
  p_booking_id uuid,
  p_patient_status text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_customer uuid;
  v_status public.booking_status;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return false; end if;
  if p_patient_status is not null
     and p_patient_status not in ('new', 'returning') then
    return false;
  end if;

  select customer_id, status into v_customer, v_status
  from public.bookings where id = p_booking_id;
  -- Own booking only, and only while it is still live. Returns false rather
  -- than raising: this is an optional answer attached after the booking
  -- already succeeded, and a raise here would surface as "booking failed"
  -- for a booking that did not fail.
  if v_customer is null or v_customer <> v_uid then return false; end if;
  if v_status not in ('pending', 'accepted', 'scheduled') then return false; end if;

  update public.bookings
    set patient_status = p_patient_status
  where id = p_booking_id;
  return true;
end;
$fn$;

-- Audience stated, per 0281/0284. Customers only — a merchant has the normal
-- bookings_update policy and does not need this.
revoke all on function public.set_booking_intake(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_booking_intake(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- REJECTED — written down so the next person does not re-litigate it
-- ---------------------------------------------------------------------------
-- MJ-016 urgency on craft_requests: craft_requests already asks when_pref
--   (today / tomorrow / this week / flexible) and the form defaults it. A
--   second severity chip beside it is the same question twice; "today" IS the
--   urgent answer in this market. service_requests gets urgency because it
--   asks nothing about timing at all.
-- MJ-017 file_upload beyond images: photos covers the site photo, the sketch
--   and the screenshot. Arbitrary files (pdf/dwg/zip) mean a new MIME
--   allowance on a public bucket, which is a security change dressed up as a
--   form field.
-- MJ-017 project_scope: that is the description. Splitting one textarea into
--   two labelled textareas does not produce a better brief.
-- MJ-020 appointment type (in-person/online): rejected. The clinic never told
--   us it does teleconsultation, so asking the patient manufactures an option
--   the practice may not offer — and where it does offer both, it lists them
--   as two services and the patient has already chosen. Building it honestly
--   needs a merchant-side "we do online consultations" switch first.
-- MJ-020 prep_instructions: real value (fasting, bring your films), but it is
--   merchant-authored copy per service, so it needs a field on the service
--   editor. Adding the column without the editor produces a column nothing
--   ever writes — which is exactly the state `craft_requests.photos` has been
--   in since 0239.
-- MJ-020 structured insurance: stores.insurance already reaches the patient.
--   Collecting a policy number on a platform with no claims path is a data
--   liability with no payoff.
-- MJ-027 deposits: not built. Matjar takes no card and holds no money, so a
--   deposit here can only be a row asserting that cash changed hands
--   somewhere we cannot see. That row would read as a guarantee on both
--   sides and be enforceable by neither. See the report.

-- ============================================================================
-- ROLLED-BACK TEST (run against production inside begin;…rollback; — PASSED)
-- ============================================================================
-- 16 assertions, 16 PASS. Every statement of this migration was applied inside
-- the transaction first, then exercised through the roles the deployed app
-- actually uses (`set local role anon` / `authenticated` with real jwt claims
-- for two different live customers), then rolled back by raising at the end.
-- craft_providers is empty in production, so the harness seeded one row.
--
--   deployed craft_requests insert (guest, 8 cols)        PASS
--   deployed service_requests insert (6 cols)             PASS
--   deployed bookings insert (no new col)                 PASS
--   new service_requests insert (photos/urgency/budget)   PASS
--   urgency='whenever'                                    PASS refused 23514
--   budget_range='cheap'                                  PASS refused 23514
--   timeline='someday'                                    PASS refused 23514
--   customer insert patient_status='maybe'                PASS refused 23514
--   customer insert patient_status='new'                  PASS
--   request_intake = '[]' (array, not object)             PASS refused 23514
--   request_intake = valid object                         PASS
--   manage_service_request(cancel) on new-shape row       PASS
--   place_booking(10 args) resolves + books               PASS
--   set_booking_intake owner                              PASS true
--   set_booking_intake bad value                          PASS false
--   set_booking_intake other customer                     PASS false
--
-- The last three are the ones that matter for "a migration is a contract with
-- the DEPLOYED code": place_booking is still the same 10-argument function the
-- shipped booking panel calls, manage_service_request still drives a row that
-- now has four more columns, and the two deployed insert shapes are untouched.
