# متجر — تدقيق الكود والمعمارية وقاعدة البيانات (02_CODE_AUDIT)

**التاريخ:** 2026-07-24 · **المُدقّق:** مهندس Full-Stack + معماري SaaS
**النطاق:** `src/` كاملًا + `supabase/migrations/` + فحص قاعدة البيانات الحيّة (project `wesihatopiznatsyfxer`)
**الحالة:** ما قبل الجذب (Pre-traction) — 14 متجر (9 نشط) · 24 منتج · 0 طلب · 8 حجوزات · 19 مستخدم · 158 migration

> منهجية الصراحة: كل ملاحظة تحمل مسارًا حقيقيًا وأثرًا وإصلاحًا وأولوية. الأرقام من قراءة الكود الفعلي واستعلامات SQL حيّة على الإنتاج، لا من التخمين.

---

## 0. ملخّص تنفيذي

متجر مبنيّ بانضباط هندسي عالٍ نسبيًا لمشروع فردي: **صفر استخدام لـ`any`**، **صفر TODO/FIXME**، TypeScript صارم، مكتبة UI موحّدة، RLS مُفعّل على كل الجداول الـ72، وطبقة `SECURITY DEFINER` منظّمة مع `search_path` مضبوط في كل الدوال التطبيقية. البنية «سجلّ القطاعات» (`lib/sectors.ts`) ذكيّة وقابلة للتوسّع فعلًا.

لكن القرار المعماري الأكبر — **إسناد كل الطفرات (mutations) تقريبًا إلى جانب العميل مباشرة عبر Supabase مع RLS كحدّ أمني وحيد** — هو مصدر معظم المخاطر. لا توجد Server Actions عمليًا (`'use server'` في ملف واحد فقط)، و99 مكوّن عميل يستخدم عميل المتصفح، منها 77 يُنفّذ `insert/update/delete` مباشرة. هذا يجعل RLS نقطة فشل مفردة، ويُنتج أنماطًا هشّة (تنسيق كتابات متعدّدة الجداول من العميل بلا معاملة atomic، مطابقة رسائل الأخطاء بالنصّ).

**الدرجة: 6.5 / 10** (التفصيل في القسم 8).

---

## 1. المعمارية (Architecture)

### 1.1 بنية المجلدات والمسارات
التنظيم نظيف ومنطقي عبر Route Groups تحت `src/app/[lang]/`:

| المجموعة | الغرض | ملاحظة |
|---|---|---|
| `(auth)` | تسجيل/دخول/استعادة | 5 مسارات |
| `(site)` | الواجهة العامة (متجر، سوق، وظائف، مركز الأعمال…) | ~70 مسار |
| `(dashboard)/admin` | لوحة المنصّة | 24 قسم |
| `(dashboard)/merchant/[storeId]` | نظام التشغيل التجاري (Business OS) | ~35 وحدة |

- **120 `page.tsx`، 6 `layout.tsx`، 4 `route.ts` فقط، 15 `loading.tsx`، 2 `error.tsx`، 1 `not-found.tsx`.**
- التدويل عبر بادئة `[lang]` مع `proxy.ts` (Next 16 يُعيد تسمية middleware→proxy) الذي يفرض البادئة ويُحدّث جلسة Supabase. سليم ومقروء.
- مسار مختصر خارج التدويل `app/s/[code]` للروابط القصيرة، و`app/api/*` لثلاث مسارات REST فقط (push/broadcast, push/hook). اتساق جيد مع طبيعة RSC.
- `src/modules/` **فارغ تمامًا** — بقايا سقالة. أثر: تشويش بسيط. إصلاح: احذفه. **أولوية: Low.**

