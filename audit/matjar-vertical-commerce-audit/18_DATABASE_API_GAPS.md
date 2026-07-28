# 18 — فجوات قاعدة البيانات و الـAPI

> تحليل، لا هجرات. الأعمدة الفعليّة مستخرَجة من قاعدة الإنتاج (`wesihatopiznatsyfxer`). لا تُكتَب migrations الآن.

## أ. ما تدعمه القاعدة اليوم (نقاط القوّة)
- **الحجز بموعد (Model C) ناضج:** `bookings` + allocation modes على `products` + `provider_availability_rules/exceptions` + قيود GiST للتعارض + `booking_waitlist`. من أقوى ما بُني.
- **الطلب التجاري (Model A) ناضج:** `orders`/`order_items` + `product_variants` (لون/مقاس) + `product_options` (إضافات) + `store_delivery_zones` + idempotency + `custom_fields`.
- **عرض السعر (شبه G):** `service_requests` بـ`quote_amount`/`quote_note` + دورة حياة.
- **بنية تحتيّة مشتركة جيّدة:** فروع (`store_locations`)، شهادات (`store_verifications`)، مراجعات (`reviews`)، كوبونات، وحدات لكل متجر (`store_modules`).

## ب. الفجوات البنيويّة (جدول القرار)

| # | القيود الحاليّة | القطاعات المتأثّرة | الكيان/النموذج الموصى | العلاقة | أثر الـAPI | خطورة الهجرة | الأولويّة |
|---|---|---|---|---|---|---|---|
| 1 | **لا مدى تواريخ**: `bookings` بـ`starts_at/ends_at` مفرد (≤8س) | hospitality، automotive(rental)، events(venue) | `stay_bookings` (check_in date, check_out date, nights, unit_id, guests jsonb) + `units`/`room_types` + `unit_availability` (calendar) + `rate_plans` (per-night/seasonal/weekend) | unit ← store؛ availability ← unit؛ booking ← unit | محرّك جديد `search_availability`/`quote_stay`/`place_stay_booking` | **عالية** (جدول+قيود جديدة، لا تلمس bookings) | **MVP** |
| 2 | **لا leads**: لا جدول استفسار/معاينة | realEstate، automotive(sale)، professional، high-value retail | `leads` (store_id, listing_id, kind: viewing/contact/offer/test_drive, name, phone, message, status, assigned_to) | lead ← store/product | `create_lead`، `update_lead_status` | منخفضة (جدول جديد مستقلّ) | **MVP** |
| 3 | **لا تسعير متغيّر**: `products.price` مفرد | hospitality، automotive(rental)، sportsCourts، events | `rate_plans`/`price_rules` (unit/product, day_of_week, date_range, price) | rule ← unit/product | يُقرأ في محرّك التسعير | متوسطة | Phase 2 |
| 4 | **لا سجلّ عضويّة/تسجيل**: `store_membership_plans`/`store_courses` بطاقات + WhatsApp، بلا صفّ | fitness، education | `memberships` (customer_id, plan_id, starts_on, ends_on, status, sessions_left) + `enrollments` (course/class, customer, seats) | membership ← plan+customer | `subscribe_membership`، `enroll_course` | منخفضة | Phase 2 |
| 5 | **لا تذاكر**: لا نوع/كميّة/حاضر | events | `ticket_types` (event_id, name, price, capacity, sold) + `ticket_orders` (attendee jsonb) | ticket ← event | `buy_tickets` | متوسطة | Phase 2 |
| 6 | **modifiers الطعام مسطّحة**: `product_options` بلا group/required/min/max | food | `modifier_groups` (product_id, name, required bool, min_select, max_select) + `modifier_options` (group_id, name, price) | group ← product؛ option ← group | تُقرأ في السلّة/الطلب؛ توسيع `place_*_order` للتحقّق | متوسطة | **MVP** (لأنه جوهر B) |
| 7 | **لا طلب مجدوَل**: لا `scheduled_for` على orders | food، farm/grocery | عمود `orders.scheduled_for timestamptz` + `store_delivery_windows` | window ← store | معامل في `place_*_order` | منخفضة | Phase 2 |
| 8 | **لا بيع بالوزن**: لا وحدة قياس | farm/grocery | `products.sold_by` (unit/kg/g/l) + `unit_price_per` | — | عرض/حساب السلّة | منخفضة | Phase 2 |
| 9 | **لا رفع وصفة / منتج مقيّد** | pharmacy | `orders.prescription_url` + `products.rx_required bool` + قيود قانونيّة | — | تحقّق في الطلب | متوسطة | Phase 2 |
| 10 | **الحقول الخاصّة jsonb مفتوح بلا تحقّق**: `products.attributes` نصّ↔مفتاح، فلاتر exact فقط | realEstate، automotive، electronics، furniture | `sector_field_defs` (typed: text/number/select/date/bool, options, required, filter, range) — القيم تبقى في attributes jsonb مع تحقّق من التعريف | def ← sector | فلترة بمدى (price/area/year/mileage) | متوسطة (تحقّق تطبيقي) | Phase 2 |
| 11 | **قطاعات appointment لا محرّك لها علنًا** (drift) | beauty، petCare، professional، education | لا تغيير قاعدة — إصلاح الربط (توسيع `bookingCategories` أو الاشتقاق من الوحدات) | — | لا | **صفر (كود واجهة فقط)** | **MVP** |
| 12 | **معلومات القطاع مبرمَجة على slug** | كلّها | `sector_definitions` (transaction_primitive, cta, pricing_model, enabled_modules, status_workflow, publish_reqs) | def ← business_type | يقود العرض | متوسطة | Phase 2 |
| 13 | **حجز الموارد/الحصص بلا لائحة انتظار/تأكيد حضور/قيد مدى** | sportsCourts، events، fitness | مواءمة مسار الموارد/الحصص مع محرّك الحجز الرئيسي (نفس القيود) | — | توحيد | متوسطة | Phase 3 |
| 14 | **لا عربون/إيداع (deposit)** | hospitality، events، beauty، professional | `deposit_amount`/`deposit_status` على الحجز + تعليمات دفع يدويّة (OMT/Whish) — لا بوّابة دفع | — | يُعرَض | منخفضة | Phase 3 |
| 15 | **لا اكتمال ملف لكل قطاع** | كلّها | `store_profile_completeness` (محسوب من publish_reqs) | — | مؤشّر للتاجر/النشر | منخفضة | Phase 2 |
| 16 | **نظاما «listing» غير مرتبطين** (`products+attributes` مقابل `listings` سوق الأحد) | realEstate، automotive | قرار: توحيد أو ربط بحث موحّد | — | فهرسة/بحث | متوسطة | Phase 3 |

