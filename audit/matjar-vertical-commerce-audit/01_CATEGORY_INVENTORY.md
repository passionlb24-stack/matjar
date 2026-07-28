# 01 — جرد القطاعات (Category Inventory)

> مستخرَج من الكود الفعلي (`src/lib/catalog.ts`, `src/lib/modules.ts`, `src/lib/sectors.ts`, `src/lib/modules-catalog.ts`) ومن قاعدة البيانات الحيّة (`business_types`, Supabase `wesihatopiznatsyfxer`). ليست افتراضات.

## أ. البنية الحاليّة — كيف يُصنَّف كل عمل

مطجر مبني على **سِجِلّ قطاعات موجَّه بالإعدادات** (config-driven Sector Registry). كل نوع عمل = إعدادات، لا كود:
- **17 نوع عمل** (`business_types` في القاعدة، مطابقة لـ `categoryKeys`).
- **9 مجموعات تصفّح للعميل** (`groupKeys`) فوق الـ17 قطاعًا (اكتشاف نظيف بـ9 تبويبات بدل 17).
- **نوعان فقط من التدفّق الفعلي** (`categoryModule.kind`): `commerce` (سلّة → طلب) و`booking` (خدمة → موعد). **هذه هي المشكلة الجذريّة**: 12 قطاعًا مختلفًا يُحشَر في تدفّق حجز واحد، و5 قطاعات في تدفّق طلب واحد.
- **22 وحدة ميزة** (`FeatureModuleKey`) تُشكِّل الهويّة الظاهرة (menu, appointments, timeslot, classes, memberships, rentals, listings, requests, courses, portfolio…)، لكن الكثير منها **مُعلَن في السِجِلّ ولا يملك تدفّق تشغيل حقيقي بعد**.