### 1.2 فصل منطق العمل عن الواجهة — **الثغرة المعمارية الأساسية**
- منطق القراءة مُنظّم جيدًا في `src/lib/data/*` (11 ملفًا: `home.ts`, `stores.ts`, `search.ts`, `market.ts`, …) مع `import "server-only"` و`unstable_cache`. هذه الطبقة ممتازة — انظر `lib/data/stores.ts` كنموذج (تخزين مؤقت 60ث بعميل بلا كوكيز، ثم تركيب المفضّلات لكل مستخدم بعد ذلك دون تخزين). فصل ذكي بين البيانات العامة القابلة للتخزين والبيانات الخاصّة.
- **لكن منطق الكتابة لا يملك طبقة مماثلة.** `grep "use server"` = ملف واحد (`lib/cache-actions.ts`، مجرّد `revalidateTag`). لا توجد Server Actions. النتيجة: كل عملية إنشاء/تعديل تعيش **داخل مكوّن العميل** الذي يستدعي `createClient()` من المتصفح ويكتب مباشرة على الجداول.
- **الأثر:**
  1. RLS هو الحدّ الأمني الوحيد للكتابة — لا توجد طبقة تحقّق/تفويض من جانب الخادم. أي خطأ في سياسة RLS = ثغرة كتابة مباشرة على الإنتاج.
  2. **لا ذرّية (atomicity)** عبر كتابات متعدّدة الجداول من العميل. مثال حقيقي في `components/product-form.tsx:71-140`: يُدرج `products` ثم `product_variants` ثم `product_options` في ثلاث جولات شبكة منفصلة؛ فشل الجولة الثانية يترك منتجًا يتيمًا بلا تراجع. نفس النمط في محرّرات أخرى.
  3. **مطابقة أخطاء هشّة:** `insertError?.message?.includes("free_product_limit")` (`product-form.tsx:95`) — يربط تجربة المستخدم بنصّ رسالة خطأ Postgres. تغيير نصّ الـtrigger يكسر الواجهة صامتًا.
- **الإصلاح:** انقل الكتابات متعدّدة الخطوات إلى إمّا (أ) دوال `SECURITY DEFINER` RPC ذرّية (النمط موجود فعلًا وناجح لـ`place_customer_order`, `pos_record_sale`) أو (ب) Server Actions تُغلّف المنطق وتُعيد أخطاءً مُرمّزة. ابدأ بالمسارات التي تلمس المال والمخزون. **أولوية: High.**

### 1.3 موضع استدعاءات API (RSC مقابل العميل)
- **القراءة:** غالبًا في Server Components / `lib/data` — صحيح ومُخزّن.
- **الكتابة + القراءة التفاعلية:** في العميل. **575 استدعاء `useState`** عبر المكوّنات، و**142 مكوّن `'use client'`**. التطبيق «ثقيل العميل» بخلاف ما يوحي به شعار RSC.
- الأثر: حزمة JS أثقل، ومنطق أعمال مُكرّر على العميل، واعتماد كليّ على RLS. مقبول لمشروع بهذا الحجم، لكنه دَيْن معماري يتراكم مع نموّ Business OS.

### 1.4 قابلية إعادة الاستخدام
- إيجابي: سجلّ القطاعات `lib/sectors.ts` — **17 قطاعًا كـ«تهيئة لا كود»**. كل قطاع يُعرّف حزمة وحدات OS مرتّبة في 4 مجموعات (`daily/people/money/store`)، ومفردات العملاء (`customers/patients/clients/leads`)، وهوية بصرية. إضافة قطاع = تحرير ملف واحد. هذا هو العمود الفقري لقابلية توسّع Business OS، ومصمّم جيدًا (ثوابت `MONEY`/`STORE`/`MONEY_WITH_SUPPLIERS` مُعاد استخدامها، `resolveStoreModules` مع حلّ التبعيات).
- سلبي: **ملفات ضخمة تُخالف مبدأ إعادة الاستخدام:**
  - `components/automation-manager.tsx` — **1219 سطر**
  - `app/[lang]/(site)/store/[id]/page.tsx` — **1122 سطر**
  - `components/store-products.tsx` — **978 سطر**
  - `app/[lang]/(dashboard)/merchant/[storeId]/page.tsx` — **885 سطر**
  - `components/crm-manager.tsx` — 698 · `booking-panel.tsx` — 611
  - هذه «مكوّنات-god» تخلط الحالة والعرض ومنطق البيانات. أثر: صعوبة صيانة واختبار. إصلاح: تفكيك إلى مكوّنات فرعية + استخراج hooks. **أولوية: Medium.**

### 1.5 قابلية التوسّع لـBusiness OS
- البنية القطاعية جاهزة للتوسّع أفقيًا (قطاعات جديدة رخيصة).
- **عنق الزجاجة عموديًا:** لا صفحنة (pagination). `grep ".range(" = 1` استخدام وحيد مقابل **53 `.limit()`**. كل القوائم نوافذ مقيّدة بحدّ (مثال `STORE_FETCH_LIMIT = 200` في `stores.ts:66`). حين يملك متجر آلاف الطلبات/المنتجات/العملاء، ستنكسر قوائم الـOS. **أولوية: Medium** الآن (0 طلب)، ترتفع مع أوّل تاجر جادّ.

