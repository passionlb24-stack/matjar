# 07 — تدقيق الأداء (Performance Audit)

**المنصّة:** متجر (Matjar) — Next.js 16 (App Router / RSC) · Supabase · Tailwind v4 · RTL عربي أولاً
**الواقع:** 14 متجر · 24 منتج · 0 طلب · ما قبل الجذب (pre-traction)
**المدقّق:** Performance Engineer — تدقيق للكود الفعلي، بدون تعديل.
**النتيجة النهائية: 6.5 / 10** (بنية جيّدة، لكن صفحات الـ SEO الأساسية غير مخزّنة مؤقتاً + وزن خطوط وسكربتات طرف ثالث زائد).

> **الخلاصة بصراحة:** المشروع مبنيّ بوعي أداء أعلى من المتوسّط (downscale للصور، `unstable_cache` للصفحة الرئيسيّة، `dynamic import` لـ Leaflet، 15 ملف `loading.tsx`). لكن أخطر نقطة: **صفحات المتجر والمنتج — وهي بالضبط الصفحات اللي بدها تترتّب بغوغل — ديناميكيّة بالكامل (dynamic)، بتضرب الـ DB بكل زيارة، بلا أي ISR أو cache.** هالشي أخطر من أي شي تاني بهالتقرير لأنه بيضرب TTFB و LCP على أهمّ الصفحات، ولزوّار من لبنان على شبكات بطيئة.

---

## 1) معالجة الصور (Image Handling) — 8/10

| البند | الحالة | ملاحظة |
|---|---|---|
| Downscale قبل الرفع | ✅ ممتاز | `src/components/image-upload.tsx:12` — يقصّ لأطول ضلع 1600px + JPEG q=0.85، يترك PNG للشفافية. يمنع رفع صور 4000px/عدّة MB من الموبايل. |
| `next/image` | ✅ مستعمَل بـ 40 مكان | يعطي `srcset` + WebP/AVIF + lazy تلقائي. |
| `remotePatterns` | ✅ مضبوط | `next.config.ts:41` — Supabase storage فقط. |
| `<img>` خام | ⚠️ حالة وحيدة مقبولة | `src/components/product-story-card.tsx:182` — صورة PNG مولّدة من canvas (story export)، مش صورة محتوى. مقبول. |
| **اللوغو `unoptimized`** | ⚠️ مشكلة صغيرة | `src/components/site-header.tsx:44` — `<Image>` بـ `width=450 height=182` + `priority` + **`unoptimized`**، معروض بـ `h-9` (≈36px). يعني بننزّل PNG 450px كامل على كل صفحة بدل نسخة 72px محسّنة. |

**التوصية (P2):** شيل `unoptimized` عن اللوغو أو استعمل SVG. حتى لو انضغط اللوغو مرّة، `unoptimized` بيلغي إعادة القياس والصيغة الحديثة على كل رندر. اللوغو `priority` فبيدخل بالـ LCP path على كل صفحة.

---

## 2) تحميل الخطوط (Font Loading) — 5/10 ⚠️

`src/app/[lang]/layout.tsx:12-25` — عائلتان عبر `next/font/google`:

- **Tajawal:** 4 أوزان (`400/500/700/800`) × `["arabic","latin"]`
- **Alexandria:** 4 أوزان (`500/600/700/800`) × `["arabic","latin"]`

**المشكلة:** 8 أوزان مضروبة بمجموعتَي subset = **حتى 16 ملف خطّ** يُستضاف ذاتيّاً. الحروف العربيّة أثقل من اللاتينيّة (glyph coverage أوسع)، وكل وزن ملف مستقلّ. هيدا وزن كبير على أوّل رسم، وعلى شبكة لبنانيّة بطيئة بيأخّر النصّ (رغم أنّ `next/font` بيعمل self-host + `font-display: swap` تلقائيّاً، فما في FOIT قاتل، بس في CLS محتمَل عند التبديل + بايتات زائدة).