### عائلة الجدولة (BOOKING_MODULES) — كما هي مُعرَّفة مقابل ما هو مُنفَّذ
| Feature | المقصود منها | حالة التنفيذ الفعلي |
|---|---|---|
| `appointments` | حجز موعد بمقدّم واحد (عيادة/صالون) | ✅ منفّذ (booking-panel + doctor picker + slots) |
| `timeslot` | حجز فترة زمنيّة بموارد متعدّدة (ملاعب/غرف) | ⚠️ جزئي (فترة زمنيّة مفردة، بلا مدى تواريخ) |
| `classes` | حصص مجدوَلة بسعة | ⚠️ معلَن؛ يحتاج تأكيد التدفّق |
| `reservations` | حجز طاولة (مطاعم) | ✅ منفّذ (task #13) |
| `memberships` | اشتراكات متكرّرة (نادي/مدرسة) | ⚠️ معلَن؛ لا شراء اشتراك حقيقي |
| `rentals` | تأجير بالفترة (سيّارات/معدّات) | ❌ معلَن فقط، لا تدفّق تأجير بمدى تواريخ |
| `listings` | إعلانات غنيّة بالخصائص (عقار/سيّارة) | ⚠️ خصائص عبر `products.attributes`، لا تدفّق lead |

---

## ب. الجرد التفصيلي لكل قطاع

الحقول: **المعرّف** = slug + UUID القاعدة. **النموذج/التدفّق الحالي** = `categoryModule.kind` + `itemsKey`. **الوحدات الافتراضيّة** = `sectorConfig.features`.

### 1. food — مطاعم ومأكولات (Food & dining)
- **UUID:** `3c007738-…` · **المجموعة:** food · **noun:** customers
- **التدفّق الحالي:** `commerce` · items = `menu` (`addMenuItem`) — قائمة مقسّمة → سلّة → طلب.
- **الوحدات:** menu, orders, delivery, **reservations**, reviews, location, media, messaging.
- **الوحدات في لوحة التحكّم:** orders, bookings, kitchen, pos, items, inventory / customers, campaigns / accounting, suppliers, reports / …
- **الكيانات في القاعدة:** `orders` + `order_items` + `products`(=أصناف القائمة) + `product_options`(الإضافات) + `product_variants`(الأحجام) + `reservations` (طاولات).
- **المشاكل الحاليّة:** لا **modifiers إلزاميّة** مقابل اختياريّة (الإضافات كلها اختياريّة عبر product_options)؛ لا **ملاحظة على مستوى الصنف**؛ لا **طلب مجدوَل** (scheduled_for)؛ لا **إتاحة حسب الوقت** لصنف؛ تدفّق الطلب وحجز الطاولة يتشاركان نفس السطح.

### 2. retail — تسوّق ومنتجات (Shopping)
- **UUID:** `9f67ed56-…` · **المجموعة:** shopping · **noun:** customers
- **التدفّق:** `commerce` · items = `products` (`add`).
- **الوحدات:** catalog, orders, inventory, delivery, reviews, location, marketing, messaging, media.
- **القاعدة:** `products` + `product_variants` (لون/مقاس منفصلان — 0181) + `product_options` (إضافات) + `orders`.
- **المشاكل:** لا **دليل مقاسات** ولا **قياسات منتج**؛ لا **سياسة إرجاع** منظّمة (نص حرّ فقط)؛ لا wishlist على مستوى المنتج (يوجد follows على المتجر)؛ لا **مقارنة منتجات**. الأقرب للجاهزيّة بين كل القطاعات.

### 3. services — خدمات (Services)
- **UUID:** `dd82f918-…` · **المجموعة:** services · **noun:** clients
- **التدفّق:** `booking` · items = `services` (simplified).
- **الوحدات:** **requests**, portfolio, reviews, verifications, location, messaging, media.
- **القاعدة:** `service_requests` (بها `quote_amount`, `quote_note`, `status`) — تدفّق عرض سعر حقيقي موجود.
- **المشاكل:** نموذج الطلب عامّ (وصف + عنوان + هاتف)؛ لا **رفع صور للمهمّة**، لا **مدى إلحاح**، لا **نطاق خدمة**، لا **إسناد مزوّد/تتبّع تنفيذ**.

### 4. healthcare — صحة وعيادات (Health & clinics)
- **UUID:** `0d164797-…` · **المجموعة:** health · **noun:** patients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **appointments**, team, verifications, reviews, location, messaging, media.
- **القاعدة:** `bookings` (+ `doctor_id`, `party_size`, `starts_at/ends_at`, `allocation_mode`) + جدول الأطبّاء/المقدّمين + `store_verifications`.
- **المشاكل:** لا تمييز **مريض جديد/مراجِع**؛ لا **نوع كشف** (حضوري/أونلاين)؛ لا **تعليمات تحضير**؛ لا **تأمين مقبول** منظّم؛ لا إخلاء مسؤوليّة طوارئ. (الخصوصيّة الطبيّة: صحيح ألّا تُخزَّن سجلّات طبيّة في الـMVP.)

### 5. realEstate — عقارات (Real estate)
- **UUID:** `74658ed4-…` · **المجموعة:** realEstate · **noun:** leads
- **التدفّق:** `booking` · items = `listings` (simplified) → **يستخدم تدفّق الحجز بموعد**.
- **الوحدات:** **listings**, appointments, reviews, location, media, messaging.
- **القاعدة:** العقار = صفّ في `products` + `attributes` jsonb (غرف/مساحة/…) — وليس جدول `listings` (ذاك سوق الأحد).
- **المشاكل (حرِجة):** الفعل الأساسي يجب أن يكون **طلب معاينة / تواصل مع الوكيل / حفظ الإعلان** لا موعد بفترة زمنيّة؛ لا **جدول leads/inquiries**؛ لا خريطة بحث بموقع دقيق؛ لا شارة **إعلان موثّق**.

### 6. automotive — سيارات ونقل (Automotive)
- **UUID:** `72c26e3a-…` · **المجموعة:** automotive · **noun:** leads
- **التدفّق:** `commerce` · items = `listings` (simplified) → **يستخدم تدفّق السلّة/الطلب** ← تناقض صريح.
- **الوحدات:** listings, requests, **rentals**, reviews, location, media, messaging.
- **القاعدة:** `products` + `attributes` (make/model/year/…).
- **المشاكل (حرِجة):** بيع سيّارة عبر «أضف إلى السلّة» خاطئ؛ يجب **contact dealer / request test drive** (lead)؛ **تأجير السيّارات** (rentals) بلا تدفّق مدى تواريخ فعلي؛ لا فلاتر make/model/year في تجربة البائع الموحّدة مع صفحة الإعلان.

### 7. beauty — تجميل وعناية (Beauty & care)
- **UUID:** `80d344ea-…` · **المجموعة:** health · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** appointments, catalog, team, reviews, media, location, messaging.
- **القاعدة:** `bookings` + مقدّمون (team) + منتجات.
- **المشاكل:** لا **مدّة خدمة تُحرِّك السعة** بشكل ظاهر للعميل؛ لا **باقات/إضافات**؛ لا **عربون**؛ لا معرض قبل/بعد.

### 8. fitness — لياقة وأندية (Fitness & clubs)
- **UUID:** `824348bb-…` · **المجموعة:** sports · **noun:** customers
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **memberships**, **classes**, team, reviews, location, media, messaging.
- **المشاكل:** **لا شراء اشتراك/عضويّة حقيقي** رغم إعلان الوحدة؛ لا **جدول حصص بسعة** فعلي للعميل؛ لا حصّة تجريبيّة/day pass.

### 9. sportsCourts — ملاعب ورياضة (Sports & courts)
- **UUID:** `a212566e-…` · **المجموعة:** sports · **noun:** customers
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **timeslot**, memberships, reviews, location, media, messaging.
- **القاعدة:** `bookings` + `resource_id` (الملعب كـ resource).
- **المشاكل:** حجز الملعب أقرب قطاع لـ`timeslot`؛ لكن لا **سعر بالساعة/الفترة** ظاهر، ولا رزنامة إتاحة لكل ملعب.

### 10. education — تعليم ودورات (Education & courses)
- **UUID:** `45102e43-…` · **المجموعة:** education · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **courses**, team, memberships, reviews, verifications, messaging, media.
- **المشاكل:** وحدة `courses` معلَنة (portfolio/courses أُنجزت جزئيًّا)؛ لا **تسجيل بدورة بمقاعد/جدول/شهادة**؛ لا حصّة تجريبيّة.

### 11. events — مناسبات وقاعات (Events & venues)
- **UUID:** `20b16a2e-…` · **المجموعة:** bookings · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **timeslot**, catalog, media, reviews, location, messaging.
- **المشاكل:** قاعة مناسبات ≈ حجز بتاريخ/مدّة + عدد ضيوف (Model D/E hybrid)؛ التذاكر (Model K) لأنواع أخرى (ورش/فعاليات) غير مدعومة (نوع تذكرة + كميّة + بيانات حاضر).

### 12. hospitality — فنادق وشاليهات (Hotels & chalets) 🔴
- **UUID:** `e050b228-…` · **المجموعة:** bookings · **noun:** customers
- **التدفّق:** `booking` · items = `services` (simplified) → **يستخدم نموذج حجز الموعد المفرد**.
- **الوحدات:** timeslot, rentals, catalog, media, reviews, location, messaging.
- **القاعدة:** `bookings` بها `requested_date` + `starts_at/ends_at` — **لا check-in/check-out كمدى، لا عدد ليالٍ، لا كبار/أطفال/رضّع، لا عدد غرف/وحدات، لا سعر لليلة، لا تسعير موسمي**.
- **المشاكل (حرِجة — أخطر تطابق خاطئ):** تجربة إقامة احترافيّة مستحيلة على البنية الحاليّة. مطلوب Model D كامل (انظر 06_HOSPITALITY_AUDIT).

### 13. pharmacy — صيدليات ومختبرات (Pharmacies & labs)
- **UUID:** `5b2ab1f4-…` · **المجموعة:** health · **noun:** customers
- **التدفّق:** `commerce` · items = `products`.
- **الوحدات:** catalog, orders, verifications, location, reviews, messaging.
- **المشاكل:** خلط **الصيدليّة** (بيع OTC — Model A) مع **المختبر** (حجز/عيّنة منزليّة — Model C) في قطاع واحد بتدفّق تجاري واحد؛ لا **رفع وصفة**، لا قيود منتجات تُصرَف بوصفة، لا إخلاء مسؤوليّة قانوني؛ المختبر بلا مواعيد فحص/باقات/صيام.

### 14. petCare — عناية بالحيوانات (Pet care)
- **UUID:** `c4c51bf0-…` · **المجموعة:** health · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** appointments, catalog, team, reviews, location, messaging, media.
- **المشاكل:** يعمل كعيادة مصغّرة؛ ينقصه **بيانات الحيوان** (نوع/سلالة) عند الحجز.

### 15. professional — خدمات مهنية (Professional services)
- **UUID:** `96ed4291-…` · **المجموعة:** services · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **appointments**, **requests**, verifications, team, reviews, messaging.
- **القاعدة:** `service_requests` (عرض سعر) + `bookings` (استشارة).
- **المشاكل:** لا **brief مشروع** منظّم (نطاق/ميزانيّة/مهلة/ملفّات)؛ الفعل الأساسي يجب ألّا يكون checkout مباشر حين يعتمد السعر على النطاق (Model G).

### 16. contractors — مقاولات وحرفيّون (Contractors & trades)
- **UUID:** `971fdd89-…` · **المجموعة:** services · **noun:** clients
- **التدفّق:** `booking` · items = `services`.
- **الوحدات:** **requests**, portfolio, verifications, reviews, location, messaging, media.
- **المشاكل:** كـservices لكن يحتاج **صور موقع/معاينة**، **نطاق جغرافي**، **عرض سعر تفصيلي**، تتبّع تنفيذ.

### 18. farm — مزارع ومنتجات محلية (Farms & local produce)
- **UUID:** `c168e9b2-…` · **المجموعة:** shopping · **noun:** customers
- **التدفّق:** `commerce` · items = `products`.
- **الوحدات:** catalog, orders, delivery, reviews, location, media.
- **المشاكل:** لا **بيع بالوزن** (كغ) ولا وحدات قياس؛ لا **فترات تسليم مجدوَلة**؛ لا بدائل عند النفاد.

---

## ج. خلاصة الجرد — تدفّق التعاملات الحالي مقابل عدد النماذج المطلوبة

| الحقيقة | القيمة |
|---|---|
| عدد القطاعات | 17 |
| عدد **نماذج التعامل** التي تحتاجها هذه القطاعات فعليًّا | **12** (A–L) |
| عدد التدفّقات المُنفَّذة فعليًّا في مطجر | **2** (commerce order، booking appointment) + service_requests (شبه Model G) + reservations (Model E) |
| قطاعات بتدفّق **خاطئ صريح** | hospitality 🔴، automotive 🔴، realEstate 🔴 |
| قطاعات بتدفّق **ناقص جوهريًّا** | fitness، education، events، pharmacy(labs)، food(modifiers) |
| قطاعات **جاهزة تقريبًا** | retail، food(delivery)، services/contractors/professional(quote)، healthcare/beauty(appointment) |

> التفصيل الكامل لكل قطاع (النموذج الصحيح، النموذج المثالي، المنافسون، الفجوات، المرحلة) في الملفّات 06–15.