---

## 2. الواجهة الأمامية (Frontend)

### 2.1 مكتبة UI ونظام التصميم
- `src/components/ui/*` — 15 عنصرًا أساسيًا (button, card, badge, field, empty-state, page-header, skeleton, tabs, stat, sparkline, confirm-dialog, progress…). نظيفة ومموضعة جيدًا. `ui/button.tsx` نموذجي: variants/sizes مُصرّحة بأنواع، `buttonVariants()` قابل لإعادة الاستخدام، `Button` + `ButtonLink` للتماثل البصري بين الأزرار والروابط، `aria-busy` عند التحميل. جودة صناعية.
- التصميم متّسق نسبيًا عبر متغيّرات CSS (`bg-primary`, `text-foreground`, `border-border`) بدل ألوان مُصلّبة — يدعم الثيم/الوضع الليلي.

### 2.2 الحوارات والتأكيدات — **تناقض واضح**
- يوجد مكوّن `components/ui/confirm-dialog.tsx` جميل ومتوافق مع RTL/الثيم، لكنه **مُستخدم في مكان واحد فقط**.
- في المقابل: **62 استدعاء `alert()` أصلي + 47 `confirm()` أصلي** عبر المكوّنات. هذه حوارات المتصفح الخام: تُوقف الـthread، غير متوافقة مع RTL/الثيم، ولا يمكن تنسيقها، وتبدو رخيصة على موبايل. هذا يناقض ما تدّعيه ذاكرة المشروع من «شحن تأكيدات الحذف».
- **الأثر:** تجربة مستخدم غير متّسقة وغير احترافية في عشرات المسارات (حذف منتج، إلغاء طلب، …). **الإصلاح:** استبدل كل `alert/confirm` بـ`ConfirmDialog` + نظام Toast موحّد. **أولوية: High** (يلمس كل مسار كتابة تقريبًا، ورخيص الإصلاح).

### 2.3 نظام الإشعارات (Toast)
- لا يوجد نظام Toast مشترك. أنماط النجاح/الخطأ مُتناثرة: بعض المكوّنات تُظهر `error` state محلّي (جيد، انظر `product-form.tsx:45`)، وبعضها `alert()`، وملفّان فقط (`automation-manager`, `campaign-manager`) يذكران «toast» بشكل ما. **الإصلاح:** موفّر Toast واحد (Context) يُستدعى بعد كل طفرة. **أولوية: Medium.**

### 2.4 الحالات (Loading / Empty / Error)
- **Loading:** 15 `loading.tsx` + مكوّن `section-skeleton` + `ui/skeleton`. تغطية معقولة لكن غير شاملة (120 صفحة مقابل 15 هيكل تحميل).
- **Empty:** `ui/empty-state.tsx` موجود ومُستخدم — إيجابي.
- **Error:** **حدّان فقط للخطأ** (`error.tsx`) على مستوى `[lang]` الجذر. صفحات الـOS العميقة ترث الحدّ الجذري فقط؛ خطأ في وحدة تاجر يُسقط شاشة كاملة بدل حدّ موضعي. كما أن `app/[lang]/error.tsx` يحمل نصًّا مُصلّبًا (عربي/إنجليزي) بدل `dict` (مقبول لحدّ خطأ لا يمكنه تحميل القاموس بسهولة، لكنه مثال على نصّ مُصلّب). **أولوية: Low–Medium.**

### 2.5 التدويل (i18n) والنصوص المُصلّبة
- قاموس ضخم: `src/i18n/dictionaries/ar.json` بـ**2617 مفتاحًا** (والإنجليزي موازٍ)، ونوع `Dictionary` مُستنتَج من `ar.json`. **136 مكوّنًا يستخدم `dict.`** — تغطية ممتازة.
- الأثر الإيجابي: النصوص مركزيّة، والتبديل بين اللغتين متماسك. النصوص المُصلّبة نادرة (حدّ الخطأ، وبعض شارات debug). لا مشكلة جوهرية هنا.

