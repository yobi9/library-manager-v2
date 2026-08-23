# تقرير التحقيق والحل — التصنيفات (genres) لا تظهر في كروت الأيتم

**التاريخ:** 2026-08-13
**النطاق:** تشخيص Root-Cause + الحل الكامل (استعلامات + اختبارات + طبقة مراقبة) — بدون تعديل خارج نطاق المشكلة.
**المصادر:** كود `src/backend` (مسارات الحل كاملة) + كود الواجهة `src/features` / `src/lib` + اختبارات
`src/tests/unit/media-genres-in-lists.test.ts` + تحقق فعلي بالتشغيل (`DEV_CONSOLE=1 DEV_CONSOLE_LEVEL=debug`).

---

## A. الخلاصة التنفيذية

- **المشكلة (REPORTED):** التصنيفات — مثل الرعب/الأكشن وغيرها — **لا تظهر في كروت الأيتم في كل الصفحات**، بينما تظهر بشكل صحيح في صفحة تفاصيل الأيتم بجانب البوستر الرئيسي.
- **توضيح مهم:** «التصنيفات (genres)» **ليست** نوع الميديا (`type`)؛ النوع يُعرض في شارة منفصلة أعلى الكارت. التركيز هنا على حقل `genres` من جدول `media_genres`.
- **سبب الجذر المؤكد (PROVEN):** استعلامات **القوائم** السبعة في `media-repository.ts` كانت ترجع `SELECT m.*` من `media_items` **دون تجميع `media_genres`**، فأي عنصر قائمة يأتي **بدون** حقل `genres` → `extractGenres()` → `[]` → لا تُعرض التصنيفات في أي كارت.
- **سبب نجاح صفحة التفاصيل (PROVEN):** `getMediaById` في `media-service.ts` يبني `genres` كمصفوفة منفصلة عبر `getGenresForMedia` — مسار مستقل عن استعلامات القوائم.
- **الحل (APPLIED):** إضافة `GENRES_SUBQUERY` (`COALESCE((SELECT json_group_array(mg.genre) ...), '[]')`) وحقنها في الاستعلامات السبعة، + اختبار تراجعي (8 حالات)، + طبقة تتبّع مراقبة (`genres-trace`) للتشخيص المستقبلي.
- **التحقق (VERIFIED):** `typecheck` ✓ · `lint` (0 أخطاء) ✓ · `npm test` (137/137، منها 8 اختبارات جديدة) ✓ · `prettier` ✓ · فحص بصري فعلي: **التصنيفات ظهرت** في كروت الصفحات عند التمرير.

---

## B. منهجية التحقيق والأدلة

| المصدر | النوع | الاستخدام |
| --- | --- | --- |
| `src/backend/repositories/media-repository.ts` (السطر 55 + 7 مواقع حقن) | كود | إثبات أن استعلامات القوائم كانت بلا `media_genres`، ثم الحل `GENRES_SUBQUERY` |
| `src/backend/services/media-service.ts:16-24` (`processMediaItem`) | كود | إثبات أن النسخ `{...item}` يُمرّر كل الحقول دون إسقاط |
| `src/backend/services/media-service.ts:72` (`getMediaById`) | كود | إثبات مسار التفاصيل المستقل الذي يبني `genres` كمصفوفة |
| `src/backend/controllers/media-controller.ts` + ملفات المسارات (`/api/media/*`) | كود | إثبات أن المتحكم تمرير صِرف (`this.ok`) وأن كل المسارات تستدعي الطرق المُصلحة |
| `src/lib/frontend/api-media.ts` + `src/lib/frontend/media-queries.ts` | كود | إثبات أن دوال الجلب/الهوكس لا تحذف الحقل وتمرره كما هو |
| `src/lib/frontend/media-helpers.ts:62` (`extractGenres`) و`:125` (`mapMediaToCard`) | كود | طبقة التحويل: نص JSON → مصفوفة قبل الوصول إلى الكارت |
| `src/features/viewer/components/unified-card/unified-card.tsx:134-150` و`media-card.tsx:105-118` | كود | إثبات أن الكارتين يعرضان التصنيفات عند **hover** فقط |
| `src/tests/unit/media-genres-in-lists.test.ts` (8 اختبارات) | اختبار | تراجع تغطّي الاستعلامات السبعة + حالة بلا تصنيفات |
| تشغيل `DEV_CONSOLE=1 DEV_CONSOLE_LEVEL=debug` + فحص بصري | Runtime | تأكيد `media.genres.trace` وظهور التصنيفات في الكروت |

