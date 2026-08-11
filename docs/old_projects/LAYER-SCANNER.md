# LAYER-SCANNER — طبقة الماسح الضوئي (Scanner Layer)

> **الغرض:** توثيق طبقة فحص الوسائط (`src/backend/scanner/`) — سير العمل، قواعد
> الهرمية، نظام الـ availability، والمشاكل الجذرية المؤكدة وخطة إصلاحها المعتمدة
> (`docs/availability-root-fix-plan.md`).
> كل ما هنا مثبّت من قراءة الكود الفعلي + الخطة v2 المعتمدة.

---

## 1. الوضع الحالي (Current State)

### الملفات (14 ملفاً)

`scan-orchestrator.ts`، `scan-state.ts`، `scanner-events.ts`، `hierarchy-rules.ts`،
`hierarchy-validator.ts`، `directory-walker.ts`، `media-sync.service.ts`،
`deletion-detector.ts`، `folder-watcher.ts`، `path-validation.service.ts`،
`scan-debug.ts` + المساعدات الداخلية.

### التدفق العام (من قراءة الكود)

```
startScan/scanAll/scanContainer (ScanController)    scan-controller.ts:23-100
   ├─ prepareScan/prepareContainer/prepareScanAll   (حجز متزامن لفتحة الفحص الواحد)
   │     └─ ScanAlreadyRunningError → HTTP 409      (scan-controller.ts:63, 97)
   └─ void runScan / runScanAll                     (fire-and-forget — الطلب يعود 202 فوراً)
        ├─ directory-walker.ts   (تجاوز FS بمحدودية maxDepth: :35, :83)
        ├─ media-sync.service.ts (توليد/تحديث media_items + media_files)
        ├─ deletion-detector.ts  (تعليم المحذوف is_available=0)
        ├─ completeScan          (scan-orchestrator.ts:700-738 — إعادة ضبط is_available=1
        │                          للمزارورين + snapshot + library stats، دفعات 500 بـ AND library_id)
        └─ cleanupOrphanedItems  (scan-orchestrator.ts:773-866 — حذف نهائي عند ENOENT)
```

- **اتصال الكتابة المنفصل (2026-08-09 — P2):** `prepareScan` (`:137-143`) و`runScan`
  (`:237-239`) يلتفّان بـ `runInWriterContext` — كل كتابات الماسح (المشي،
  `completeScan`، `cleanupOrphanedItems`، backfill الفهرس بعد `scan_completed`
  عبر `services/index.ts:201-205`) تجري على **اتصال SQLite مستقل** (راجع
  LAYER-DB). النتيجة: قراءات بقية التطبيق لم تعد تنتظر في قائمة عبارات الماسح
  على الاتصال الواحد.
- **حارس الفحص الواحد** (`scan-orchestrator.ts:66-68, 142-152, 364-374, 469-479`):
  `_activeScanId` يُحجز **متزامناً** قبل أي `await` في `prepareScan`/`prepareContainer`/`prepareScanAll`
  → أي فحص ثانٍ يرمي `ScanAlreadyRunningError` ويردّه الـ controller بـ **409**.
- **فصل prepare/run** (`scan-controller.ts:23-100`): مرحلة الـ prepare تُنتظر
  (فتظهر أخطاء الإعداد كأخطاء حقيقية بدل 202 كاذب)، والـ walk يعمل في الخلفية
  (`void runScan(...)`) ويرجع الطلب **202** فوراً مع التقدم عبر SSE.
- إعادة ضبط المتاح في `completeScan` (`scan-orchestrator.ts:700-738`):
  `UPDATE media_items SET last_scan_id=?, is_available=1, unavailable_since=NULL,
unavailable_reason=NULL WHERE media_id IN (...) AND library_id = ?` — بالدفعات (batchSize=500).
- `updateLibraryStats` (`:741-755`): `media_count = COUNT(*) WHERE parent_media_id IS NULL
AND is_available=1` + `last_scanned`.
- `cleanupOrphanedItems` (`:773-866`): مسح دوري بالدفعات (batchSize=1000, p-limit=50)
  عبر `fs.access(directory_path)`؛ عند ENOENT → **حذف نهائي** (ملفات+عناصر+نسل).
- `getActiveProgress` (`:664-677`): «أحدث مسح نشط» بكسر تعادل **`>=`** على
  `startTime` — عند تساوي زمن البدء (نفس المللي ثانية) يفوز الأحدث إدراجاً
  (الطفل) بدل بقاء الأب.