**التوصيات:**
- **(P2)** قلّل الأوزان لأدنى حدّ فعليّ. غالباً بيكفي Tajawal `400/700` وAlexandria `700/800` للعناوين. كل وزن بتشيله = ملفّ عربيّ ثقيل أقلّ.
- **(P3)** تأكّد إنّه ما في وزن مُعرَّف بالـ CSS variable وغير مستعمَل فعليّاً (dead weight). دقّق استعمال `--font-alexandria` — إذا العناوين بس، ما في داعي لـ 4 أوزان منها.
- **(P3)** فكّر بـ `preload` صريح لأهمّ وزنَي عربيّ فقط، وترك الباقي `preload: false`.

---

## 3) وزن الـ Client Components والمكتبات الثقيلة — 6.5/10

- **142 ملف `"use client"`** — رقم كبير لكن طبيعيّ لتطبيق تفاعليّ (نماذج، أزرار، لوحات). المهمّ الحدود بين الصفحات، والـ RSC هي الافتراض على الصفحات العامّة (جيّد).
- **Leaflet (`leaflet` ~150KB):** ✅ مُحمَّل عبر `dynamic(..., { ssr:false })` — `src/components/store-map-client.tsx:8` و`src/components/edit-store-form.tsx:28`، مع `loading` skeleton. ممتاز — ما بيدخل bundle الصفحة إلّا لمّا يظهر الماب.
- **`qrcode` (~50KB) و`jsbarcode`:** ⚠️ **مستورَدة static (import عاديّ) داخل مكوّنات client:**
  - `src/components/hub/qr-generator.tsx:4`
  - `src/components/hub/barcode-generator.tsx:4`
  - `src/components/store-share-card.tsx:4`
  - `src/components/product-story-card.tsx:4`

  إذا أيّ من هالمكوّنات مرندَر eager (مش خلف modal/tab مع `dynamic`)، بينضاف QR/barcode لـ bundle الصفحة بلا داعي. أدوات الـ hub وبطاقات المشاركة مستعمَلة بشكل ظرفيّ فقط.

**التوصيات:**
- **(P2)** لفّ `qr-generator` / `barcode-generator` / `store-share-card` / `product-story-card` بـ `next/dynamic` (مع `ssr:false` للي بتلمس canvas)، تمام متل ما انعمل مع Leaflet. مكسب bundle مباشر على صفحات المتجر و/hub.
- **(P3)** شغّل `next build` وراجِع تقرير أحجام الـ First Load JS لكل route؛ حدّد أثقل 5 صفحات وعالجها بالأولويّة.

---

## 4) جلب البيانات (Data Fetching) و N+1 — 7/10

- **نمط جيّد:** صفحة المتجر تستعمل React `cache()` لتوحيد الحِمل بين `generateMetadata` والصفحة — `src/app/[lang]/(site)/store/[id]/page.tsx:126` (`loadStore = cache(...)`). يمنع ازدواج الاستعلامات لكل رندر.
- **بلا N+1 صارخ:** المنتجات والأقسام تُجلب بـ استعلامَين مجمّعَين (مش loop لكل منتج). الصفحة الرئيسيّة تستعمل `Promise.all` وأقسام `Suspense` مستقلّة تبثّ (stream) بدل ما تحجب أوّل رسم — `src/app/[lang]/(site)/page.tsx:84`.
- **`business_types(slug)` join** داخل استعلام المتجر — سليم (join مش N+1).

**مخاطر (P2/P3):**
- استعلام `loadStore` بيجيب **كل** الأعمدة الكبيرة (description, hours, payment_note…) حتى لـ `generateMetadata` اللي بدو الاسم/الوصف بس. مع `cache()` الحِمل مرّة وحدة، بس لسّه بنسحب صفّاً عريضاً مرّتين منطقيّاً. مقبول حاليّاً.
- الصفحة الرئيسيّة بتنادي `getUsdLbpRate()` بـ ~11 موقع؛ محلولة بـ `cache()` + `unstable_cache` (`src/lib/data/settings.ts:31`). ✅

---

## 5) كفاءة استعلامات الـ DB + مستشارو الأداء (Supabase Advisors) — 5.5/10

سحبت مستشاري الأداء من مشروع `wesihatopiznatsyfxer`: **116 نتيجة**.