---

## C. التدفق والبنية

```
DB (media_items + media_genres)
  → Repository (7 استعلامات قوائم)   ← ◀◀ الطبقة المُصابـة قبل الحل (لا genres)
  → Service (processMediaItem = spread يحفظ كل الحقول)
  → Controller/API (pass-through عبر this.ok)
  → Hook (react-query ← /api/media/...)
  → mapper (mapMediaToCard → extractGenres: JSON.parse للنص)
  → Card (UnifiedCard / MediaCard → تعرض التصنيفات عند hover)
```

- **مسار التفاصيل (يعمل أصلاً):** `GET /api/media/:id` → `getMediaById` → `genres` كمصفوفة حقيقية → تُعرض بجانب البوستر. وهذا يؤكد أن بيانات `media_genres` موجودة وأن العيب كان محصوراً في استعلامات القوائم.
- **طبقة المراقبة:** `traceGenresHealth` في `media-service.ts` بعد `processMediaItem` في كل طريقة قائمة — تُسجّل `present/missing/empty/malformed` عند مستوى `debug`.

---

## D. السبب الجذري المؤكد (PROVEN)

1. استعلامات القوائم السبعة كانت `SELECT m.*` من `media_items` بلا أي انضمام/تجميع لجدول `media_genres`.
2. النتيجة: كل عنصر قائمة يصل بحقل `genres` **مفقوداً** (`undefined`).
3. على الواجهة: `extractGenres(item)` (`media-helpers.ts:63`) يبدأ بـ `if (!item.genres) return [];` → يعيد مصفوفة فارغة.
4. الكارتان تشرطان `genresList.length > 0` (UnifiedCard) / `genres.length > 0` (MediaCard) قبل العرض → لا شيء يُعرض.
5. صفحة التفاصيل كانت تعمل لأن `getMediaById` يبني `genres` من مسار مستقل (`getGenresForMedia`).

**الطبقات السليمة (لم تكن سبباً):** الخدمة (`processMediaItem` = spread)، المتحكم/المسارات (تمرير صِرف)، الواجهة (mapper والكارتان تتعاملان مع النص JSON ومصفوفة معاً عبر `extractGenres`).

---

## E. الحل (APPLIED)

### 1. استعلامات القوائم — `src/backend/repositories/media-repository.ts`
- **السطر 55:** ثابت جديد:
  ```sql
  COALESCE((SELECT json_group_array(mg.genre) FROM media_genres mg WHERE mg.media_id = m.media_id), '[]') AS genres
  ```
  (اختيار `json_group_array` عمداً — الناتج نص JSON صالح يستهلكه `extractGenres` بـ `JSON.parse`؛ بدل `GROUP_CONCAT` الذي ينتج نصاً غير قابل للتحليل كـ JSON).
- **الحقن في 7 استعلامات** (كلها `SELECT m.*, <GENRES_SUBQUERY>`):

| الأسلوب | السطر |
| --- | --- |
| `getPinnedItems` | 346 |
| `getLatestMedia` (كل/بنوع) | 357 / 365 |
| `getRecommendations` | 402 |
| `batchGetByIds` | 420 |
| `getLibraryMediaFiltered` | 501 |
| `getPersonWorks` | 597 |
| `getMediaByFilter` | 779 |

