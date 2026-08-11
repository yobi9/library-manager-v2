# Loading State Issues Audit

> **النوع:** Audit Report (تحقيق قراءة فقط — لم يتم إجراء أي تعديل)
>
> **التاريخ:** 2026-08-03
>
> **النطاق:** استقصاء سبب ظهور رسائل "لا يوجد محتوى" / "لا توجد بيانات" أثناء مرحلة التحميل قبل وصول البيانات الفعلية في صفحات الـ Viewer والـ Admin.
>
> **المنهجية:** تتبع كامل لتدفق البيانات لكل صفحة متأثرة (Page → Hook → React Query → API Client → Route → Controller → Service → Repository → DB)، مع التحقق من فصل الحالات (Loading / Empty / Error / Success)، وإعدادات React Query (enabled / placeholderData / staleTime / query keys / refetch)، وتطابق عقد الواجهة الأمامية مع استجابة الـ API.

## الملخص التنفيذي

النمط المتكرر عبر جميع المشاكل المكتشفة هو **فصل خاطئ بين حالة التحميل وحالة الفراغ**:

1. **C1 / H1** — شرط الفراغ يستخدم حالة تحميل استعلامٍ آخر (وليس استعلام البيانات المعروضة نفسها).
2. **H2 / M1 / M2** — حالة التحميل/الخطأ مهملة كلياً في بعض مسارات العرض.
3. **L1 / L2** — حالات تحميل غير ملتقطة لتدفقات بيانات ثانوية (SSE / batch).

السبب الجذري المنهجي: `useLibraryItems` (المصدر الأساسي للعناصر في صفحة المكتبة) هو `useInfiniteQuery` لا يُعرّض `isLoading` ولا يستخدم `placeholderData: keepPreviousData`، مما يجعل **الـ data مفقودة (undefined) خلال التحميل الأول وأي تغيير فلاتر**.

ملاحظة تحقق: عقد الواجهة سليم — `fetchLibraryMedia` يفك غلاف الاستجابة عبر `apiClient` (`json.data`) وتوافقه مع `getLibraryMedia` الخلفية (`{ library, items, pagination }`) مؤكد. المشاكل كلها في طبقة العرض (Frontend) ولا تمسّ الـ Backend أو الـ API contracts أو الـ DB schema.

---

## 🔴 Critical

### C1 — صفحة عناصر المكتبة: وميض "لا توجد نتائج" أثناء كل تحميل / تغيير فلاتر

**الملفات:**
- `src/features/viewer/pages/library-items-page.tsx`
- `src/lib/frontend/media-queries.ts` (دالة `useLibraryItems`)

**Root Cause:**
- حارس الهيكل (Skeleton) مرتبط بـ `isInfoLoading` (تحميل معلومات المكتبة) وليس بحالة تحميل استعلام العناصر نفسه:
  - `library-items-page.tsx:102` → `if (isInfoLoading && allItems.length === 0)`
- شرط الفراغ يعتمد على `isFetchingNextPage` الذي يكون **false أثناء التحميل الأول** (يصح فقط عند جلب صفحات لاحقة):
  - `library-items-page.tsx:168-169` → `allItems.length === 0 && !isFetchingNextPage ? "لا توجد نتائج"`
- `useLibraryItems` (`media-queries.ts:96-139`) هو `useInfiniteQuery`:
  - `staleTime` غير مضبوط (0 افتراضياً) — عكس `useLibraryInfo` التي تملك `staleTime: 10min`.
  - بلا `placeholderData: keepPreviousData` → عند تغيير `queryKey` أو غياب الكاش، تصبح `data` هي `undefined` و`allItems = []` (سطر 135).
  - يُعرّض فقط `isFetchingNextPage` ولا يُعرّض `isLoading` / `isFetching` (سطر 138).

**Evidence:**
- `useLibraryInfo` لها `staleTime: 10 * 60 * 1000` (`media-queries.ts:91`). عند إعادة الزيارة خلال 10 دقائق، الـ info يُقرأ من الكاش فوراً (`isInfoLoading = false`) بينما استعلام العناصر بلا كاش → `allItems = []` → الحارس في سطر 102 يسقط والشرط في سطر 168 يمرّر → وميض "لا توجد نتائج" لكامل مدة جلب العناصر.
- أي تغيير في search / genre / year / certification يغيّر `queryKey` (مع debounce 600ms في `library-items-page.tsx:40-43`) → استعلام جديد بلا كاش → وميض كامل لرسالة الفراغ عند كل تفاعل فلاتر.
- لا يوجد أي معالجة خطأ لاستعلام العناصر: عند فشل الجلب، تبقى الصفحة تعرض "لا توجد نتائج" بشكل مضلل (يشبه عدم وجود بيانات حقيقية).

