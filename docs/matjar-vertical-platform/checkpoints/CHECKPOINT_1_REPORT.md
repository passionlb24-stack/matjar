# CHECKPOINT 1 — Safety & Wiring Foundation (تقرير)

الفرع: `feat/vertical-platform-foundation` · نوع التغيير: **إضافي، غير مدمّر، بلا هجرات قاعدة بيانات، بلا بيانات ملفّقة، بلا بوّابة دفع**.

## الهدف
إغلاق الفجوة الجذريّة (الربط) الموثّقة في التدقيق العمودي (`audit/matjar-vertical-commerce-audit/`): صفحة المتجر تقرّر التدفّق من قوائم مبرمَجة على الـslug بدل الوحدات المُفعَّلة → قطاعات تُعلن ميزة ولا تحصل على سطحها، وقطاعات تعرض تدفّقًا **خاطئًا** (سيّارة بالسلّة، فندق بالساعة). كل ذلك **بصفر تغيير في القاعدة**.

## CP0 — نتائج التحقّق (مقابل الكود الفعلي)
| ادّعاء التدقيق | مؤكَّد؟ | الدليل |
|---|---|---|
| تدفّقان فقط (order/appointment) | ✅ | `src/lib/modules.ts` `categoryModule.kind` |
| `bookingCategories` مبرمَجة `{services,healthcare,realEstate}` | ✅ | `store/[id]/page.tsx:62` + `product/[id]/page.tsx:47` |
| محرّك المواعيد لا يظهر لـbeauty/petCare/professional | ✅ | كانت خارج `bookingCategories` |
| `ServiceRequestForm` مربوط بـservices/healthcare فقط | ✅ | `store/[id]/page.tsx` شرط `category === "services" \|\| "healthcare"` |
| السيّارة تُباع بالسلّة (commerce) | ✅ | `automotive` kind=commerce → `ProductOrder` |
| slug جديد يكسر الصفحة | ✅ | `sectorConfig[category]` بلا fallback للمجهول |
| memberships/courses بلا صفّ (WhatsApp) | ✅ | `store_membership_plans`/`store_courses` بطاقات |
| إطار اختبار موجود | ✅ (**تصحيح للتدقيق**) | `vitest` موجود + 7 ملفّات اختبار |

**تصحيحات على التدقيق:** التدقيق افترض غياب إطار اختبار — الواقع `vitest` جاهز. وأنّ healthcare يُظهر `ServiceRequestForm`؛ صحيح حاليًّا لكنه **drift** (healthcare يُعلن `appointments` لا `requests`).

## ما تغيّر (8 ملفّات، +353/−28)

### جديد
- **`src/lib/store-experience.ts`** — الـ**Store Experience Resolver** (دالّة نقيّة). المصدر الوحيد لقرار «أي سطح تعامل يظهر»، مشتقّ من الوحدات المُفعَّلة + حالة القطاع التشغيليّة. يصدّر `resolveStoreExperience`، `isDirectoryOnlySector`، `isOrderSurface`.
- **`src/lib/__tests__/store-experience.test.ts`** — 8 اختبارات تغطّي: order/appointment/catalog، إصلاح الـdrift، directory-only، الـlead المؤقّت للسيّارات، تعطيل الوحدة.

### معدّل
- **`store/[id]/page.tsx`** — حذف `bookingCategories`؛ العرض الآن من `resolveStoreExperience({category, enabledModules})`: `ServiceRequestForm` من `showServiceRequest`، `TimeslotBooking`/`ClassesBooking` من `allowResourceBooking`، `StoreProductsSection` يستقبل `surface` + `directoryOnly`.
- **`store-products-section.tsx`** — بدل `isBooking` منطق ثلاثي: `appointment`→BookingPanel، `order`→StoreProducts، `catalog`→شبكة تصفّح غير تعامليّة (بطاقات تربط لتفاصيل المنتج + ملاحظة «قريبًا» للـdirectory-only).
- **`product/[id]/page.tsx`** — حذف `bookingCategories`؛ صندوق الشراء يظهر فقط عبر `isOrderSurface(category)` → **السيّارة ما عادت تُباع بالسلّة**.
- **`business-type-manager.tsx`** — حارس slug: منع إنشاء نوع عمل بـslug خارج الـ17 المدعومة (تحذير + تعطيل الحفظ) لأنه يكسر الصفحات.
- **`ar.json`/`en.json`** — مفتاح `store.comingSoonNote` (parity: 2657/2657 ✅).

