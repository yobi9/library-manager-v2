# fix-library-hierarchy-and-seasons - Work Plan

> ✅ **Completed** — خطة العمل اكتملت ونُفذت. هذا المستند محفوظ كسجل للمهمة فقط.

## TL;DR (For humans)

**ما ستحصل عليه:** إصلاح مشكلتين:

1. **خرق الهرمية** — صفحة المكتبة (`/items/[id]`) كانت تعرض العناصر الأبناء (مواسم، حلقات) مع العناصر الجذرية. الآن ستعرض فقط العناصر الجذرية (`parent_media_id IS NULL`).
2. **المواسم تظهر** — صفحة تفاصيل الأيتم (`/itemView/[type]/[id]`) لم تكن تعرض المواسم لأن `getMediaById` لم يكن يجلب `children`. الآن ستظهر أزرار المواسم أسفل التفاصيل، مع إمكانية النقر لعرض الحلقات.

**لماذا هذا المنهج:** كلا الإصلاحين بسيطان ومحددان في الـ Backend فقط. الـ Frontend يرسل البيانات الصحيحة (`rootOnly: "true"` في الطلب الأول، وقراءة `media.children` في الثاني)، لكن الـ Backend لا يستجيب.

**ما لن تفعله الخطة:** لا تغيير في واجهة المستخدم أو الـ API contracts أو الـ DB schema.

**الجهد: صغير** — ملفان فقط (Repository + Service).

**المخاطر: منخفضة** — التغييرات مضافة (إضافة `rootOnly` للفلتر، إضافة `children` للاستجابة) ولا تؤثر على الوظائف الحالية.

## Scope

### Must have

1. **Todo 1 — إضافة فلتر `rootOnly` في `MediaRepository.getLibraryMediaFiltered()`**: إضافة `rootOnly?: boolean` إلى `options` مع `AND m.parent_media_id IS NULL` عندما `rootOnly === true`
2. **Todo 2 — تضمين `children` في `MediaService.getMediaById()`**: بعد جلب الـ media item، جلب أطفاله (حيث `parent_media_id = id`) باستخدام `mediaRepo.getMediaChildren()` وتضمينهم في الاستجابة تحت مفتاح `children`
3. **Todo 3 — بناء وتحقق**: `npm run build` والتأكد من عدم وجود أخطاء TypeScript

### Must NOT have

- لا تعديل في واجهة المستخدم أو الـ UI components
- لا تغيير في قاعدة البيانات (DB schema)
- لا إعادة هيكلة للـ API endpoints
- لا تغيير في `item-detail-page.tsx` أو `library-items-page.tsx` أو `media-queries.ts` — التغيير فقط في Backend

## Verification strategy

- **بناء**: `npm run build` بدون أخطاء
- **TypeScript**: `npx tsc --noEmit` بدون أخطاء
- **فحص الكود يدوي**: التأكد من صحة الـ TSDoc والمنطق

## Execution strategy

1. **Todo 1 → Todo 2 → Todo 3**: ترتيب تنفيذي — إصلاح الـ Repository أولاً، ثم الـ Service، ثم البناء والتحقق
2. لا توجد تبعيات بين Todo 1 و Todo 2 (يمكن تنفيذهما معاً)

## Todos

- [x] 1. إضافة فلتر `rootOnly` في `MediaRepository.getLibraryMediaFiltered()`

  **الملف**: `src/backend/repositories/media-repository.ts`

  **المكان**: السطور 317–367 (دالة `getLibraryMediaFiltered`)

  **التغيير**:
  1. إضافة `rootOnly?: boolean` إلى نوع `options` (في التوقيع)
  2. بعد بناء `let where` وقبل إضافة الفلاتر الاختيارية، أضف:
     ```ts
     if (options.rootOnly) {
       where += " AND m.parent_media_id IS NULL";
     }
     ```
  3. إضافة **TSDoc** للدالة:
     ```ts
     /**
      * Fetches paginated media items filtered by library ID and optional criteria.
      * When `rootOnly` is true, only root-level items (without a parent) are returned,
      * excluding child items such as seasons and episodes.
      *
      * @param libraryId - The ID of the library to fetch items from.
      * @param options - Filtering, sorting, and pagination options.
      * @param options.rootOnly - If true, only items with `parent_media_id IS NULL` are returned.
      * @param options.year - Filter by production year.
      * @param options.genre - Filter by genre name.
      * @param options.certification - Filter by certification rating.
      * @param options.search - Full-text search on item title.
      * @param options.sortBy - Sort column ("recent" for created_at, otherwise title).
      * @param options.sortOrder - Sort direction ("ASC" or "DESC").
      * @param options.limit - Number of items per page (default: 50).
      * @param options.offset - Number of items to skip (default: 0).
      * @returns An object containing the items array and total count.
      */
     ```

  **قبول**: `rootOnly: true` يضيف `AND m.parent_media_id IS NULL` إلى WHERE. `rootOnly: false` أو `undefined` لا يغير السلوك الحالي.

  **QA سيناريو سعيد**: استدعاء `getLibraryMediaFiltered(1, { rootOnly: true })` ينتج SQL يحتوي على `AND m.parent_media_id IS NULL`.
  **QA سيناريو فشل**: استدعاء `getLibraryMediaFiltered(1, {})` أو `getLibraryMediaFiltered(1, { rootOnly: false })` ينتج SQL بدون هذا الفلتر (سلوك سابق).

  **Commit**: `fix(repo): add rootOnly filter to getLibraryMediaFiltered to exclude child items`

