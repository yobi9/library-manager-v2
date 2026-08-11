# fix-loading-state-management-plan — Work Plan

> المرجع: تدقيق المشكلة في `docs/audits/loading-state-issues-audit.md`

## TL;DR (For humans)

**ما ستحصل عليه:** إصلاح وميض رسائل "لا توجد بيانات / لا يوجد محتوى" التي تظهر **أثناء مرحلة التحميل** قبل وصول البيانات الفعلية، في 7 مواضع عبر طبقة العرض (Frontend) فقط.

**المشكلة الجوهرية:** فصل خاطئ بين حالة التحميل وحالة الفراغ — إما استخدام حالة query خاطئة في شرط الفراغ، أو إهمال فحص `isLoading` كلياً في بعض مسارات العرض.

**السبب الجذري الرئيسي (C1):** `useLibraryItems` هو `useInfiniteQuery` لا يُعرّض `isLoading` ولا يستخدم `placeholderData: keepPreviousData`، لذا خلال التحميل الأول أو أي تغيير فلاتر تكون `data` مفقودة → تظهر "لا توجد نتائج".

**ما لن تفعله الخطة:** لا تغيير في الـ Backend أو الـ API contracts أو الـ DB schema أو إضافة مكتبات جديدة. كل الإصلاحات موضعية في 8 ملفات Frontend.

**الجهد:** صغير إلى متوسط — 8 تودوهات، معظمها تغييرات سطر واحد.

**المخاطر:** منخفضة — كل التغييرات مضافة (إضافة حالات تحميل/خطأ) ولا تكسر العقود القائمة. التحقق: البناء + TypeScript + Prettier.

## Scope

### Must have

1. **Todo 1 — `useLibraryItems`: إضافة `placeholderData: keepPreviousData` + `staleTime` + كشف `isLoading/isError/refetch`** في `src/lib/frontend/media-queries.ts` — يقضي على وميض "لا توجد نتائج" عند تغيير الفلاتر والتحميل الأول.
2. **Todo 2 — `library-items-page.tsx`: ربط حارس التحميل باستعلام العناصر + حالة خطأ** — يقضي على وميض "لا توجد نتائج" عند إعادة الزيارة (كاش info فقط).
3. **Todo 3 — `person-detail-page.tsx`: استخدام `isLoading` من `usePersonWorks` في شرط الفراغ** — يزيل وميض "لا توجد أعمال متاحة لهذا الشخص".
4. **Todo 4 — `ItemsControlView.tsx`: إضافة مسار تحميل في `renderTable()`** — يزيل وميض "لا توجد عناصر مطابقة للفلاتر".
5. **Todo 5 — `player-page.tsx`: فرع خطأ مستقل لـ `useVideoCheck`** — يمنع دوران Spinner أبدي عند فشل الفحص.
6. **Todo 6 — `item-detail-page.tsx`: استخدام `isError` من `useSeasonEpisodes`** — يمنع عرض "لا توجد حلقات" عند فشل جلب الموسم.
7. **Todo 7 — `use-scan-events.ts`: الحفاظ على بيانات progress عند حدث `connected`** — يمنع محو لقطة التقدم الأولية عند الاتصال.
8. **Todo 8 — `favorites-slider.tsx`: دمج `isLoading` من `useMediaBatch`** — يمنع عرض قسم المفضلة فارغاً أثناء جلب الـ batch.

### Must NOT have

- لا تعديل في الـ Backend (`src/backend/**`) أو الـ API endpoints أو الـ DB schema.
- لا تغيير في العقود القائمة (أشكال الاستجابة / الأنواع `MediaItem` / `PaginatedResponse`).
- لا إضافة مكتبات أو تبعيات جديدة (يعتمد على `keepPreviousData` الموجود في `@tanstack/react-query` v5.101.4).
- لا إعادة هيكلة للمكونات أو تغيير في الأنماط المعمارية (Flat pages / Feature modules).
- لا تعديل الملفات الصحيحة المذكورة في التقرير (قسم "الملفات الصحيحة").

## Verification strategy