### 2.6 دعم RTL
- **135 إشارة `dir/rtl/ltr`** عبر المكوّنات والصفحات. التطبيق «عربي أولًا» فعليًا. جيد. (يُنصح بتدقيق بصري منفصل للمكوّنات ذات الاتجاه المختلط كالأرقام/الخرائط، لكن الأساس متين.)

### 2.7 مكوّنات مُكرّرة/غير مستخدمة
- `src/modules/` فارغ (سقالة ميتة).
- تكرار وظيفي محتمل بين عائلات المدراء (`*-manager.tsx` ~30 ملفًا): `crm-manager`, `suppliers-manager`, `tasks-manager`, `inventory-manager`… تتشارك نمطًا (جدول + نموذج إضافة + كتابة عميل)، لكنها لا تتشارك تجريدًا. فرصة استخراج `<ResourceManager>` عام. **أولوية: Low** (تحسين، ليس خطأ).

---

## 3. الـBackend / API والأمان

### 3.1 نموذج التفويض
- **بوّابة الأدمن** (`admin/layout.tsx`): تتحقّق من `profiles.role='super_admin'` أو وجود `admin_permissions[]`، وإلا تُعيد التوجيه. تعليق صريح: «RLS تبقى الإنفاذ الحقيقي على الكتابات» — وعي معماري جيد.
- **عزل التاجر** (`merchant/[storeId]/layout.tsx`): يتحقّق من `UUID_RE` ثم `supabase.rpc("can_manage_store", {p_store_id})` مرّة واحدة على مستوى الـlayout ويُعيد التوجيه عند الفشل. النمط صحيح، لكنه **بوّابة UX** — الإنفاذ الفعلي للكتابة يبقى على RLS في كل مكوّن عميل تحته.
- دوال المساعدة في DB نظيفة ومكتوبة جيدًا (كلها `STABLE`, `search_path=''`, أسماء مؤهّلة بالكامل):
  - `is_super_admin()`, `is_platform_admin()`, `admin_can(section)` — تحقّق أدمن دقيق (super أو صلاحية قسم عبر `admin_permissions ? section`).
  - `can_manage_store(id)` / `staff_can(id, perm)` / `owns_store()` — عزل التاجر مع دعم طاقم (`store_staff.permissions ->> perm`).
  - `prevent_role_change()` trigger — يمنع مستخدمًا عاديًا من ترقية `role`/`is_active` لنفسه (يُعيد القيمة القديمة). دفاع جيّد بعمق.

### 3.2 دوال SECURITY DEFINER RPC
- **~75 دالة `SECURITY DEFINER`** تُشكّل «الـbackend الحقيقي» للطفرات الحسّاسة: `place_customer_order`, `place_guest_order`, `pos_record_sale`, `record_order_payment`, `redeem_loyalty_points`, `validate_coupon`, `adjust_stock`, `send_store_campaign`… **كلها تضبط `search_path`** (لا توجد نتيجة `function_search_path_mutable` من المُدقّق — ممتاز، هذا خطأ شائع تجنّبه المشروع). هذه هي الأنماط الصحيحة: كتابات المال/المخزون ذرّية داخل الدالة، تُعيد حساب الأسعار على الخادم (`place_guest_order` يُعيد الحساب ولا يثق بأسعار العميل).
- **لكن:** المُدقّق يرصد **105 من 108 نتيجة أمنية** = «دوال SECURITY DEFINER قابلة للاستدعاء عبر RPC» (التفصيل في 4.2). كثير منها إيجابيّات كاذبة (دالة مثل `place_guest_order` *يجب* أن تكون عامة)، لكن **بعضها يستحقّ التدقيق الجادّ:**
  - `get_push_subs(p_uid uuid, p_secret text)` قابلة للاستدعاء من **anon** — تعتمد على «secret» يُمرّر كوسيط. إن كان السرّ ضعيفًا أو مُسرّبًا في الكود، فهي قناة تعداد اشتراكات الدفع. **راجع جسم الدالة والسرّ.** **أولوية: High.**
  - دوال الـtriggers (`notify_new_order`, `guard_guest_order_rate`, `on_new_message`, `prevent_admin_perm_change`, `award_loyalty_on_complete`…) مكشوفة كـRPC قابلة للاستدعاء المباشر. استدعاؤها يدويًا لا يجب أن يكسر البيانات (تعمل على `NEW`/`OLD`)، لكن كشفها كسطح API غير ضروري. **أولوية: Medium.**
  - `admin_can`, `is_super_admin`, `is_platform_admin` قابلة للاستدعاء من anon — تُعيد `false` لغير المسجّل فلا تسريب فعلي، لكنها ضوضاء سطح-هجوم.