| النوع | العدد | الخطورة | القراءة الصحيحة |
|---|---|---|---|
| `multiple_permissive_policies` | 64 (على 25 جدول) | WARN | **حقيقيّة** — كل `SELECT` بيقيّم سياستَي RLS متداخلتين (admin + public) بدل وحدة. تكلفة CPU على كل قراءة. |
| `unused_index` | 46 | INFO | **مضلِّلة حاليّاً** — الفهارس «غير مستعمَلة» لأنّه صفر بيانات/زيارات (pre-traction)، مش لأنها زائدة. لا تحذفها بناءً على هالتقرير. |
| `unindexed_foreign_keys` | 5 | INFO | يستحقّ الإصلاح قبل الجذب. |
| `auth_rls_initplan` | 1 | WARN | **حقيقيّة** — إعادة تقييم `auth.*()` لكل صفّ. |

**أ) مفاتيح خارجيّة بلا فهرس (P2 — أصلحها قبل الجذب):**
- `automation_runs.automation_id` → `automation_runs_automation_id_fkey`
- `loyalty_ledger.order_id` → `loyalty_ledger_order_id_fkey`
- `loyalty_ledger.store_id` → `loyalty_ledger_store_id_fkey`
- `order_events.actor_id` → `order_events_actor_id_fkey`
- `products.section_id` → `products_section_id_fkey` ← **الأهمّ**: صفحة المتجر تجلب المنتجات وتجمّعها بالأقسام؛ بلا فهرس على `section_id` بيصير scan لمّا يكبر الكتالوج.

**ب) `auth_rls_initplan` (P2):** جدول `public.business_leaders`، سياسة `business_leaders_submit` — تعيد تقييم `current_setting()`/`auth.*()` لكل صفّ. الحلّ: لفّها بـ `(select auth.<fn>())` مرّة واحدة لكل استعلام.

**ج) سياسات permissive متعدّدة (P2 — إصلاح معماريّ):** 25 جدول عندها زوج سياسات متداخل (admin_all + public_read على نفس الأمر). أبرزها: `store_classes/courses/membership_plans/modules/portfolio/resources/verifications` (5 كلّ وحدة، مضخّم لأنه بيتعدّ لكلّ role)، و`business_leaders` (6)، و`gigs/job_postings/wholesale_products` (3). **الحلّ:** ادمج كلّ زوج بسياسة واحدة بشرط `OR` (admin OR public)، متل ما انعمل بالتوحيدات السابقة (migration 0054). بيقلّل تقييم السياسات للنصّ على كلّ قراءة عامّة.

**د) الفهارس غير المستعمَلة (لا تفعل شيئاً الآن):** 46 فهرس (مثل `stores_featured_idx`, `products_name_trgm`, `bookings_*`, `business_leaders_*`). سببها صفر ترافيك. **لا تحذف** — راجِعها بعد 30 يوم من ترافيك حقيقيّ. حذفها الآن قد يكسر أداء ميزات لسّه ما اشتغلت (بحث trgm، فلاتر featured).

---

## 6) استراتيجيّة التخزين المؤقّت (Caching) — 6/10 ⚠️ (أهمّ قسم)

- **لا يوجد ولا `export const revalidate` / `dynamic` / `runtime`** في كامل `src/app` (تحقّقت بالبحث — صفر نتائج).
- **إيجابيّ:** طبقة البيانات تستعمل `unstable_cache` بشكل مدروس:
  - `getHomeCounts` — `revalidate: 600` (`src/lib/data/home.ts:66`)
  - `getLatestJobs` — `revalidate: 300`
  - `getUsdLbpRate` — `revalidate: 300` + tag `usd_lbp_rate` للإبطال الفوريّ (`src/lib/data/settings.ts:23`)
  - `fetchActiveStores` — `revalidate: 60` + tag `stores` (`src/lib/data/stores.ts:94`)

  هالشي بيخلّي **الصفحة الرئيسيّة** خفيفة على الـ DB. ممتاز.