**Recommended Fix:**
- في `useLibraryItems`:
  - إضافة `placeholderData: keepPreviousData` من `@tanstack/react-query` (v5).
  - إعادة `isLoading` و `isFetching` من `useInfiniteQuery` إلى المستدعي.
  - إضافة `staleTime` معقول (مثلاً `2min`) لتقليل إعادة الجلب عند إعادة الزيارة.
- في الصفحة:
  - Skeleton عند `isInfoLoading || itemsLoading`.
  - حالة خطأ مستقلة لاستعلام العناصر (رسالة + زر إعادة المحاولة).
  - شرط الفراغ عند `!itemsLoading` فقط (دون الاعتماد على `!isFetchingNextPage`).

---

## 🟠 High

### H1 — صفحة الشخص: وميض "لا توجد أعمال متاحة لهذا الشخص"

**الملف:** `src/features/viewer/pages/person-detail-page.tsx`

**Root Cause:**
- حالة التحميل في شرط الفراغ مأخوذة من استعلام الشخص وليس من استعلام الأعمال:
  - `person-detail-page.tsx:28` → `const { data: person, isLoading, error } = usePerson(id);`
  - `person-detail-page.tsx:29` → `const { data: works = [] } = usePersonWorks(id);` ← لا تُلتقط حالة التحميل
  - `person-detail-page.tsx:121-122` → `works.length === 0 && !isLoading` → "لا توجد أعمال متاحة لهذا الشخص"

**Evidence:**
- كلا الاستعلامين منفصلان (`media-queries.ts:276-291`) بكلا staleTime = 5min. عندما يحلّ `usePerson` قبل `usePersonWorks` (الأثقل بسبب الـ join على `media_people`)، يكون `works = []` مع `isLoading = false` → وميض الرسالة حتى يكتمل جلب الأعمال.
- على الزيارات المتكررة: كاش الشخص صالح بينما استعلام الأعمال منتهي الصلاحية → نفس الوميض.

**Recommended Fix:**
- جلب `isLoading` (مثلاً `worksLoading`) من `usePersonWorks` واستخدامه في الشرط: `works.length === 0 && !worksLoading`.
- اختيارياً: إضافة حالة خطأ منفصلة لاستعلام الأعمال.

### H2 — عناصر التحكم (Admin): وميض "لا توجد عناصر مطابقة للفلاتر"

**الملف:** `src/features/admin/components/items-control/ItemsControlView.tsx`

**Root Cause:**
- وضع الجدول لا يفحص `isLoading` بينما وضع الشبكة يفحصه:
  - `ItemsControlView.tsx:98` → `renderGrid()` يفحص `if (isLoading)` ويعرض شبكة Skeleton ✔
  - `ItemsControlView.tsx:148-188` → `renderTable()` يمرّر `data={items}` مباشرة إلى `AdminTable` مع `emptyMessage="لا توجد عناصر مطابقة للفلاتر"` (سطر 188) ✘

**Evidence:**
- أثناء التحميل الأول أو تغيير فلاتر البحث، يكون `items = []` مع `isLoading = true` → `AdminTable` يعرض رسالة الفراغ الخاطئة بدل حالة التحميل.

**Recommended Fix:**
- في `renderTable()`: إضافة مسار لـ `isLoading` (صفوف Skeleton أو خلية "جار التحميل...") قبل تمرير `data` إلى `AdminTable`، بموازاة ما تفعله `renderGrid()`.

---

## 🟡 Medium

### M1 — صفحة المشغّل: دوران أبدي عند فشل فحص الفيديو

**الملف:** `src/features/viewer/pages/player-page.tsx`

**Root Cause:**
- `player-page.tsx:27` → `if (isLoading || checkLoading || !videoCheck)` بلا فرع مستقل للخطأ. إذا فشل استعلام `useVideoCheck`، يبقى `videoCheck` غير محدد للأبد → Spinner دائم.

**Evidence:**
- الصفحة كلها (63 سطراً) لا تفحص `isError` إطلاقاً، بينما `useVideoCheck` يُعرّض `error` (`media-queries.ts:240-251`).

**Recommended Fix:**
- بعد اكتمال `isLoading || checkLoading`، أضف فرع خطأ يعرض رسالة (مثلاً "فشل التحقق من الفيديو") مع زر "إعادة المحاولة" يستدعي `refetch`.

### M2 — تفاصيل العنصر: فشل جلب الموسم يُعرض كـ "لا توجد حلقات"