### 3.3 التحقّق من المُدخلات
- **لا توجد طبقة تحقّق من جانب الخادم على الكتابات المباشرة** (لأنها من العميل). التحقّق يعتمد على: (أ) قيود DB (CHECK/NOT NULL/FK)، (ب) الـtriggers (`enforce_free_product_limit`, `guard_guest_order_rate`, `validate_store_slug`, `limit_leader_submissions`). هذا دفاع جيّد على مستوى DB لكنه يترك تحقّق الأشكال/الأنواع الدقيقة للعميل فقط.
- لا مكتبة تحقّق (Zod/Valibot) في التبعيات. الأثر: رسائل خطأ غير متّسقة، ومنطق تحقّق مُكرّر يدويًا في النماذج. **أولوية: Medium.**

### 3.4 الصفحنة والبحث
- **البحث:** مبني على `pg_trgm` عبر RPC (`search_products_fuzzy`, `search_store_ids_by_product`) + فهارس GIN trigram. نهج سليم وقابل للتوسّع.
- **الصفحنة:** غائبة عمليًا (انظر 1.5) — نوافذ `.limit()` فقط. سيصبح دَيْنًا عند النموّ.

### 3.5 مسارات REST
- ثلاث فقط (`api/push/broadcast`, `api/push/hook`) + عميل Supabase. لا مفتاح `service_role` في الكود إطلاقًا (`grep` = 0) — إيجابي أمني قويّ (لا تصعيد صلاحيات مُسرّب). لكنه يعني أن كل شيء يمرّ عبر anon key + RLS.

---

## 4. قاعدة البيانات

### 4.1 جودة المخطّط والعلاقات
**الحجم:** 72 جدولًا · 208 سياسة RLS · 213 فهرسًا · 50 trigger · **RLS مُفعّل على 100% من الجداول** (لا نتيجة `rls_disabled_in_public` — ممتاز).

**نقاط قوّة المخطّط:**
- تطبيع جيّد لعائلة التجارة (`orders`/`order_items`/`order_events`/`order_payments`)، والحجوزات، والوحدات القطاعية.
- تقييمات مُزال-تطبيعها (`stores.rating_avg/rating_count`) مُحدّثة عبر trigger (`sync_store_rating`) — قرار أداء صحيح.
- الـslug حيث يلزم (`stores`, `products`? لا، `business_leaders`, `plans`, `business_types`, `market_categories`, `academy_guides`, `site_pages`).
- بنية جاهزة لـmulti-store/POS/inventory/subscription: `store_locations`, `store_staff`, `stock_movements`, `pos_sales`/`pos_sale_items`, `subscriptions`, `plans`, `store_modules`.

**ضعف المخطّط — تناقض الاصطلاحات (Consistency):**
- **`updated_at` غير متّسق:** موجود على `stores`/`products`/`orders`… لكنه **غائب** عن `business_leaders`, `wholesale_products`, `job_postings`, `gigs`, `product_reviews`, `product_questions`, `messages`, `store_sections`, `store_classes`, `store_courses`, `referrals`، وغيرها. الأثر: يصعب تتبّع آخر تعديل/المزامنة/التخزين المؤقت. **أولوية: Low–Medium.**
- **الحذف الناعم (soft-delete) شبه غائب:** `deleted_at` على **3 جداول فقط** (`stores`, `products`, `profiles`). كل شيء آخر (طلبات، حجوزات، قوائم، مراجعات…) حذف صلب. الأثر: فقدان بيانات لا رجعة فيه + كسر تكامل مرجعي محتمل عند الحذف. لبيانات مالية/طلبات هذا خطير عند التشغيل الحقيقي. **أولوية: Medium.**
- `created_at` غائب عن `addresses` و`app_settings` (الأخير مقبول كصفّ مفرد).
- **تناقض توأمة الجداول العامة:** أنماط مثل `store_courses`/`store_classes`/`store_membership_plans` تحمل زوج سياسات `manage` + `public_read` يتكرّر عبر 5 أدوار — مصدر ضخّ نتائج الأداء (انظر 4.3).