- **بناء**: `npm run build` بدون أخطاء (شرط إلزامي قبل أي commit).
- **TypeScript**: `npx tsc --noEmit` بدون أخطاء.
- **تنسيق**: `npx prettier --check .`
- **فحص يدوي**: زيارة الصفحات التالية والتأكد من اختفاء وميض الرسائل:
  - `/items/[id]` (فلاتر، بحث، تحميل أول، إعادة زيارة خلال 10 دقائق)
  - `/person/[id]` (تأخير استعلام الأعمال)
  - `/admin/items-control` (وضع الجدول + تغيير فلاتر)
  - `/player/[id]` (محاكاة فشل فحص الفيديو)
  - `/itemView/[type]/[id]` (الموسم: تحميل / خطأ)
  - `/admin/libraries` (فتح الصفحة أثناء فحص جارٍ — يجب ألا تظهر "لا توجد عمليات فحص")
  - `/` (شريط المفضلة أثناء جلب الـ batch)

## Execution strategy

الترتيب التنفيذي (مرتب بالاعتماديات والأولوية):

1. **Todo 1 → Todo 2** (معاً — متزوجان: Todo 2 يستخدم مخرجات Todo 1)
2. **Todo 3** (مستقل)
3. **Todo 4** (مستقل)
4. **Todo 5** (مستقل)
5. **Todo 6** (مستقل)
6. **Todo 7** (مستقل)
7. **Todo 8** (مستقل)
8. **بناء وتحقق شامل** في النهاية.

كل تودو يعمل على ملف واحد مستقل، لذا يمكن تنفيذ التودوهات 3–8 بأي ترتيب أو بالتوازي دون تبعيات.

## Todos

### [ ] 1. `useLibraryItems`: placeholderData + staleTime + كشف حالات التحميل/الخطأ

**الملف:** `src/lib/frontend/media-queries.ts`

**المكان:** السطور 1 و 96–139 (دالة `useLibraryItems`)

**التغيير:**
1. تعديل الاستيراد في السطر 1:
   ```ts
   import { useQuery, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
   ```
2. تعديل تفكيك `useInfiniteQuery` (السطر 106):
   ```ts
   const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useInfiniteQuery({
   ```
3. إضافة خيارين داخل الكائن (بعد `enabled: !!libraryId` في السطر 132):
   ```ts
   staleTime: 2 * 60 * 1000,
   placeholderData: keepPreviousData,
   ```
4. تعديل الإرجاع (السطر 138):
   ```ts
   return { allItems, totalCount, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch, fetchNextPage };
   ```

**النتيجة:** `allItems` تحتفظ ببيانات آخر استعلام أثناء التغيير (لا فراغ)، وتظهر حالات التحميل/الخطأ للمستدعي.

---

### [ ] 2. `library-items-page.tsx`: ربط حارس التحميل بالعناصر + حالة خطأ

**الملف:** `src/features/viewer/pages/library-items-page.tsx`

**المكان:** السطور 45–48، 102–116، 118–131، 168–169

**التغيير:**
1. تفكيك الحالات الجديدة من `useLibraryItems` (السطور 45–48):
   ```ts
   const { allItems, totalCount, hasNextPage, isFetchingNextPage, isLoading: itemsLoading, isError: itemsError, error: itemsQueryError, refetch: refetchItems, fetchNextPage } = useLibraryItems(numericId, filters);
   ```
2. حارس الهيكل (السطر 102): إضافة `itemsLoading`:
   ```ts
   if ((isInfoLoading || itemsLoading) && allItems.length === 0) {
   ```
3. إضافة فرع خطأ للعناصر **بعد** حارس الهيكل وقبل فرع خطأ المكتبة (بعد السطر 116):
   ```ts
   if (itemsError && allItems.length === 0) {
     return (
     //  <div className="mx-auto max-w-7xl px-4 py-6"> قبل 
  <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">  //بعد
        // <div className="flex flex-col items-center gap-4 py-20"> قبل:

        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">  //بعد
           <AlertCircle className="h-12 w-12 text-destructive" />
           <p className="text-destructive">فشل تحميل العناصر</p>
           <button type="button" onClick={() => refetchItems()} className="...">
             إعادة المحاولة
           </button>
         </div>
       </div>
     );
   }
   ```
4. شرط الفراغ (السطر 168): إزالة الاعتماد على `isFetchingNextPage`:
   ```ts
   {allItems.length === 0 ? (
     <div className="py-20 text-center text-muted-foreground">لا توجد نتائج</div>
   ) : (
   ```

**ملاحظة:** لأن حارس الهيكل يعيد مبكراً عند `itemsLoading`، الوصول إلى شرط الفراغ يعني أن `itemsLoading === false` — فسيعرض "لا توجد نتائج" فقط عند فراغ حقيقي مؤكد.

---

### [ ] 3. `person-detail-page.tsx`: حالة تحميل الأعمال

**الملف:** `src/features/viewer/pages/person-detail-page.tsx`