- [x] 2. تضمين `children` في `MediaService.getMediaById()`

  **الملف**: `src/backend/services/media-service.ts`

  **المكان**: السطور 24–35 (دالة `getMediaById`)

  **التغيير**:
  1. بعد `const processed = processMediaItem(media);` وقبل إضافة `library_name`، أضف:
     ```ts
     const children = await this.mediaRepo.getMediaChildren(id);
     processed["children"] = children.map(processMediaItem);
     ```
  2. إضافة **TSDoc** للدالة:
     ```ts
     /**
      * Retrieves a single media item by its ID, including its children (e.g., seasons of a series).
      *
      * @param id - The media item ID.
      * @returns The processed media item with `library_name` and `children` array,
      *          or `null` if not found. Each child is processed through `processMediaItem`.
      */
     ```

  **قبول**: استدعاء `getMediaById(123)` يعيد object بمفتاح `children` (مصفوفة). للـ series، `children` يحتوي على الـ seasons. للـ movie، `children` مصفوفة فارغة. الـ API endpoint `GET /api/media/:id` يعيد `children` في الاستجابة.

  **QA سيناريو سعيد**: `getMediaById(seriesId)` يعيد `{ ... , children: [{ type: "season", ... }, ...] }`.
  **QA سيناريو فشل**: `getMediaById(movieId)` (أي item بدون أبناء) يعيد `{ ... , children: [] }`.
  **QA سيناريو فشل**: `getMediaById(999999)` (غير موجود) يعيد `null` (بدون تغيير).

  **ملاحظة**: دالة `getMediaChildren` موجودة مسبقاً في `media-repository.ts:369-375`.

  **Commit**: `fix(service): include children in getMediaById response for season display`

- [x] 3. بناء وتحقق

  **الخطوات**:
  1. `npm run build` — يجب أن ينجح بدون أخطاء
  2. `npx tsc --noEmit` — يجب أن ينجح بدون أخطاء
  3. التحقق من أن `rootOnly` يمر عبر السلسلة كاملة: Frontend → API Route → Controller → Service → Repository (كل طبقة يجب أن تمرر المعامل)

  **ملاحظة**: الـ API Route (`libraries/[id]/media/route.ts` سطر 13) يقرأ `rootOnly` من query params ويمرره إلى `c.media.getLibraryMedia()`. الـ Controller (`media-controller.ts` سطر 34) يحوله إلى boolean ويمرره إلى `mediaService.getLibraryMedia()`. الـ Service (`media-service.ts` سطر 75) يمرر `options` (بما فيها `rootOnly`) إلى `mediaRepo.getLibraryMediaFiltered()`. كل هذه موجودة بالفعل — التغيير الوحيد المطلوب هو في الـ Repository لاستخدام `rootOnly`.

  **قبول**: `npm run build` ينجح، وكل التعديلات تتوافق مع TypeScript strict.

  **Commit**: `chore: verify build passes after hierarchy and seasons fixes`

## Final verification wave

- [x] F1. **التدقيق الهيكلي** — التحقق من أن جميع الـ todo items تطابق الصيغة `- [ ] N. <title>` وأن جميع الـ final verifiers تطابق `- [ ] F<number>. <title>`.

- [x] F2. **البناء** — `npm run build` يمر بنجاح بدون أخطاء أو تحذيرات TypeScript.

- [x] F3. **مراجعة TSDoc** — جميع الدوال المعدلة (`getLibraryMediaFiltered` و `getMediaById`) تحتوي على TSDoc كامل يصف الـ params، الـ return type، والغرض المنطقي.

- [x] F4. **التحقق من تدفق البيانات** — `rootOnly` يمر عبر السلسلة كاملة front→back دون انقطاع: API Route → Controller → Service → Repository، و `children` يُضمّن في استجابة `getMediaById`.

## Commit strategy

1 commit لكل Todo (3 commits)، أو دمج Todo 1 + 2 في commit واحد ثم 3 منفصل. الترتيب المقترح:

```
fix(repo): add rootOnly filter to getLibraryMediaFiltered to exclude child items
fix(service): include children in getMediaById response for season display
chore: verify build passes after hierarchy and seasons fixes
```

## Success criteria

1. صفحة المكتبة (`/items/[id]`) تعرض فقط العناصر الجذرية (بدون مواسم وحلقات)
2. صفحة تفاصيل الأيتم (`/itemView/[type]/[id]`) تعرض أزرار المواسم للـ series
3. النقر على موسم يعرض الحلقات الخاصة به
4. لا يوجد أخطاء في الـ build
5. جميع الدوال المعدلة موثقة بـ TSDoc