### 4.2 نتائج المُدقّق الأمني (Security Advisors) — 108 نتيجة، جميعها WARN، صفر ERROR
| النوع | العدد | المستوى | الخلاصة |
|---|---|---|---|
| `authenticated_security_definer_function_executable` | 70 | WARN | دوال SECURITY DEFINER يستطيع أي مستخدم مسجّل استدعاءها عبر `/rest/v1/rpc/*` |
| `anon_security_definer_function_executable` | 35 | WARN | **الأخطر:** قابلة للاستدعاء بلا تسجيل دخول إطلاقًا |
| `extension_in_public` | 2 | WARN | `pg_trgm` و`pg_net` مثبّتان في schema `public` |
| `auth_leaked_password_protection` | 1 | WARN | حماية كلمات المرور المُسرّبة (HaveIBeenPwned) مُعطّلة |

- **الأولوية القصوى:** المجموعة الـ35 القابلة للاستدعاء من anon. غالبيتها إيجابيّات كاذبة تصميمية (`place_guest_order`, `get_best_sellers`, `search_products_fuzzy`, `booked_times`…)، لكن راجع صراحةً: `get_push_subs(uid, secret)`، ودوال الـtriggers المكشوفة (`notify_leader_submission`, `on_new_message`, `guard_guest_order_rate`, `prevent_admin_perm_change`). **الإصلاح العام:** `REVOKE EXECUTE ... FROM anon, authenticated` على كل دالة ليست RPC عامة مقصودة، وإبقاء المنح فقط على الدوال التي يستدعيها العميل فعلًا. **أولوية: High.**
- `pg_trgm`/`pg_net` في public: انقلهما إلى schema `extensions`. **أولوية: Low.**
- حماية كلمات المرور المُسرّبة: مفتاح لوحة تحكّم واحد (Auth settings). **أولوية: Medium** (رخيص وقيمته عالية).

> لا وجود لأي من: `rls_disabled_in_public`, `security_definer_view`, `function_search_path_mutable`, `duplicate_index`. هذا مؤشّر نضج جيّد.

### 4.3 نتائج المُدقّق للأداء (Performance Advisors) — 116 نتيجة
| النوع | العدد | المستوى | الخلاصة |
|---|---|---|---|
| `multiple_permissive_policies` | 64 | WARN | سياستان permissive أو أكثر لنفس (الدور × العملية) — تُنفّذان معًا لكل صفّ |
| `unused_index` | 46 | INFO | فهارس لم تُستخدم قطّ (مرشّحة للحذف) |
| `unindexed_foreign_keys` | 5 | INFO | مفاتيح أجنبية بلا فهرس مُغطٍّ |
| `auth_rls_initplan` | 1 | WARN | `business_leaders_submit` يُعيد تقييم `auth.*()` لكل صفّ |

- **`multiple_permissive_policies` (64):** ناتج عن نمط زوج `admin_*` + `*_select/public_read` على 23 جدولًا. كل استعلام يُقيّم كلتا السياستين. مُضخّم لأن جداول `manage+public_read` تُولّد صفًّا لكل دور (anon/authenticated/authenticator/dashboard_user/supabase_privileged_role). **الإصلاح:** ادمج كل زوج في سياسة واحدة بشرط `USING (is_platform_admin() OR <public_condition>)`. الجداول الأكثر تأثّرًا: `business_leaders`, `store_courses`, `store_classes`, `store_membership_plans`, `store_modules`, `store_portfolio`, `store_resources`, `store_verifications`, `gigs`, `job_postings`, `wholesale_products`. **أولوية: Medium.**
- **`unused_index` (46):** فهارس أُنشئت ولم تُضرب قطّ — كثير منها `*_trgm` و`*_store_idx` (مثل `stores_name_trgm`, `products_name_trgm`, `listings_title_trgm`, `store_portfolio_store_idx`…). هذا **متوقّع في مرحلة ما قبل الجذب** (0 طلب، حركة ضئيلة) — لا تحذفها بعد؛ بعضها (trigram) سيُستخدم فور تدفّق البحث. **أولوية: Low** — أعِد التقييم بعد جذب حقيقي.
- **`unindexed_foreign_keys` (5):** `automation_runs.automation_id`, `loyalty_ledger.order_id`, `loyalty_ledger.store_id`, `order_events.actor_id`, `products.section_id`. رخيص وواضح — أضِف فهرسًا لكلٍّ. **أولوية: Medium** (يمنع فحوصات جدول كاملة عند الحذف/الربط مستقبلًا).
- **`auth_rls_initplan` (1):** لفّ النداء بـ`(select auth.uid())` في سياسة `business_leaders_submit`. رخيص. **أولوية: Low.**