- `deletion-detector.ts` (أُعيدت كتابته 2026-08-09): يعلّم `is_available=0` +
  `unavailable_since=COALESCE(..., CURRENT_TIMESTAMP)` + `unavailable_reason=
'path_not_found_during_scan'` + `last_seen_path=directory_path`، **مع** تحديث مكافئ
  في `media_files` (`unavailable_reason='parent_path_not_found'`).
  - **الاستراتيجية الجديدة:** مطابقة بادئة `LIKE ? ESCAPE '\'` مباشرة على العمود
    المفهرس (`idx_media_items_directory`/`idx_media_files_path`) عبر
    `buildPathPrefixConditions()` (De Morgan: `col NOT LIKE r1% AND ...` — يُعلَّم
    فقط من فشل في كل الجذور المتاحة)، بدل تعبير `LOWER/REPLACE` المعطّل للفهارس
    وبدل جدول `temp_paths` (مُحذف نهائياً). `escapeLikePattern()` يفلت `\ % _`
    حرفياً؛ حارس `directory_path IS NOT NULL` يمنع تعليم الصفوف القديمة بلا مسار.

### قواعد الهرمية (`hierarchy-rules.ts`)

- `libraryTypes`: CONTAINER / SINGLE_FILE / SINGLE_FLAT / HIERARCHICAL (الأعضاء الفعلية
  في `:8-16, :60-111`).
- `relationships` (`:73`): قاعدة الوالد/الولد حسب النوع.
- `maxDepth` (`:92-106`): `series*/music/singer = 10`، `movie/theater = 1`.
- **`leafTypes` (`:107-111`)** — القائمة المعتمدة الوحيدة للورقة القابلة للبث:
  ```
  ['episode','song','movie','theater','book','app','photo',
   'vidsSameFolder','audioSameFolder','imagesSameFolder',
   'booksSameFolder','appsSameFolder']
  ```
  - `isLeaf(type)` (`:275`) = `this.rules.leafTypes.includes(type)`.
  - **`series_sports` ليست ورقة** — حاوية `is_leaf=0` بلا صفوف ملفات شرعاً.
- `validateCreation` (`:115-131+`) يمنع LIBRARY_MISMATCH (الوالد من مكتبة أخرى) ويطابق
  العمق مع maxDepth.
- `hierarchy-validator.ts`: فحص العمق (`:61-67`) والعلاقات (`:107`) من SQL حي.

### أحداث الـ Scanner (Bridge إلى EventBus)

- `services/index.ts:138-145`: `scan:started→scan_started`، `scan:completed→scan_completed`،
  `scan:failed→scan_failed`، `scan:paused`، `scan:resumed`، `scan:stopped`، `scan:error`،
  `scan:item` — يستهلكها `/api/scan-events` (SSE).

---

## 2. المشاكل الجذرية المؤكدة (RC) وخطة إصلاحها

> التفاصيل الكاملة: `docs/availability-root-fix-plan.md` (v2 معتمدة). هنا الملخص
> والمواضع الدقيقة:

| الرمز | المشكلة                                                                                              | المصدر                                                                                                                  | المرحلة         |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| RC-1  | فشل مؤقت للجذر → كاشف الحذف يعلّم كل ما تحته `is_available=0` بلا تمييز؛ الاستعادة دفعة واحدة لاحقاً | scan-orchestrator.ts:117-122 + path-validation.service.ts:45-52 + deletion-detector.ts:35-48 + scan-orchestrator.ts:323 | 3               |
| RC-2  | `hasContent` يقبل أي مدخل (`folder.jpg`) → مجلد بوستر يُفهرس فيلماً متاحاً بلا ملفات                 | directory-walker.ts:99-101 + media-sync.service.ts:102-116                                                              | 2               |
| RC-3  | المسح السريع لا يُنشئ صف ملف الفيلم الناقص → فيلم يتيم حتى مسح عميق                                  | media-sync.service.ts:163-179                                                                                           | 1               |
| RC-4  | LibraryMonitor يبث أحداثاً **بلا مشترك** وبلا تشغيل تلقائي                                            | folder-watcher.ts:66-69 + watcher/route.ts:20-23                                                                        | **خارج النطاق** |
| RC-5  | `getStreamInfo` يفحص `files[0]` فقط ويبلع أخطاء fs.stat → «غير متاح» لحظي                            | media-repository.ts:64-70 + media-service.ts:258-284                                                                    | 4               |
| RC-6  | `cleanupOrphanedItems` يحذف نهائياً من مسح واحد عند ENOENT (خطر فقدان)                               | scan-orchestrator.ts:355-413                                                                                            | 5               |