## ج. مبدأ التصميم — تجنّب EAV غير المنضبط
- **لا** تُبنى جداول EAV مفتوحة. القيم الخاصّة تبقى في `products.attributes` jsonb الموجود، لكن **يُضبَط شكلها من `sector_field_defs`** (أنواع محدودة + خيارات + required + range) فيصبح التحقّق والفلترة موثوقين.
- **الكيانات الأساسيّة المشتركة تُنمذَج بجداول عاديّة** (units, availability, rate_plans, leads, memberships, tickets) — لأنها تحتاج قيودًا وفهارس واستعلامات مدى.
- **التوازن:** جداول عاديّة للبدائيّات عالية القيمة (الإقامة/leads/التذاكر/العضويّات)؛ jsonb محكوم للحقول الوصفيّة؛ config table للسلوك.

## د. فجوات الـAPI (Endpoints/RPCs المطلوبة — توثيق فقط)

### الإقامة (Model D) — hospitality/rental/venue
| RPC | الغرض | مدخلات | مخرجات | صلاحيّات | تحقّق | أخطاء |
|---|---|---|---|---|---|---|
| `search_stay_availability` | وحدات متاحة لمدى | store, check_in, check_out, guests | units[+total price] | عام | check_out>check_in، ماضٍ | `invalid_range`، `no_units` |
| `quote_stay` | تفصيل السعر | unit, check_in, check_out, guests | breakdown(nights, per-night, cleaning, extra-guest, total) | عام | سعة، حدّ أدنى ليالٍ | `over_capacity`، `min_stay` |
| `place_stay_booking` | طلب/تثبيت حجز | unit, range, guests, name, phone | booking id + code | عام (COD) | إتاحة ذرّيّة (exclusion على daterange) | `dates_taken` |
| `block_unit_dates` | حجب تواريخ (تاجر) | unit, range | ok | تاجر | can_manage | — |
| `set_rate_plan` | تسعير موسمي | unit, range/dow, price | ok | تاجر | — | — |

### القوائد (Model H) — realEstate/automotive/professional
| RPC | الغرض | مدخلات | مخرجات | صلاحيّات |
|---|---|---|---|---|
| `create_lead` | استفسار/معاينة/عرض | store, listing, kind, name, phone, message | lead id | عام |
| `update_lead_status` | متابعة | lead, status, assigned_to | ok | تاجر/موظّف |

### العضويّات/التسجيل (Model L) — fitness/education
`subscribe_membership(plan, customer)` → membership id؛ `enroll_course(course, customer, seats)` → enrollment id؛ `expire_memberships()` cron.

### التذاكر (Model K) — events
`buy_tickets(event, type, qty, attendee)` → order id (ذرّي مقابل capacity).

### إتمام الموجودة
- **توسيع `place_customer_order`/`place_guest_order`** للتحقّق من modifier_groups (required/min/max) و`scheduled_for`.
- **تحقّق `min_order` على مستوى المتجر داخل الـRPC** (اليوم client-side فقط).
- **توحيد checkout المنتج المفرد** (`product-order.tsx`) مع سلّة المتجر (اليوم ينقصه zone/coupon/loyalty/custom_fields/guest).

## هـ. ترتيب الأثر
1. **إصلاح drift الربط (#11)** — صفر قاعدة بيانات، يُصلح 4 قطاعات فورًا. **افعله أولًا.**
2. **محرّك الإقامة (#1,#3)** — يفتح hospitality + car-rental + venues.
3. **leads (#2)** — يُصلح realEstate + automotive(sale) + professional.
4. **modifiers الطعام (#6)** + توحيد checkout.
5. **العضويّات/التسجيل/التذاكر (#4,#5)** — fitness/education/events.
6. **`sector_definitions` (#12)** — الأساس الذي يمنع عودة drift.