## تغييرات السلوك (قبل → بعد)
| القطاع | قبل | بعد |
|---|---|---|
| beauty, petCare | شبكة منتجات (سلّة) | **محرّك المواعيد (BookingPanel)** ✅ |
| professional | لا موعد ولا نموذج طلب | **موعد + نموذج طلب** ✅ |
| contractors | لا نموذج طلب (سلّة مضلِّلة) | **نموذج طلب + كتالوج** ✅ |
| services | موعد + نموذج طلب | نموذج طلب + كتالوج (النموذج الصحيح F/G؛ فقد تقويم الموعد) |
| healthcare | موعد + نموذج طلب | **موعد فقط** (أزيل نموذج الطلب المضلِّل) |
| automotive | **سلّة + دفع عند التسليم** 🔴 | **directory-only** (تصفّح + تواصل + نموذج استفسار) ✅ |
| realEstate | موعد عيادة على العقار 🔴 | **directory-only** (تصفّح + تواصل) ✅ |
| hospitality | حجز غرفة بالساعة 🔴 | **directory-only** (تصفّح + تواصل) ✅ |
| events | حجز بالساعة | **directory-only** |
| retail, food, pharmacy, farm | طلب/سلّة | **بلا تغيير** ✅ |
| sportsCourts | حجز ملعب بالساعة | **بلا تغيير** ✅ (نشط) |

## التحقّق
- `vitest run`: **40/40 ✅** · `tsc --noEmit`: **نظيف ✅** · `next build`: **نجح ✅** · parity النصوص: **2657/2657 ✅**.
- تدفّقات محفوظة (بلا مساس): سلّة/طلب retail+food، guest checkout، مناطق التوصيل، variants، coupons، flash، محرّك المواعيد وقواعده، reservations، مراجعات، شهادات، فروع، service_requests.

## المخاطر والتراجع
- **مخاطرة:** تغيير سلوك services/healthcare (فقد سطح كان ظاهرًا). مقصود ومطابق للنموذج الصحيح، لكن يستحق QA بصري.
- **مخاطرة منخفضة:** القطاعات appointment (beauty/vet/pro) تحتاج خدمات/مقدّمين مُدخَلين ليعمل الحجز؛ إن لم يوجد تظهر `noProducts` (حالة فارغة مقبولة، تحسينها في CP2).
- **التراجع:** الرجوع دالّة بحتة + شروط عرض؛ `git revert` للـcommit يعيد السلوك السابق بالكامل. لا هجرات قاعدة، لا بيانات مُرحّلة.
- **لم يُنشر بعد:** الفرع غير مدموج بـmain وغير منشور — بانتظار موافقة المالك على الدمج/النشر + QA بصري لكل قطاع.

## QA يدوي موصى قبل الدمج
1. متجر beauty/salon → يظهر تقويم الحجز (لا سلّة).
2. متجر automotive → لا سلّة؛ صفحة تفاصيل السيّارة تُظهر «زر المتجر» لا صندوق شراء.
3. متجر realEstate/hospitality → وضع directory-only + ملاحظة «قريبًا».
4. متجر retail/food → سلّة وطلب كما هي (لا انحدار).
5. أدمن → إنشاء نوع عمل بـslug غير معروف → محظور بتحذير.
6. عربي/إنجليزي + موبايل RTL.

## المقترح للـCheckpoint التالي
لا تُبنى محرّكات CP2–CP6 مضاربةً. الأولويّة عند وجود تاجر حقيقي: **CP3 (محرّك leads)** لأن realEstate/automotive الآن directory-only وينتظران التقاط lead مُنظَّم؛ ثم **CP5 (محرّك الإقامة)** عند أوّل فندق/شاليه.