### 4.4 جاهزية multi-store / subscription / inventory / POS
- **البنية موجودة** (جداول + RPCs + وحدات OS). لكنها **غير مُختبرة تحت حمل** (0 طلب، 1 عملية POS، 1 حركة مخزون). المخاطر الكامنة: غياب الصفحنة، الحذف الصلب على الطلبات، وتنسيق الكتابات من العميل بلا ذرّية في مسارات لا تمرّ عبر RPC. **قبل أوّل تاجر جادّ:** وجّه كل كتابات المخزون/المال عبر RPCs الذرّية الموجودة، وأضِف صفحنة لقوائم الطلبات/المنتجات/العملاء.

---

## 5. الجودة العامة والانضباط الهندسي
- ✅ **صفر `any`** عبر `components/lib/app` — انضباط أنواع ممتاز.
- ✅ **صفر TODO/FIXME/HACK** — لا دَيْن مُعلَّم مهجور.
- ✅ **3 استدعاءات `console` فقط** — نظيف.
- ✅ لا مفتاح `service_role` في الكود.
- ⚠️ **14 `eslint-disable`/`@ts-ignore`/`@ts-expect-error`** — قليلة لكن تستحقّ مراجعة (بعضها في `cache-actions.ts` مُبرَّر ومُوثّق).
- ⚠️ اختبارات محدودة: 7 ملفّات `__tests__` في `lib` فقط (currency, geo, hub-calc, jsonld, site, whatsapp, attributes) عبر Vitest. **صفر اختبار للمكوّنات أو مسارات الطفرات الحرجة** (الطلبات، الدفع، المخزون). الأثر: لا شبكة أمان لأخطر المسارات. **أولوية: Medium.**
- ⚠️ ملاحظة `AGENTS.md`: «هذه ليست Next.js التي تعرفها» — المشروع على Next 16 canary بتغييرات كاسرة (proxy بدل middleware، توقيع `revalidateTag` تغيّر). التفاف موجود في `cache-actions.ts`. مخاطرة استقرار عند ترقيات المكتبة. **أولوية: Low** (مراقبة).

---

## 6. نقاط القوّة (Strengths)
1. **انضباط أنواع وكود استثنائي لمشروع فردي:** صفر `any`، صفر TODO، TypeScript صارم، ESLint نظيف تقريبًا.
2. **سجلّ القطاعات (`lib/sectors.ts`)** — تجريد «تهيئة لا كود» أنيق وقابل للتوسّع فعلًا لـ17 قطاعًا؛ العمود الفقري الصحيح لـBusiness OS.
3. **طبقة قراءة/تخزين مؤقت ناضجة (`lib/data/*`)** مع `server-only` وفصل ذكي بين البيانات العامة القابلة للتخزين والخاصّة (نموذج `stores.ts`).
4. **حِرَفية DB في الدوال الحسّاسة:** كل SECURITY DEFINER تضبط `search_path`، وكتابات المال/المخزون ذرّية داخل RPCs تُعيد حساب الأسعار على الخادم (`place_guest_order`, `pos_record_sale`) — لا ثقة بالعميل حيث يهمّ.
5. **RLS شامل** (100% من الجداول) + دوال تفويض نظيفة (`admin_can`, `can_manage_store`, `staff_can`) + دفاع بعمق (`prevent_role_change`).
6. **مكتبة UI موحّدة** متوافقة مع الثيم/RTL، وتدويل شبه كامل (2617 مفتاحًا، 136 مكوّنًا).
7. **صفر تسريب لمفتاح service_role** — كل شيء تحت anon + RLS.
8. **لا نتائج ERROR إطلاقًا** من مُدقّق Supabase — كل الملاحظات WARN/INFO، ومعظم الأخطاء الشائعة (search_path، RLS معطّل، فهارس مكرّرة) متجنَّبة أصلًا.

---

## 7. جدول الأولويات (Actionable)