**الملفان:**
- `src/lib/frontend/use-season-episodes.ts`
- `src/features/viewer/pages/item-detail-page.tsx`

**Root Cause:**
- `useSeasonEpisodes` يُعرّض `isError` (`use-season-episodes.ts:25`) لكن المستدعي لا يستخدمه:
  - `item-detail-page.tsx:115` → `const { data: episodes, seasonTitle, isLoading } = useSeasonEpisodes(...)`
  - `item-detail-page.tsx:141-142` → عند `episodes.length === 0` يعرض "لا توجد حلقات"

**Evidence:**
- عند فشل `useMediaById(seasonId)` يصبح `seasonData = undefined` → `episodes = []` مع `isLoading = false` → الخطأ يُخلط مع الفراغ ويُعرض نص مضلل.

**Recommended Fix:**
- تفكيك `isError` من الـ hook وعرض رسالة خطأ منفصلة قبل شرط الفراغ.

---

## 🟢 Low

### L1 — شريط تقدم الفحص: "لا توجد عمليات فحص" أثناء الاتصال بـ SSE

**الملفان:**
- `src/lib/frontend/use-scan-events.ts`
- `src/features/admin/components/libraries-control/scan-progress.tsx`

**Root Cause:**
- `use-scan-events` يضبط `isLoading: false` عند حدث `"connected"` (قبل وصول أول حدث progress حقيقي)، بينما `ScanProgressCard` (سطور 49-55 تقريباً) يعرض EmptyState عند غياب `progress`.

**Recommended Fix:**
- الاحتفاظ بحالة "جار التحميل" حتى أول progress فعلي، أو عدم عرض البطاقة نهائياً قبل وصول بيانات.

### L2 — شريط المفضلة: قسم فارغ أثناء جلب الـ batch

**الملف:** `src/features/viewer/components/home/favorites-slider.tsx`

**Root Cause:**
- `favorites-slider.tsx:24` و`:32` → `isLoading` مأخوذ من `useFavoritesContext` وليس من `useMediaBatch`، بينما العناصر المعروضة (سطر 31) مبنية من بيانات الـ batch (`itemMap`). أثناء جلب الـ batch تُعرض البطاقات فارغة ثم تقفز فجأة عند وصولها.

**Recommended Fix:**
- جلب `isLoading` من `useMediaBatch` ودمجه مع `loading` السياق قبل تمريره إلى `UnifiedMedia`.

---

## الملفات الصحيحة (مرجع: لا تحتاج تعديلاً)

في نطاق التدقيق، تأكدنا أن هذه الملفات تفصل الحالات بشكل صحيح:

| الملف | السبب |
| --- | --- |
| `src/shared/components/layout/listing-page.tsx:40-53` | فصل صحيح: isLoading → error → empty → success |
| `src/features/viewer/pages/watch-later-page.tsx` | `useMediaBatch(ids)` مع `enabled: validIds.length > 0`؛ الفراغ صحيح عند `ids = []` |
| `src/features/admin/pages/dashboard-page.tsx:258-384` | كل الأقسام تحقق `isLoading` وتعرض Skeleton قبل أي بيانات |
| `src/features/admin/components/users/user-detail-modal.tsx:98-158` | الجلسات والنشاط تحققان `sessionsLoading` / `activityLoading` قبل الفراغ |
| `src/features/admin/components/exclusive/exclusive-manager.tsx:132-146` | `isLoading` ← Skeleton، ثم `items.length === 0` ← EmptyState |
| `src/features/viewer/pages/items/[id]/page.tsx` و `src/features/viewer/pages/player/[id]/page.tsx` | صفحات Flat رقيقة (Pattern C) لا تحمل منطق حالة |

## خريطة الحلول المقترحة (ملخص)

| ID | الملفات المتأثرة | نوع الإصلاح | الجهد |
| --- | --- | --- | --- |
| C1 | `library-items-page.tsx` + `media-queries.ts` | placeholderData + كشف isLoading + خطأ + staleTime | متوسط |
| H1 | `person-detail-page.tsx` | جلب worksLoading واستخدامه | صغير |
| H2 | `ItemsControlView.tsx` | إضافة مسار تحميل في renderTable | صغير |
| M1 | `player-page.tsx` | فرع خطأ + إعادة محاولة | صغير |
| M2 | `item-detail-page.tsx` | استخدام isError من الـ hook | صغير |
| L1 | `use-scan-events.ts` / `scan-progress.tsx` | ضبط حالة الاتصال | صغير |
| L2 | `favorites-slider.tsx` | دمج isLoading الـ batch | صغير |

خطة التنفيذ التفصيلية موجودة في: `docs/plans/fix-loading-state-management-plan.md`
