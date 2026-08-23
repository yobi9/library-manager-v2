# المرحلة 2 — مراجعة `src/lib` (Audit Report)

> **النوع:** Audit Report (تحقيق قراءة فقط — لم يتم إجراء أي تعديل)
>
> **التاريخ:** 2026-08-13
>
> **النطاق:** `src/lib` بالكامل (21 ملفاً) — `config/` (2)، `frontend/` (17)، `utils.ts`، `index.ts`.
> إجمالي ~2,700 سطراً. التحقق من العقود شمل قراءة مسارات `src/app/api` و`MediaController.getRecommendations`.
>
> **المنهجية:** قراءة كل ملف + تتبع كل تصدير عبر grep (المستهلكون الفعليون)، ومقارنة مسارات
> استدعاءات الـ API بالمسارات الفعلية في `src/app/api`، وقراءة جانب من الـ Backend (كمرجع عقد فقط).

## الملخص التنفيذي

`src/lib` هي طبقة التكامل الوحيدة للواجهة (API client + React Query hooks + محولات العرض) —
موثقة جيداً في مواضع (`api-search.ts`، `useVideoCheck`، `shouldUseSecureCookies`، `media-constants.ts`)،
وبلا أي `any` أو تجاوزات أمان.

لكن توجد **مشكلتان منهجيتان**:

1. **نظامان متوازيان لطلب API** بسلوكين مختلفين: `apiClient` (للمشاهِد: يضيف `/api` ويفكّ غلاف `data`)
   مقابل `apiFetch`/`apiPost`/... (لـ hooks الإدارة: بلا إضافة مسار، يُرجع الكائن المغلّف، ويرمي `ApiError`).
2. **موجة كود ميت وتصديرات مكررة** في `translate.ts` و`media-helpers.ts` و`media-queries.ts`
   (10 تصديرات ميتة في `translate.ts` وحدها) + ثوابت معرّفة محلياً في صفحات features بدل استيراد المشترك.

مع **عقد مكسور/هش** في `fetchRecommendations` (تبديل وسائط المسار) يعمل اليوم مصادفةً فقط،
وخطأ عرض محتمل: `song`/`singer` غائبان من جدول الترجمة فيُعرض "محتوى" بدلاً منها.

---

## 🔴 Critical

لا توجد اكتشافات حرجة (لا كشف بيانات، لا كسر كامل لوظيفة).

---

## 🟠 High

### H1 — `fetchRecommendations`: عقد مسار مكسور يعمل مصادفةً

**الملفات:**
- `src/lib/frontend/api-media.ts:364-379` — يبني `/media/recommended/${mediaId}/${libraryId}`.
- `src/app/api/media/recommended/[id]/[type]/route.ts` — المسار الفعلي `[id]` و`[type]`.
- `src/backend/controllers/media-controller.ts:205-218` — يقرأ `id` و`type` من المسار.

**Root Cause:**
- المتغيران معكوسان: قيمة `libraryId` تُرسل في موضع `[type]`، بينما `mediaType` الفعلي يُرسل
  كمعامل استعلام `?type=...` يتجاهله الـ route تماماً (سطر 373 `params.type`).
- `item-detail-page.tsx:195-199` يستدعي `useRecommendations(libraryId, mediaId, media.type)` بالترتيب الصحيح
  منطقياً — الخطأ داخل `fetchRecommendations` عند بناء الرابط.

**لماذا يعمل اليوم (مصادفة):** الـ controller يتجاهل `[type]` في الترشيح ويعيد اشتقاق نوع الوسائط من
سجل الـ media نفسه (`media-controller.ts:211-215`: `type === "all" ? undefined : mediaType`)،
وقيمة `libraryId` الرقمية لا تساوي "all" أبداً.

**المخاطرة:** أي تعديل مستقبلي على الـ controller ليستخدم `[type]` مباشرةً سيكسر صفحة التفاصيل فوراً؛
والعقد الحالي مضلل ولا يعبّر عن النية.