### Critical
- (لا شيء يرقى إلى Critical — لا ثغرة كتابة مؤكّدة ولا ERROR من المُدقّق. النظام آمن هيكليًا وإن كان سطح الـRPC واسعًا.)

### High
1. **راجع `get_push_subs(uid, secret)` والدوال anon-executable** غير المقصودة كـAPI عام؛ `REVOKE EXECUTE FROM anon/authenticated` على كل ما ليس RPC عامًا مقصودًا (35 anon + 70 authenticated). — DB.
2. **استبدل 62 `alert()` + 47 `confirm()`** بـ`ui/confirm-dialog` + نظام Toast موحّد. تناقض UX يلمس كل مسار كتابة. — Frontend.
3. **انقل الكتابات متعدّدة الجداول من العميل إلى RPCs ذرّية / Server Actions** (نموذج `product-form.tsx:71-140`: منتج+variants+options بلا معاملة). ابدأ بالمال والمخزون. أزِل مطابقة أخطاء `.includes("free_product_limit")` لصالح رموز أخطاء. — Architecture.

### Medium
4. أضِف فهارس للمفاتيح الأجنبية الخمسة غير المُفهرسة. — DB.
5. ادمج 64 زوج سياسات `admin + public_read` في سياسة واحدة لكل جدول. — DB.
6. فعّل حماية كلمات المرور المُسرّبة (Auth toggle). — DB/Auth.
7. أضِف حذفًا ناعمًا (`deleted_at`) للطلبات/الحجوزات/القوائم؛ ووحّد `updated_at`. — DB.
8. أضِف صفحنة حقيقية (`.range()`) لقوائم OS (طلبات/منتجات/عملاء) قبل أوّل تاجر جادّ. — Backend.
9. أدخِل مكتبة تحقّق (Zod) + طبقة تحقّق موحّدة على الكتابات. — Backend.
10. فكّك المكوّنات-god (`automation-manager` 1219س، `store/[id]/page` 1122س، `store-products` 978س). — Frontend.
11. أضِف اختبارات لمسارات الطفرات الحرجة (الطلبات/الدفع/المخزون). — Quality.
12. أضِف حدود خطأ (`error.tsx`) موضعية داخل مجموعتَي admin/merchant. — Frontend.

### Low
13. احذف `src/modules/` الفارغ.
14. انقل `pg_trgm`/`pg_net` إلى schema `extensions`.
15. لفّ `auth.*()` بـ`(select …)` في `business_leaders_submit`.
16. راجع الـ14 `eslint-disable/ts-ignore`.
17. أعِد تقييم الـ46 فهرسًا غير المستخدم **بعد** جذب حقيقي (لا تحذفها الآن).
18. استخرج `<ResourceManager>` عام لعائلة `*-manager.tsx`.

---

## 8. الدرجة النهائية: **6.5 / 10**

**التبرير:**
- **يرفع الدرجة (+):** انضباط كود نادر (صفر any/TODO)، بنية قطاعية قابلة للتوسّع مصمّمة بذكاء، طبقة بيانات/تخزين ناضجة، RLS شامل بلا ERROR، حِرَفية DB في المسارات المالية، مكتبة UI + i18n متينة، لا تسريب صلاحيات.
- **يخفض الدرجة (−):** القرار المعماري بإسناد الكتابات للعميل يجعل RLS نقطة فشل مفردة وينتج أنماطًا هشّة (لا ذرّية، مطابقة أخطاء بالنصّ)؛ سطح RPC واسع مكشوف لـanon يحتاج تشذيبًا؛ تناقض UX صارخ (109 حوار متصفح خام مقابل مكوّن حوار مُستخدم مرّة)؛ غياب الصفحنة والحذف الناعم يهدّد جاهزية التشغيل الحقيقي؛ مكوّنات-god؛ تغطية اختبار ضعيفة للمسارات الحرجة.

**الخلاصة:** أساس هندسي قويّ وواعٍ (فوق المتوسط بوضوح)، لكنه ليس جاهزًا للتشغيل بحمل حقيقي حتى تُعالَج بنود High + بنود Medium الخاصّة بالذرّية والصفحنة والحذف الناعم. المشروع في وضع «جيّد جدًا لما قبل الجذب، يحتاج تصليبًا قبل أوّل تاجر جادّ يلمس المال».