- **لم تُلمس** `searchMedia` (311/322): تخدم قائمة البحث المنسدلة (`/api/search/live`) وليست كروتاً — بقاؤها بلا genres مقصود.

### 2. اختبار تراجعي — `src/tests/unit/media-genres-in-lists.test.ts` (8 حالات)
يغطي: `getLatestMedia`، `getLibraryMediaFiltered` (+ فلتر `genre`)، `batchGetByIds`، `getPinnedItems`، `getRecommendations`، `getPersonWorks`، `getMediaByFilter`، وعنصر بلا تصنيفات يعود `'[]'`.

---

## F. طبقة المراقبة (جديدة) — تشخيص «أي طبقة» مستقبلاً

- **`src/backend/observability/genres-trace.ts`** (جديد):
  - `genresHealth(items)` → إحصاء `total / present / missing / empty / malformed`.
  - `traceGenresHealth(source, items)` → `logger.debug("media.genres.trace", {...})` مع **early-return** عند تعطيل اللوجر (صفر أثر في الإنتاج).
- **`src/backend/observability/index.ts`:** تصدير الدالتين + النوع `GenresHealth`.
- **`src/backend/services/media-service.ts`:** 7 نقاط استدعاء بعد `processMediaItem` — `getMediaBatch`، `getLibraryMedia`، `getLatestItems`، `getPinnedItems`، `getRecommendations`، `getMediaByFilter`، `getPersonWorks`.

### كيف نقرأ النتائج
```
DEV_CONSOLE=1 DEV_CONSOLE_LEVEL=debug npm run dev
```
- `present=N, missing=0` → الباكند يسلم `genres` سليماً → الخلل (لو حصل) محصور في الواجهة (mapper/card).
- `missing=N` → الاستعلام/الخدمة لا يسلّمان الحقل.
- `malformed=N` → الحقل يصل بتشكيل لا يوزعه `extractGenres`.

---

## G. التحقق (VERIFIED)

| الفحص | النتيجة |
| --- | --- |
| `npm run typecheck` | ✓ |
| `npm run lint` (المجلدات المعدلة) | ✓ 0 أخطاء — تحذير `processedItems` سابق الوجود في `getMediaByFilter` لم يُلمس حفاظاً على سلوك النسخ enriched→poster |
| `npm test` | ✓ 137/137 (منها 8 اختبارات genres الجديدة) |
| `npx prettier --check` على الملفات المعدلة | ✓ |
| فحص بصري فعلي | ✓ التصنيفات ظهرت في كروت الصفحات عند التمرير |

---

## H. ملاحظات ومخاطر

1. **الكاش (60 ثانية):** قوائم `CachePrefixes.media` مخزنة في الذاكرة بـ TTL 60s — بعد أي نشر يجب **إعادة تشغيل الخادم** لتُبنى القوائم بالصيغة الجديدة؛ وإلا تبقى قوائم قديمة بلا `genres` حتى انتهاء TTL/الإبطال.
2. **سلايدر المواسم** في صفحة التفاصيل (`item-detail-page.tsx:503`) يبني `UnifiedCard` يدوياً بدون `genres` — المواسم عادةً لا تحمل تصنيفات، وخارج نطاق هذا التقرير.
3. **`getMediaByFilter`** في الخدمة يحوي متغير `processedItems` غير مستخدم مع تأثير جانبي (نسخ enriched→poster عبر طفرات على كائنات `result.items`) — سابق الوجود ويعمل، لم يُعدَّ بناؤه في هذا الحل.
4. **سلوك العرض:** التصنيفات تظهر عند **hover** فقط (حسب اختيار المستخدم سابقاً) — في `UnifiedCard` أول 2 + `+N`، وفي `MediaCard` أول 4 + `+N`.
5. **التصنيفات ≠ نوع الميديا:** لا توجد أي علاقة بين هذا الحل وشارة النوع؛ النوع (`type`) معروض في مسار منفصل ولم يتغير.