- **المشكلة الكبرى (P1):** صفحات `store/[id]`, `product/[id]`, `market/[id]`, `category/[slug]`, `hub/academy/[slug]` كلّها تستعمل `createClient()` (server) اللي بيقرأ الكوكيز (`src/lib/supabase/server.ts` → `await cookies()`). قراءة الكوكيز **بتجبر الصفحة تصير dynamic** — يعني كلّ زيارة (حتى من زائر مجهول أو crawler غوغل) بتضرب الـ DB بـ 2-4 استعلامات، بلا أي HTML مخزّن. هالشي:
  - يرفع **TTFB** على أهمّ صفحات الـ SEO.
  - يضرّ **LCP** لزوّار لبنان على شبكات بطيئة.
  - يحمّل الـ DB بلا داعٍ عند أيّ حملة ترافيك.

**التوصية المفصّليّة (P1):** افصل قراءة صفحة المتجر/المنتج العامّة عن الكوكيز:
1. استعمل عميل Supabase **بلا كوكيز** (`createPublicClient` الموجود أصلاً في `src/lib/supabase/public-client.ts`، ومستعمَل بالفعل في `home.ts`/`stores.ts`) داخل `loadStore`/`loadProduct` للبيانات العامّة.
2. لفّ الجلب العامّ بـ `unstable_cache` مع tag لكل متجر (`store:${id}`) و`revalidate` معقول (60-300s).
3. أبقِ الأجزاء الشخصيّة (زرّ المتابعة، «للطلب»…) كـ client islands تجيب حالتها بالبراوزر — تماماً متل `ForYouStrip` الموجود (`page.tsx:87`).

هيدا بيحوّل صفحات المتجر/المنتج من dynamic لكلّ زيارة إلى مخزّنة/ISR فعليّاً = قفزة كبيرة بـ TTFB/LCP وبقابليّة الفهرسة.

---

## 7) حالات التحميل والهيكل العظمي (Loading / Skeletons) — 8/10

15 ملف `loading.tsx` يغطّون أهمّ المسارات العامّة: `(site)/`, `explore`, `store/[id]`, `product/[id]`, `market`, `categories`, `jobs`, `freelance`, `wholesale`, `offers`, `best-sellers`, `search`، بالإضافة للوحات `admin` و`merchant`. ✅ تغطية قويّة تعطي انطباع سرعة (skeleton بدل شاشة فاضية) وتحسّن الـ perceived performance.

**ثغرة (P3):** لا يوجد `loading.tsx` لبعض المسارات مثل `/hub`, `/hub/academy/[slug]`, `/hub/leaders/[slug]`, `/about`, `/pricing`. أضِف skeletons خفيفة للي فيها جلب DB.

---

## 8) سكربتات الطرف الثالث — GTM + Vercel Analytics — 5.5/10 ⚠️

- **GTM (`GTM-M89LK69J`)** محقون **inline في `<head>`** — `src/app/[lang]/layout.tsx:95-100`. رغم أنّ الـ src نفسه `async`، السكربت inline بينفّذ على الـ main thread مبكّراً، وحاوية GTM بتقدر تسحب tags عشوائيّة (بكسل، ريماركتنغ…) بتضرب **TBT** و**LCP**. على كلّ صفحة، لكلّ زائر، من أوّل بايت.
- **Vercel Analytics** (`<Analytics/>` في `layout.tsx:114`) — خفيف نسبيّاً، مقبول.

**التوصيات:**
- **(P2)** انقل GTM لـ `next/script` بـ `strategy="afterInteractive"` بدل الحقن اليدويّ في `<head>`، ليتأجّل بعد التفاعليّة ويخرج من الـ critical path.
- **(P3)** راجِع دوريّاً شو عم يحمّل GTM فعليّاً؛ إذا مجرّد GA4 بسيط، فكّر باستبداله بـ Vercel/Umami لتخفيف الوزن (وأفضل للخصوصيّة، متماشي مع `Permissions-Policy: interest-cohort=()` الموجود بـ `next.config.ts:35`).

---

## 9) proxy.ts — تأثير على كلّ طلب — 6/10