**المكان:** السطور 29 و 121

**التغيير:**
1. السطر 29 — التقاط حالة تحميل استعلام الأعمال:
   ```ts
   const { data: works = [], isLoading: worksLoading } = usePersonWorks(id);
   ```
2. السطر 121 — استخدامها بدل `isLoading` (الذي يخص استعلام الشخص):
   ```ts
   {works.length === 0 && !worksLoading && (
     <p className="py-8 text-center text-muted-foreground">لا توجد أعمال متاحة لهذا الشخص</p>
   )}
   ```

---

### [ ] 4. `ItemsControlView.tsx`: مسار تحميل في وضع الجدول

**الملف:** `src/features/admin/components/items-control/ItemsControlView.tsx`

**المكان:** السطور 148–188 (دالة `renderTable`)

**التغيير:** تحويل `renderTable` من تعبير مباشر إلى دالة بفرع تحميل، بموازاة `renderGrid` (السطر 98):
```tsx
const renderTable = () => {
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return <AdminTable ... />;
};
```
(بقية محتوى `AdminTable` كما هو — لا تغيير على العمود أو `emptyMessage`.)

---

### [ ] 5. `player-page.tsx`: فرع خطأ لفحص الفيديو

**الملف:** `src/features/viewer/pages/player-page.tsx`

**المكان:** السطور 22–33

**التغيير:**
1. السطر 23 — تفكيك الخطأ وإعادة المحاولة:
   ```ts
   const { data: videoCheck, isLoading: checkLoading, isError: checkError, refetch: refetchCheck } = useVideoCheck(id);
   ```
2. بعد الحارس الحالي (السطر 27) أضف فرعاً مستقلاً قبل العودة النهائية:
   ```tsx
   if (checkError) {
     return (
       <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
         <AlertCircle className="h-12 w-12" />
         <p>فشل التحقق من الفيديو</p>
         <button type="button" onClick={() => refetchCheck()} className="...">
           إعادة المحاولة
         </button>
       </div>
     );
   }
   ```

---

### [ ] 6. `item-detail-page.tsx`: استخدام `isError` من الموسم

**الملف:** `src/features/viewer/pages/item-detail-page.tsx`

**المكان:** السطور 115 و 135–143

**التغيير:**
1. السطر 115 — تفكيك `isError`:
   ```ts
   const { data: episodes, seasonTitle, isLoading, isError } = useSeasonEpisodes(selectedSeasonId);
   ```
2. بعد كتلة `isLoading` (السطر 135–140) وقبل شرط الفراغ (السطر 141)، أضف:
   ```tsx
   : isError ? (
     <p className="text-destructive py-8 text-center">تعذر تحميل الحلقات</p>
   )
   ```
   (مع تعديل السلسلة الشرطية لتصبح `isLoading ? ... : isError ? ... : episodes.length === 0 ? ...`.)

---

### [ ] 7. `use-scan-events.ts`: الحفاظ على بيانات progress عند `connected`

**الملف:** `src/features/admin/hooks/use-scan-events.ts`

**المكان:** السطور 59–61

**المشكلة:** الخادم يرسل لقطة `progress` أولية (سطر 67 في `src/app/api/scan-events/route.ts`) ثم `connected`، لكن معالج `connected` يمحو اللقطة بضبط `data: undefined`.

**التغيير:**
```ts
es.addEventListener("connected", () => {
  setState((prev) => ({ ...prev, isLoading: false, error: null }));
});
```
(الحفاظ على `data` القادمة من حدث `progress` الأول، وعدم محوها.)

---

### [ ] 8. `favorites-slider.tsx`: دمج تحميل الـ batch

**الملف:** `src/features/viewer/components/home/favorites-slider.tsx`

**المكان:** السطور 13 و 32

**التغيير:**
1. السطر 13 — التقاط تحميل الـ batch:
   ```ts
   const { data: batchItems = [], isLoading: batchLoading } = useMediaBatch(favorites);
   ```
2. السطر 32 — دمجه مع تحميل سياق المفضلة:
   ```tsx
   isLoading={loading || batchLoading}
   ```

---

## تعريف الإنجاز (Definition of Done)

- [ ] كل التودوهات 1–8 منفذة حسب المواصفات أعلاه.
- [ ] `npm run build` ناجح.
- [ ] `npx tsc --noEmit` نظيف.
- [ ] `npx prettier --check .` نظيف.
- [ ] الفحص اليدوي يؤكد اختفاء وميض الرسائل في المواضع السبعة.
