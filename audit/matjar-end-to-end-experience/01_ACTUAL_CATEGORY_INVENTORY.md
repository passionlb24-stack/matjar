# 01 — Actual Category Inventory
_Checkpoint 0 · 2026-07-29 · discovered from live DB (`business_types`, `stores`) + `src/lib/sectors.ts` + `src/lib/store-experience.ts`. Read-only; no code changed._

## How the platform actually decides a category's flow
Not from a hardcoded list. `resolveStoreExperience({category, enabledModules})` (`src/lib/store-experience.ts`) derives the storefront surface from the sector's **enabled feature modules** + an explicit operational status:
- `DIRECTORY_ONLY_SECTORS = {realEstate, automotive}` → browse + contact, no cart/booking.
- `STAY_SECTORS = {hospitality}` → date-range accommodation engine.
- `TICKET_SECTORS = {events}` → ticketing.
- `LEAD_SECTORS = {realEstate, automotive}` → on-platform lead form; `showServiceRequest = hasRequests && !LEAD_SECTORS` (automotive consolidated to Leads on 2026-07-29).
- Else: `itemSurface = appointments? "appointment" : commerce? "order" : "catalog"`.

## The 17 categories (all `is_active = true`)

| # | Slug | Arabic | Primary transaction model (actual) | Primary CTA (expected) | Key merchant route | Live active stores |
|---|---|---|---|---|---|---|
| 1 | retail | تسوّق ومنتجات | Product order (cart, variants color/size, coupons, delivery zones, loyalty) | أضف إلى السلّة / اطلب الآن | /items · /orders | **7** |
| 2 | food | مطاعم ومأكولات | Food order (+ modifier groups, per-item note, scheduling) **+ table reservation** | اطلب الآن / احجز طاولة | /orders · /kitchen · /bookings | **3** |
| 3 | services | خدمات | Service request (+ quotation via quote_amount/note) | اطلب خدمة / اطلب عرض سعر | /requests | 1 |
| 4 | healthcare | صحة وجمال | Appointment booking (doctors/providers, specialty) | احجز موعد | /bookings · /doctors | 2 |
| 5 | beauty | تجميل وعناية | Appointment booking (team/specialist) | احجز موعد | /bookings · /doctors | 2 |
| 6 | realEstate | عقارات | **Directory-only + Lead** (viewing/offer) | اطلب معاينة | /leads | 1 |
| 7 | automotive | سيارات ونقل | **Directory-only + Lead** (consolidated; single Leads inbox) | اطلب معاينة / تجربة قيادة | /leads | 2 |
| 8 | hospitality | فنادق وشاليهات | **Date-range accommodation** (stay engine, GIST overlap) | تحقّق من التوفّر / احجز | /stays · /units | 2 |
| 9 | fitness | لياقة وأندية | Membership subscription + weekly classes (capacity) | اشترك / احجز حصّة | /members · /memberships · /classes | 1 |
| 10 | sportsCourts | ملاعب ورياضة | Timeslot resource booking (hourly courts) | احجز ملعب | /bookings · /resources | 1 |
| 11 | education | تعليم ودورات | Course enrollment | سجّل بالدورة | /members · /courses | 1 |
| 12 | events | مناسبات وقاعات | Event tickets (capacity, attendee capture) | احجز تذكرة | /tickets | **0** |
| 13 | pharmacy | صيدليات ومختبرات | Product order (commerce) — no Rx/lab flow | اطلب الآن | /items · /orders | **0** |
| 14 | petCare | عناية بالحيوانات | Appointment booking | احجز موعد | /bookings | **0** |
| 15 | professional | خدمات مهنية | Appointment + service request/quote | احجز استشارة / عرض سعر | /bookings · /requests | **0** |
| 16 | contractors | مقاولات وحرفيّون | Service request + portfolio | اطلب خدمة / عرض سعر | /requests · /portfolio | **0** |
| 17 | farm | مزارع ومنتجات محلية | Product order (commerce) | اطلب الآن | /items · /orders | **0** |

**Zero live stores (untested by real usage): events, pharmacy, petCare, professional, contractors, farm.**

## Transaction primitives that are IMPLEMENTED (11)
order · food-order(order+modifiers) · appointment(booking engine, allocation modes) · timeslot resource · table reservation(bookings.party_size) · service request(+quote) · lead/inquiry · date-range stay · event tickets · membership subscription · course enrollment.

## NOT implemented as distinct engines (flagged for Checkpoint 3)
- **Vehicle rental** (date-range) — automotive is directory/leads only; no rental engine.
- **Vehicle maintenance appointment** — not a distinct flow (would ride requests/leads).
- **Travel** (destination/dates/pax quote) — no such category.
- **Lab test / result-ready** — pharmacy slug bundles "labs" but no lab engine.
- **Venue/event date-hire quote** — events uses ticketing only; no venue-hire quote flow.
- **Pharmacy prescription upload / pharmacist review** — no Rx flow (plain commerce).

## DB entities per flow
orders+order_items(+product_modifier_groups/options, order_events, order_payments) · bookings(+doctors, service_providers, store_resources, store_classes, provider_availability_*) · service_requests · leads(+lead_activities) · stay_bookings(+accommodation_units) · event_tickets(+event_ticket_types) · store_memberships(+store_membership_plans) · course_enrollments(+store_courses) · coupons · loyalty_ledger · reviews · notifications · audit_logs.

## Notification types that exist (from `notifications.type`)
order_new · order_status_merchant · booking_new · booking_status(_merchant) · booking_rescheduled(_merchant) · booking_reminder · booking_attendance_confirmed · booking_slot_freed · lead_new · service_request_new (added 2026-07-29) · stay_new · ticket_new · membership_new · enroll_new · price_drop · restock · store_new · pro_request · leader_submission · message · admin_broadcast · store_campaign.

## Test-data status (live)
14 merchants · 7 customers · 1 super_admin (msharafeddine8@gmail.com) · **only 1 store_staff row** (thin staff-permission coverage) · 4 customers have a transaction · **0 guest orders ever** · **0 push subscriptions** (web-push never delivers live).