`src/proxy.ts` يشغّل `updateSession()` (تحديث جلسة Supabase) على **كلّ** طلب غير ثابت (`matcher` يستثني `_next|api|s/|*.*` فقط — `proxy.ts:27`). يعني حتى زائر مجهول وcrawler غوغل بياخدوا round-trip auth على كلّ تنقّل.

**التوصية (P3):** استثنِ من `updateSession` المسارات العامّة البحتة اللي ما بتحتاج جلسة (أو خفّف: لا تحدّث الجلسة إذا ما في كوكي جلسة أصلاً). بيقلّل latency الـ TTFB للزوّار المجهولين — وهنّي غالبيّة ترافيك الـ SEO.

---

## 10) جاهزيّة Core Web Vitals وواقع لبنان منخفض النطاق

| المقياس | التقدير | العامل الأساسيّ |
|---|---|---|
| **LCP** | متوسّط ⚠️ | صفحات المتجر/المنتج dynamic (بلا cache) + اللوغو `unoptimized` `priority` + وزن الخطوط. الصفحة الرئيسيّة أفضل (cached + stream). |
| **CLS** | جيّد نسبيّاً | `next/image` بأبعاد محدّدة + skeletons. راقِب تبديل الخطوط (8 أوزان). |
| **INP/TBT** | متوسّط ⚠️ | GTM inline + 142 client component. حسّنه بتأجيل GTM + dynamic للأدوات الثقيلة. |
| **TTFB** | نقطة ضعف ⚠️ | صفحات التفصيل dynamic + `updateSession` على كل طلب. أهمّ إصلاح = تخزين صفحات المتجر/المنتج. |

**واقع لبنان:** شبكات 3G/4G متقطّعة + أجهزة متوسّطة. الأولويّات لهالسياق بالترتيب: (1) خزّن صفحات المتجر/المنتج، (2) قلّل أوزان الخطوط، (3) أجّل GTM، (4) lazy للأدوات الثقيلة. downscale الصور موجود أصلاً وهو أهمّ مكسب لسوق كتير مصوّر.

---

## خطّة العمل حسب الأولويّة

| # | الإصلاح | الملفّ | الأولويّة | الأثر |
|---|---|---|---|---|
| 1 | خزّن صفحات المتجر/المنتج (public client + `unstable_cache` + tags) بدل dynamic | `store/[id]/page.tsx`, `product/[id]/page.tsx`, `market/[id]` | **P1** | LCP/TTFB/DB — الأكبر |
| 2 | أجّل GTM لـ `next/script afterInteractive` | `layout.tsx:95` | **P2** | TBT/LCP |
| 3 | قلّل أوزان الخطوط (16→~4-6 ملف) | `layout.tsx:12-25` | **P2** | بايتات أوّل رسم |
| 4 | `dynamic()` لأدوات QR/barcode/share/story | `hub/*`, `store-share-card`, `product-story-card` | **P2** | حجم bundle |
| 5 | فهارس على 5 FKs (خصوصاً `products.section_id`) | migration جديد | **P2** | استعلامات المتجر مع النموّ |
| 6 | دمج سياسات RLS المتداخلة (25 جدول) | migration جديد | **P2** | CPU لكل قراءة عامّة |
| 7 | لفّ `business_leaders_submit` بـ `(select auth.*())` | migration جديد | **P2** | تقييم RLS لكل صفّ |
| 8 | شيل `unoptimized` عن اللوغو / SVG | `site-header.tsx:44` | **P2** | LCP path |
| 9 | استثنِ المسارات العامّة من `updateSession` | `proxy.ts` | **P3** | TTFB للمجهولين |
| 10 | ترقيم (pagination) لصفحات الإدارة `.limit(500/5000)` | `admin/*`, `campaigns` | **P3** | يكسر مع النموّ فقط |

**لا تفعل:** لا تحذف الـ 46 «unused index» الآن — سببها صفر ترافيك، مش زيادة فعليّة.

**النتيجة: 6.5 / 10** — أساس أداء واعٍ فوق المتوسّط، محجوب بنقطة وحدة حرجة (صفحات SEO ديناميكيّة) + وزن خطوط/GTM قابل للحلّ بسرعة.
