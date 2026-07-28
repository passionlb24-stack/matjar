# 05 — Backlog التنفيذ (trigger-gated)

> **قاعدة القيادة:** لا نبني محرّك قطاع **مضاربةً**. كل موجة تُبنى عند **مُحفِّز حقيقي** (تاجر فعلي بذاك القطاع، أو حاجة عمل مؤكَّدة). الحالة الحيّة الكاملة لكل قطاع في `04_VERTICAL_CAPABILITY_MATRIX.csv`.

## ✅ منجَز — CP1 (حيّ على origin/main، commit 110d48e)
Store Experience Resolver + directory-only + إصلاح الـdrift. 9 قطاعات صارت صحيحة، 4 صارت directory-only (وقف الضرر). لا هجرات، لا بيانات ملفّقة.

## الموجات القادمة — مرتّبة بالأولويّة، مشروطة بالمحفِّز

### CP3 — محرّك القوائد (Leads) · المحفِّز: أوّل تاجر عقارات أو سيّارات
الأعلى أولويّة القادمة، لأنّ realEstate/automotive **الآن directory-only وينتظران التقاط lead منظّم** بدل الضياع على واتساب.
- **DB (إضافي):** `leads` (store_id, listing/product_id, kind: viewing/contact/offer/test_drive, name, phone, message, status, assigned_to) + `lead_activities`.
- **RPC:** `create_lead` (عام، مع rate-limit)، `update_lead_status` (تاجر/موظّف).
- **واجهة:** نموذج «اطلب معاينة/تواصل/عرض» على الكتالوج directory-only + صندوق leads بلوحة التاجر.
- **الأثر:** يفكّ realEstate + automotive(بيع) + professional(مشاريع كبيرة) من الوضع المؤقّت.

### CP4 — إتمام الطعام · المحفِّز: أوّل مطعم يحتاج modifiers
- **DB:** `product_modifier_groups` (required/min/max) + `product_modifier_options` (price_delta) + `order_items.note` + `orders.scheduled_for`.
- **RPC:** توسيع `place_customer_order`/`place_guest_order` للتحقّق من المجموعات الإلزاميّة + فرض `min_order` على مستوى المتجر داخل الـRPC.
- **الأثر:** الطعام يصير Model B حقيقي (اختر الحجم إلزاميًّا، إضافات مجموعات، طلب مجدوَل).

### CP5 — محرّك الإقامة (Stay, date-range) · المحفِّز: أوّل فندق/شاليه
الأكبر تقنيًّا (XL). الأساس يُعاد استخدامه لتأجير السيّارات (CP-rental) وحجز القاعات.
- **DB:** `accommodation_units` (occupancy/beds/base_nightly_price/min_nights/cleaning_fee/deposit/policies) + `unit_availability` (**unique(unit_id,date)** = حارس التعارض؛ الليلة = وحدة المخزون، **لا** يُعاد استخدام قيد الوقت في 0174) + `rate_plans` (موسمي/عطلة) + `stay_bookings` (check_in/check_out/nights/adults/children/infants/breakdown).
- **RPC:** `search_stay_availability`, `quote_stay`, `place_stay_booking` (ذرّي على daterange)، `block_unit_dates`, `set_rate_plan`.
- **إطلاق:** hospitality يبقى directory-only خلف feature-flag حتى تنجح اختبارات التعارض + التسعير + الموبايل.

### CP6 — العضويّات + التسجيل + التذاكر · المحفِّز: أوّل نادي/مدرسة/منظّم فعاليّات
- **العضويّات (fitness):** `memberships` (starts_on/ends_on/status/sessions_left) + `subscribe_membership` + cron انتهاء.
- **التسجيل (education):** `course_enrollments` (seats/status/dates) + `enroll_course`.
- **التذاكر (events):** `event_ticket_types` (capacity/sold) + `event_tickets` (attendee) + `buy_tickets` (ذرّي على capacity).
- **الأثر:** يوقف اعتماد fitness/education/events على بطاقات واتساب بلا سجلّ.

### CP2 — المحرّك الهجين + onboarding + اكتمال الملف · يُنسَج بالتوازي عند أوّل توسّع
- **`sector_definitions`** (config table) يستبدل الثوابت المبعثرة؛ الصفحة تُشتَقّ منه بالكامل (يمنع عودة الـdrift نهائيًّا) + ربط لوحة الأدمن ضمن enums.
- **`sector_field_defs`** (حقول مكتوبة typed) + فلاتر بمدى (سعر/مساحة/سنة/كم).
- **onboarding واعٍ بالقطاع** + **مؤشّر اكتمال الملف** (بيانات حقيقيّة فقط) + شروط نشر لكل قطاع.
- حقول retail (إلكترونيات/أثاث) + حقول الموعد (healthcare/beauty/petCare/professional).

## Polish جاهز أي وقت (بلا محفِّز، منخفض المخاطر)
- CTA تواصل صريح داخل كتالوج الـdirectory-only (اليوم التواصل عبر ترويسة المتجر فقط).
- حالات فارغة موجّهة للتاجر: «أضف أوّل خدمة/طبيب لتفعيل الحجز» (beauty/vet/pro).
- تعميم زرّ الإبلاغ على المتاجر/الإعلانات (ثقة).

## لا يُبنى أبدًا كتدفّق عامّ واحد
الإقامة · القوائد · التأجير · التذاكر · العضويّات · عرض السعر — كلٌّ محرّك خاصّ (مع إعادة استخدام أساس date-range بين الإقامة/التأجير/القاعات).