**Recommended Fix:** توحيد العقد من أحد الطرفين:
- (أ) جعل `fetchRecommendations` يبني `/media/recommended/${mediaId}/${mediaType}`، مع تمرير
  `libraryId` كمعامل استعلام إذا احتاجه الـ backend، أو
- (ب) تغيير المسار إلى `/media/recommended/[id]` والاعتماد على استنتاج الـ backend للبقية.

---

### H2 — نظامان متوازيان لطلب الـ API بسلوكين مختلفين

**الملفات:**
- `src/lib/frontend/api-client.ts` (يُستخدم من viewer) — يضيف `/api`، يفكّ غلاف `json.data`، يرمي `Error` عادي.
- `src/lib/frontend/api.ts` (يُستخدم حصرياً من hooks الإدارة: 15 ملفاً `use-admin-*.ts`) — بلا إضافة مسار،
  يُرجع `ApiResponse<T>` المغلّف، يرمي `ApiError` عند `!response.ok` فقط (لا يتحقق من `json.success`).

**Evidence:**
- `apiClient` مستهلكوه: `api-media.ts`, `api-search.ts` (واجهة المشاهدة).
- `apiFetch`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` مستهلكوها: جميع `src/features/admin/hooks/*`.
- فروق سلوكية صريحة: الواجهة التي يعرضها `apiFetch` للواجهة مختلفة تماماً (مغلّف مقابل مفكوك) — أي
  خطأ تحويل بين النظامين أثناء إعادة الاستخدام.

**Recommended Fix:** توحيد على `apiClient` (يفكّ الغلاف معاً)، أو على الأقل إعادة تصدير واحدة للفريقين
مع توثيق الفرق، ثم نقل hooks الإدارة تدريجياً إلى نفس المكوّن — بدون تغيير سلوكي أثناء النقل.

---

### H3 — `translate.ts`: تصديرات ميتة + تكرار ثوابت + خطأ ترجمة `song`/`singer`

**الملف:** `src/lib/frontend/translate.ts`

**3.1 تصديرات بلا أي مستهلك (grep مؤكد):**
- `MEDIA_TYPES` (3-24)، `LIBRARY_TYPES` (26-52)، `getArabicTypeName` (123)، `isArabic` (143)،
  `DEPARTMENT_LABELS` (148)، `SORT_OPTIONS` (161)، `buildYearOptions` (168)، `buildGenreOptions` (175)،
  `formatRelativeDate` (179)، `slugify` (192).

**3.2 تكرار ثوابت معرّفة محلياً بدل الاستيراد من هنا:**
- `SORT_OPTIONS` تُعرَّف محلياً في `src/features/viewer/pages/library-items-page.tsx:20` بنفس القيم.
- `LIBRARY_TYPES` تُعرَّف محلياً في `src/features/admin/components/libraries-control/library-form.tsx:43`.
  (مخالفة SSOT: قائمتان قد تنحرفان عن بعضهما دون أن يلاحظ أحد.)

**3.3 خطأ عرض: `song` و`singer` غائبان من `TYPE_TRANSLATIONS` (79-102)**
- `translateMediaType("song")` → يقع في `return "محتوى"` (سطر 111).
- المستهلكون: `unified-card.tsx:72` (بلا fallback) و`search-modal.tsx:116` و`hero.tsx:95` → ستعرض
  بطاقات الأغاني/المنشدين "محتوى".
- لاحظ: `ARABIC_TYPE_NAMES` فيها `song: "مقطع"` و`singer: "منشد"` (74-75) بينما `TYPE_TRANSLATIONS` لا —
  تناقض داخلي يدعم كونه سهواً.
- `media-card.tsx:195` تخفّي الخطأ عبر fallback `|| type` — ما يجعل السلوك غير موحد بين البطاقات.

**3.4 أثر عمل باقٍ:** تعليق `// === التعديل المطلوب هنا ===` (سطر 66) قبل `music`.

**3.5 فوضى تنسيق:** محاذاة غير متسقة (69، 72-75، 100)، مسافات زائدة (101)، تعليقات توضيحية بالعربية
داخل القيم نفسها (74-75، 98-100).

**Recommended Fix:** حذف التصديرات الميتة؛ توحيد `SORT_OPTIONS`/`LIBRARY_TYPES` على الوارد من `translate.ts`
(بعد التأكد من تطابق القيم الحالية)؛ إضافة `song: "مقطع"` و`singer: "منشد"` إلى `TYPE_TRANSLATIONS`؛
حذف أثر التعديل المتبقي؛ تنظيف التنسيق.

---

### H4 — `media-helpers.ts` يستورد من طبقة features (استيراد تصاعدي + تبعية دائرية)

**الملف:** `src/lib/frontend/media-helpers.ts:2,4`
- `import type { UnifiedCardProps } from "@/features/viewer/components/unified-card/unified-card"`
- `import { isAudioType } from "@/features/viewer/components/audio-player/types"`

**Root Cause:** `lib` يجب ألا يستورد من `features` (التبعيـة تسمح فقط features → lib → shared).
الناتج حلقة دائرية فعلية: `features/viewer` ← `lib/frontend` ← `features/viewer` (مؤكدة بالمسارات أعلاه).

**ملاحظة:** AGENTS.md يعلن مصدر الحقيقة الصوتية في `features/viewer/components/audio-player/types.ts`
(المستورد من هنا) — أي أن الوضع الحالي معترف به لكنه يعكس الاتجاه. الحل الأنظف نقل SSOT الصوتي
(`AUDIO_TYPES`/`isAudioType`/`isAudioType` types) إلى `src/shared/` وجعل `lib` و`features` يستوردانه معاً،
مع الحفاظ على التصدير من الموضع القديم كـ re-export حتى لا تُكسر الاستيرادات الموجودة.

---

### H5 — وسوم عمل باقية في `media-queries.ts` (أثر إصلاح سابق)

**الملف:** `src/lib/frontend/media-queries.ts:143-145, 173, 185-187`
- `isLoading, // ← مستخرج حديثاً`، `isError, // ← مستخرج حديثاً`، `placeholderData: keepPreviousData, // ← إضافة لمنع فقدان البيانات`، `isLoading, // ← جديد`.

**Root Cause:** إصلاحات "وميض لا توجد نتائج" (تحميل/خطأ + keepPreviousData) أُضيفت مع وسوم متابعة
لم تُحذف قبل الالتزام — مخالفة «لا كود ميت/تعليقات عمل».

**Recommended Fix:** حذف وسوم `// ← ...` فقط (السلوك سليم).

---

## 🟡 Moderate

### M1 — `extractGenres`: `JSON.parse` بلا حماية قد يرمي خطأً
**الملف:** `src/lib/frontend/media-helpers.ts:65` — عندما يكون `item.genres` سلسلة غير JSON صالحة
(بيانات قديمة/متضررة) تنكسر الصفحة الكاملة. المستهلكون: `library-items-page.tsx:213`، `item-detail-page.tsx:272`، `hero.tsx:72`، `exclusive-form-modal.tsx:114`.

### M2 — `favorites-context`: حالة `loading` ميتة (دائماً `false`)
**الملف:** `src/lib/frontend/favorites-context.tsx:33` — `useState(false)` ولا يُحدَّث أبداً، بينما
`favorites-slider.tsx:13` يقرأه. أي منطق skeleton معتمد عليه لن يعمل (لا أثر عملياً لكنه مضلل).

### M3 — `useBreadcrumbs`: مسارات حرفية بدل `ROUTES`
**الملف:** `src/lib/frontend/media-queries.ts:205,221` — `"/sections"` و`/sections/${id}` و`/items/${id}`
مكتوبة يدوياً بدل `ROUTES.SECTIONS`/`ROUTES.ITEMS` (مخالفة SSOT).

### M4 — تكرار بناء روابط الصور (media-helpers ↔ image-helpers)
**الملفات:**
- `media-helpers.ts:129,157-158` يبني `/api/images/${numId}?type=poster&w=300&h=450` و`backdrop...` يدوياً.
- `image-helpers.ts` يوفر `getPosterUrl`/`getBackdropUrl` (المستخدمة في `item-detail-page.tsx:267-268`، `album-player-page.tsx:147`، `episode-card.tsx:30`).
- **نتيجة:** وجهتان لبناء نفس الرابط — التعديل على معاملات الصور (مثل تغيير المقاس) لن يطال البطاقات.

### M5 — `fetchMediaBatch`: خطر طول URL
**الملف:** `api-media.ts:417` — `ids.join(",")` في معامل استعلام؛ مع قوائم "شاهدها لاحقاً" الكبيرة قد يتجاوز
حد طول الرابط. (المستهلك: `watch-later-page.tsx` عبر `useMediaBatch`.)

### M6 — مخاطرة التقويم الهجري في `formatRelativeDate`
**الملف:** `translate.ts:184,189` — `toLocaleDateString("ar-SA")` يقع في التقويم الهجري افتراضياً في V8
(نفس تحفظ المرحلة 1). دالة ميتة حالياً لكن إن أُحييت ستعرض تاريخاً هجرياً.

---

## 🟢 Low

### L1 — كود ميت في `image-helpers.ts`
- `getLibraryImageUrl` (58) بلا مستهلكين.
- تلوث أسطر: فراغات 1-2، سطر تعليق مضلل `// في src/lib/frontend/media-helpers.ts` (3)، فراغات 6-11، 27-39، 63-65.
- `getImageUrl` بلا TSDoc (المصدر الأساسي للثلاث دوال المستخدمة).

### L2 — `frontend/index.ts` ملف إعادة تصدير ميت
- `src/lib/frontend/index.ts:1-2` — لا أحد يستورد `@/lib/frontend/index` (grep مؤكد).
- (المقابل `@/lib` بملف `config` وحده مستخدَم فعلاً.)

### L3 — `media-queries.ts`: سلسلة `useMediaByFilter` ميتة
- `useMediaByYear`/`useMediaByGenre`/`useMediaByRating`/`useMediaByCertification` (87-101) +
  `useMediaByFilter` (43) بلا أي مستهلك خارجي (الصفحات تستخدم `useInfiniteMediaByFilter` مباشرة).
- `useMediaTypes`/`fetchMediaTypes` (272/353) بلا مستهلكين.

### L4 — `mapMediaToCard` معامل `layout` غير مستخدم + `mapMediaToDetail` ميت
- `media-helpers.ts:125` — `layout` غير مستخدم في الجسم.
- `mapMediaToDetail` (153) + `formatRating` (97) + `formatCertificationLabel` (106) بلا مستهلكين.

### L5 — `getCorsOrigins` ميت
- `config/env.ts:44` معرّفة ومُعاد تصديرها في `config/index.ts` و`lib/index.ts` — بلا أي مستهلك.
  (المتغير `CORS_ORIGINS` يُتحقق منه في Zod لكنه لا يُستخدم فعلياً في أي طبقة — يحتاج قراراً.)

### L6 — `useSeasonEpisodes`: cast غير ضروري
- `use-season-episodes.ts:16-22` — `as MediaItem & { children?: MediaItem[] }` مع أن `children` و`title`
  معرّفان أصلاً في `MediaItem` (`api-media.ts:56,11`) — cast زائد يخفي النوع.

### L7 — فجوة TSDoc منهجية
- أغلب دوال `api-media.ts` (~20 دالة) و`media-queries.ts` (~18 hook) و`api-client.ts` و`auth-context.tsx`
  و`favorites-*` و`use-watch-later.ts` و`use-season-episodes.ts` و`cn` في `lib/utils.ts` بلا TSDoc.
- نماذج ملتزمة للمقارنة: `useInfiniteMediaByFilter` (59-67)، `useVideoCheck` (302-311)، واجهات `api-search.ts`،
  `media-constants.ts`، `shouldUseSecureCookies` (51-61).

### L8 — `auth-context`/`favorites-context` دوال بلا TSDoc ونمطان مكرران
- `favorites-storage.ts` و`watch-later-storage.ts` متطابقان بنيوياً (مفتاح تخزين مختلف) —
  مكوّن تخزين واحد معمَّم يمكن أن يخدم الاثنين. كما أن `JSON.parse` بلا تحقق من شكل القيمة في كليهما.
- `useAuth`/`useFavoritesContext` ثنائيات Context مكررة بذات الرسالة (مقبولة كنمط).

### L9 — ملاحظات إضافية منقّطة
- `api-client.ts:21` — `res.json()` سيرمي عند استجابة غير JSON (غير متوقع هنا، لكن بلا حماية).
- `api.ts:36` — `apiFetch` لا يتحقق من `json.success` على الاستجابات الناجحة (يعتمد على رموز HTTP).
- `media-constants.ts:16` — سطر فارغ داخل مصفوفة `SERIES_TYPES`.
- `home-page.tsx:6-59` — كتل استيراد معلّقة قديمة (ستُسجَّل في مرحلة صفحات app).

---

## ✅ ملاحظات إيجابية

- **`useVideoCheck`** (media-queries.ts:302-311) — TSDoc كامل يوضح السلوك على "غير قابل للتشغيل" مقابل الخطأ الحقيقي، ويفصل استجابة العمل من الخطأ (نموذج يُقتدى به).
- **`api-search.ts`** — واجهات موثقة بمصدر الحقيقة (SearchService الخلفي) ونطاق كل واجهة.
- **`media-constants.ts`** — يربط القائمة بمصدر الحقيقة الخلفي (`LibraryType`/`ALLOWED_TYPES`) ويعلن اشتقاقه منه.
- **`shouldUseSecureCookies`** — يشتق `Secure` من بروتوكول `NEXT_PUBLIC_APP_URL` (وليس NODE_ENV) ليسمح بالنشر الداخلي عبر HTTP — قرار صحيح لبيئة LAN.
- **`getEnv` مع نمط lazy singleton** — تحقق Zod مركزي عند أول استخدام، مع رسالة خطأ محددة.
- **فصل المتغيرات** — لا `any` صريح، ولا `@ts-ignore`، و`useMediaBatch` يفرز المعرّفات لتوحيد مفاتيح الكاش.
- **`fetchLiveSearch`** — يتسامح مع شكلَي الاستجابة (مغلّف/مباشر) بوعي موثّق.

---

## ما يحتاج تأكيداً

| # | الموضوع | أين |
|---|---------|-----|
| 1 | هل `fetchRecommendations` يقدّم فعلاً توصيات صحيحة النوع في الواجهة اليوم؟ (العقد المكسور في H1) | `api-media.ts:372` + `media-controller.ts:215` |
| 2 | هل تُعرض "محتوى" فعلاً على بطاقات الأغاني/المنشدين في صفحات المكتبات الصوتية؟ | `unified-card.tsx:72`, `search-modal.tsx:116` |
| 3 | هل `CORS_ORIGINS` مطلوب أصلاً؟ (إعدادات CORS غير مستخدمة في أي طبقة) | `config/env.ts:9,44` |
| 4 | تطابق قيم `LIBRARY_TYPES` المحلية في `library-form.tsx:43` مع نسخة `translate.ts` قبل حذف أي منهما | `library-form.tsx:43` vs `translate.ts:26-52` |
| 5 | `api.ts` (admin) مقابل `apiClient` (viewer) — هل هناك نية لتوحيدهما؟ | H2 |

---

## مؤشرات خط الأساس (المرحلة 0)

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` | ✅ 0 أخطاء |
| `npm run lint` | ⚠️ 0 أخطاء / 63 تحذيراً (منها تحذيرات `no-img-element` خارج lib) |
| `npm test` | ✅ 22 ملف / 128 اختبار ناجحاً |