### Invariant المفقود (خطة المرحلة 2)

- لا يوجد كود يفرض «ورقة قابلة للبث متاحة ⇔ لها ≥1 ملف مسجَّل».
- الحل المعتمد: دالة `enforceAvailabilityInvariant(libraryId)` جديدة في
  `scan-orchestrator.ts` تُعلّم اليتامى `is_available=0` بـ `unavailable_reason=
'no_media_files'`.
- **ملاحظة leafTypes (تصحيح إلزامي أثناء التنفيذ):** قائمة `type IN (...)` تُبنى
  **ديناميكياً** من `this.rules.leafTypes` (hierarchy-rules.ts:107-111) — **لا
  hardcoded** ولا منسوخة من قياس اليتامى. `series_sports` **غير** واردة في leafTypes
  (حاوية `is_leaf=0`) ولا تُضم. يبقى `AND is_leaf=1` كطبقة حماية إضافية.
- **موضع الاستدعاء (إلزامي):** بعد `completeScan` (سطر 182) وقبل `state.setCompleted()`
  (سطر 184) — لأن `completeScan` يعيد ضبط المزارورين إلى `is_available=1` (سطر 323).

### ملاحظات إضافية موثقة

- **RC-9 (ميتة):** `forceRescan` يُمرَّر من الـ route/controller لكن
  `ScanOrchestrator.startScan` لا يقرأه (يقرأ `deepScan` فقط، scan-orchestrator.ts:86).
  خارج النطاق — موثَّق فقط.
- **RC-8:** أعلام `_aborted/_paused` مشتركة بين المسحات المتوازية — **مُعالج (2026-08-08)** عبر حارس
  الفحص الواحد (`_activeScanId`): لا يمكن أن يتعايش مسحان متوازيان أصلاً، و`terminateChildSessions()`
  تُنظّف جلسات الأطفال اليتيمة عند إيقاف/إنهاء الفحص الأعلى.
- **إصلاح تفعيل عنصر الحلقة (2026-08-09):** فرع «الملف موجود مسبقاً» في
  `media-sync.service.ts:217-245` كان لا يضيف عنصر الوسائط المالك إلى `visitedMediaIds`
  → `completeScan` يعيد تفعيل الملف ويترك عنصر الحلقة `is_available=0`. أُضيف
  `this.visitedMediaIds.add(existingFile["media_id"])` (سطر 221) — مثبّت بمسح حقيقي
  لمكتبة #31: `items_avail` 564→8266 بعد أن كانت ملفاتها كلها متاحة والـ 7750 تعليم
  خاطئ من كاشف الحذف القديم (الـ 48 المتبقية حذف حقيقي — مسلسل «أهل الغرام»).

---

## 3. العقود المقدمة (Contracts Exposed)

- **المدخلات:** `startScan(libraryId, { deepScan, forceRescan })` من ScanController؛ أو المرحلتان المنفصلتان
  `prepareScan` (يُنتظر — أخطاء الإعداد تُرَدّ كأخطاء حقيقية، أبرزها **409** عند تعارض الفحص الواحد)
  ثم `void runScan` (fire-and-forget).
- **المخرجات:** `{ accepted: true }` (202) — العملية غير متزامنة؛ **409** `{ success: false, message }`
  عند وجود فحص نشط (التعارض يُكشف متزامناً قبل بدء الـ walk).
- **الأحداث:** أسماء `scan_*` عبر EventBus (راجع §1) — عقد للـ SSE واللوحات.
- **قاعدة البيانات:** يكتب في `media_items`/`media_files`/`library_snapshots` فقط عبر
  `getDatabase()` + `RetryManager` (الأعمدة `is_available/unavailable_since/
unavailable_reason/last_seen_path/is_leaf` — راجع LAYER-DB) — وكل كتابات المسح
  تعمل على **اتصال الكتابة المنفصل** عبر `runInWriterContext`.

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. **لا ملفات Service جديدة** — خطة v2 تعمل داخل المكونات الموجودة فقط.
2. **لا معرفات مكتبات ثابتة** — كل عمليات الفحص بالمعرّف الوارد.
3. المراحل متسلسلة (1←2←3←4←5): لا تبدأ 2 قبل 1، ولا 5 قبل 3.
4. أي تغيير في `leafTypes` يجب أن يحدّث `enforceAvailabilityInvariant` تلقائياً
   (ديناميكي، لا hardcoded).
5. بعد اكتمال التنفيذ: مسح عميق شامل يدوي + التحقق عبر `/api/media/{id}/check`
   (راجع استراتيجية التحقق في الخطة).
