# تدقيق عميق — طبقة وخدمة إثراء البيانات الوصفية (Metadata Enrichment)

> **التاريخ**: 2026-08-12
> **الطبيعة**: قراءة وتحليل فقط. لم يُعدَّل أي ملف أثناء التدقيق. كل الاستشهادات تشير إلى `file:line` مطابقة للكود الفعلي المُقرأ أو لتجربة runtime موثقة.
> **وسوم الحالات**: **مؤكد** = مثبت من الكود أو بتجربة؛ **يحتاج تحقق** = متعدد التفسير/يتطلب تشغيلاً.

---

## A. Architecture الحالية (المُثبتة فعلياً)

```
Trigger (يدوي فقط — لا يوجد إثراء تلقائي)
  ├── POST /api/enrich/item/[id]           ← UI items-control (عنصر واحد)
  ├── POST /api/enrich/batch               ← UI items-control (تحديد)
  ├── POST /api/enrich/by-filter           ← UI items-control (الكل/الفراغ)
  ├── POST /api/enrich/approve|[approvalId] و pending-approve-all  ← PendingApprovalsPanel
  ├── POST /api/enrich/metadata/[id]       ← ItemManagementDialog (تعديل يدوي — معطّل، انظر C3)
  ├── POST /api/enrich/upload-image        ← UI (تنزيل صورة من رابط)
  └── POST /api/enrich/reset/[id]          ← UI (إعادة ضبط)
        ↓  (كلها requireAdmin)
EnrichmentController (enrichment-controller.ts)
  ├── sessions: Map في الذاكرة + تقدم عبر SSE (getEventBus().emit("enrichment_progress") سطر 55)
  ├── setImmediate / نداء خلفي لـ enrichBatch
        ↓
TmdbEnrichmentService extends EventEmitter (tmdb-enrichment-service.ts)
  ├── _searchTMDB: /search/{movie|tv} → Jaccard+length similarity، عتبات 0.65/0.8
  │     └── fallback: /discover/{movie|tv} بالعام (فقط عندما results==0)
  ├── _fetchFromTmdb ×2 (ar + en, append_to_response=credits) — لا client منفصل
  ├── _applyEnrichmentFromDetails:
  │     ├── updateData (13 حقلاً) → _filterUpdateData (PRAGMA table_info cached) → mediaRepo.update
  │     ├── refreshEnrichmentStatus
  │     ├── saveGenres (DELETE+INSERT، مترجمة)
  │     ├── savePeople (DELETE+INSERT)
  │     ├── saveProductionCompanies (عمود نصي)
  │     ├── updateCreditsSyncTime
  │     └── emit media:changed (this + EventBus) — بدون إبطال كاش (انظر C1/H2)
  ├── approval flow: createApproval → approveEnrichment → _applyEnrichmentFromDetails + updateStatus
        ↓
Repositories: EnrichmentMediaRepository، EnrichmentApprovalRepository، MediaRepository، ActivityRepository
        ↓
SQLite: media_items، media_genres، media_people، media_search (FTS5 via trigger)، pending_enrichment_approvals، activities، settings
        ↓
Events (نظامان):
  ├── EventEmitter الخاص بالخدمة (this.emit)
  └── EventBus → CacheInvalidator + /api/admin/events (SSE) + scan_completed backfill
        ↓
Consumers:
  ├── CacheInvalidator (media_updated/media_deleted/metadata_completed/scan_completed)
  └── useAdminRealtimeEvents (mediaVersion) + events-page (refetch مُخزَّنة)
```

**ملاحظات أساسية:**
- البداية **يدوية فقط**: لا يوجد أي مسار يقود من الماسح/الجدولة إلى الإثراء (`grep` لم يجد أي استدعاء خارج الـ Controller). إعداد `deep_scan_enabled` يخص الماسح (`scan-orchestrator.ts:1151`) ولا علاقة له بالإثراء.
- "TMDB Client" **غير موجود كطبقة**: اتصال مباشر بـ `fetch` داخل الخدمة (`_fetchFromTmdb`، سطر 151) بلا timeout/abort/retry.
- التدفق Service → Repository مباشرة، مع قفزة لكسر الطبقات: `searchTmdb` في الـ Controller يصل لدالة خاصة `_searchTMDB` عبر `as unknown as` (`enrichment-controller.ts:151`).
- الكاش/الإبطال **غير متصل بالخدمة فعلياً** رغم تعليق `media-service.ts:30-32` الذي يعلن العقد المعاكس.

---

## B. الملفات والمسؤوليات

| الملف | المسؤولية الفعلية | المستهلكون | الملاحظات |
|---|---|---|---|
| `src/backend/services/tmdb-enrichment-service.ts` (1153 سطراً) | كل شيء تقريباً: اتصال TMDB، تنظيف/مطابقة العناوين، تحويل، تطبيق الإثراء، الصور، الموافقات، الحالة، الإبطال، batching | EnrichmentController فقط (+ ذاته عبر enrichBatch) | خدمة **متعددة المسؤوليات**؛ تمدد EventEmitter |
| `src/backend/services/metadata-service.ts` | التعديل اليدوي (مسار metadata) + تحويل cast/directors/writers | EnrichmentController.updateMetadataManually | يبث `media:changed` فقط (115) → لا إبطال كاش |
| `src/backend/controllers/enrichment-controller.ts` | واجهة الـ API، جلسات في الذاكرة، تقدم SSE، خلفية batch | 18 route | يحتوي منطق جلسات (يميل للخدمة) + فحص SSRF خاص |
| `src/backend/repositories/enrichment-media-repository.ts` | استعلامات media_items للفلترة، حفظ genres/people/companies، resetEnrichment، getValidColumnNames | TmdbEnrichmentService، MetadataService | `getPersonIdsByNames` ميت |
| `src/backend/repositories/enrichment-repository.ts` | جدول `pending_enrichment_approvals` | TmdbEnrichmentService | `createApproval` = `INSERT OR REPLACE` مع `media_id UNIQUE` |
| `src/backend/repositories/media-repository.ts` | update، refreshEnrichmentStatus، getById | الخدمتان | لا يلمس FTS يدوياً (تغطيه triggers) |
| `src/backend/services/cache-invalidator.ts` | ربط الأحداث بالإبطال | EventBus | لا يستمع لـ `media:changed`؛ فرع `metadata_completed` ميت |
| `src/backend/services/cache-service.ts` | withCache + TTLs | كل الخدمات | TTLs: default 300s / stale 86400s / long 604800s؛ maxSize 5000 |
| `src/backend/services/event-bus.ts` | ناقل أحداث | كل الخدمات | MaxListeners 30 |
| `src/app/api/enrich/*` (18 route) | `requireAdmin` + تفويض للـ Controller | UI admin | `/search` بلا مستهلك UI؛ `metadata/[id]` يصدّر PATCH فقط |
| `src/features/admin/hooks/use-admin-enrichment.ts` | hooks الموافقات والمفتاح والترجمة | PendingApprovalsPanel، EnrichmentOptionsPanel | |
| `src/features/admin/hooks/use-admin-media.ts` | hooks الإثراء/الدفعات/التحرير | items-control-page | `updateItemMetadata` يرسل POST (خطأ C3) |
| `src/features/admin/components/items-control/ItemManagementDialog.tsx` | نموذج التحرير اليدوي | items-control-page | الحفظ عبر POST /api/enrich/metadata/:id |
| `src/features/admin/components/items-control/{EnrichmentOptionsPanel,PendingApprovalsPanel}.tsx` | إعدادات الإثراء + لوحة الموافقات | items-control-page | |
| `src/app/api/admin/events/route.ts` | SSE (17 حدثاً) | useAdminEventsSSE، useAdminRealtime | |
| `src/backend/services/image-service.ts` | تقديم الصور (يقرأ enriched_poster/backdrop) | /api/images | ENRICHED_WEB_PREFIX |
| `src/backend/settings/settings-registry.ts` | إعدادات: image_storage_root، download_images، download_cast_images، storage_mode | — | **لا يوجد tmdb_api_key** |
| `src/backend/db/migrations/002_search_sync_triggers.sql` | مزامنة FTS عند update/delete | — | يزامن title/original_title/overview فقط |

---

## C. Findings

### Critical

**C1 — الإثراء الناجح لا يُبطِل كاش الخادم إطلاقاً**
- **المشكلة**: `metadata_completed` بنجاح يُبث على EventEmitter الخدمة فقط (`this.emit`) وليس EventBus؛ و`media:changed` الموجود على EventBus (سطر 684) **ليس** في `EVENT_PREFIX_MAP` لـ CacheInvalidator.
- **الدليل**: بث `metadata_completed` الناجح = `this.emit` فقط عند `770` (manual_tmdb_id) و`846` (tmdb)؛ الـ catch عند `853` هذا.emit فقط. EventBus لا يستقبله إلا بمسارَي `success:false`: `710` (excluded) و`733` (backoff) — وكلاهما يُسقطه الحارس `isSuccessfulEnrichment` (`cache-invalidator.ts:41-42`). الـ Controller لا يبث أي `metadata_completed` إضافي (يبث `enrichment_progress` فقط، سطر 55).
- **التأثير**: زائر/مشرف يرى بيانات قديمة (overview/rating/poster…) حتى انتهاء TTL (تفاصيل 300s، قوائم 60s، تصنيفات 300s، بحث 30s)، أو حتى إبطال لاحق. يطال أيضاً الموافقات (M5) ورفع الصورة وإعادة الضبط.
- **السيناريو**: إثراء عنصر → صفحة الزائر ما تزال تعرض الوصف القديم حتى TTL.
- **الحالة**: **مؤكد**. التعليق في `media-service.ts:30-32` يعلن صراحةً أن الطزاجة تأتي من CacheInvalidator عند `metadata_completed` — أي أن الكود نفسه يوثق العقد المخالف.

**C2 — مفتاح TMDB لا يُحفظ؛ يعود فارغاً بعد إعادة التشغيل**
- **المشكلة**: `TmdbEnrichmentService` يُبنى بـ `apiKey: ""` (`services/index.ts:143`)؛ لا إعداد `tmdb_api_key` في `settings-registry.ts` (grep: لا نتيجة). `updateConfig` يحدّث الذاكرة فقط (`tmdb-enrichment-service.ts:137-140`).
- **الدليل**: مسار `update-apikey` → `updateConfig({apiKey})` بلا أي كتابة DB؛ placeholder الـ UI "اتركه فارغاً لاستخدام السيرفر الافتراضي" (`EnrichmentOptionsPanel.tsx:116`) بينما لا يوجد افتراضي.
- **التأثير**: بعد كل إعادة تشغيل يُفشل كل إثراء بـ `TMDB API error 401` ويظهر كفشل عام بلا تمييز السبب.
- **الحالة**: **مؤكد**.

**C3 — حفظ نموذج التحرير اليدوي معطّل (POST مقابل PATCH → 405)**
- **المشكلة**: المسار `src/app/api/enrich/metadata/[id]/route.ts` يصدّر **PATCH فقط** (سطر 5)، بينما العميل يرسل **POST**.
- **الدليل**: `use-admin-media.ts:251` `apiPost("/api/enrich/metadata/${id}")`؛ `apiPost` = method POST (`api.ts:49-53`)؛ `ItemManagementDialog.handleSubmit` (302-335) يحفظ عبر `useUpdateItemMetadata` (خط 139)؛ `apiFetch` يرمي `ApiError` على غير 2xx (`api.ts:38-40`) → 405 Method Not Allowed من Next.js App Router.
- **التأثير**: زر حفظ نموذج التحرير اليدوي (عناوين، نجوم، طاقم، سنوات، تصنيف، صور…) يفشل دائماً ويظهر "فشل حفظ التعديلات". ميزة أساسية معطلة كلياً.
- **الحالة**: **مؤكد** (مسار UI كامل: Dialog → hook → apiPost → route بدون POST).

### High

**H1 — فرع `metadata_completed → CacheInvalidator` ميت وظيفياً (يتضمن C1 ويوسعه)**
- **الدليل**: `getEventBus().emit("metadata_completed")` في موضعين فقط (`710`,`733`) وكلاهما `success:false` → الحارس (`cache-invalidator.ts:41-42`) يسقطهما. حتى لو أُصلح البث، سيصل نجاح فقط إن أُضيف إليه بث EventBus.
- **الحالة**: **مؤكد**.

**H2 — التعديل اليدوي (المسار البديل) لا يُبطِل الكاش**
- **الدليل**: `metadata-service.ts:115` يبث `media:changed` فقط (للاستهلاك عبر SSE)؛ لا `media_updated`/`metadata_completed`. (مقابل `PATCH /api/media/[id]` → `MediaService.updateMedia` الذي يبث `media_updated` ويفلتر 12 حقلاً — مساران متوازيان بسلوكي إبطال مختلفين).
- **الحالة**: **مؤكد**.

**H3 — كتابات الإثراء بدون transaction → حالة جزئية**
- **الدليل**: `_applyEnrichmentFromDetails` (628-681): `mediaRepo.update` (628) ← `refreshEnrichmentStatus` (629) ← `saveGenres` DELETE+INSERT (632) ← `savePeople` DELETE+INSERT (674) ← `saveProductionCompanies` (680) ← `updateCreditsSyncTime` (681). `updateData` يضبط `metadata_status:"completed"` و`enriched:1` **قبل** كل ذلك (576-595). `saveGenres`/`savePeople`: DELETE ثم INSERT بلا transaction (`enrichment-media-repository.ts:73,83 / 101,121`).
- **السيناريو**: فشل بعد سطر 629 يترك `metadata_status='completed'` + `enriched=1` مع genres/people محذوفة أو جزئية، مع تسجيل `_recordFailure` و`metadata_completed(fail)` — تناقض status/backoff.
- **الحالة**: **مؤكد** بنيةً؛ السيناريو الفعلي وقت التشغيل يحتاج تحققاً إضافياً.

**H4 — لا حماية تزامن لعنصر واحد (batch × batch / يدوي × تلقائي)**
- **الدليل**: `enrichBatch` (935-959) يمرر ids إلى `pLimit(3)` بلا dedup للمكررات ولا حارس in-flight لكل عنصر؛ دفعتان متزامنتان لنفس `media_id` تتنافسان (last-writer-wins) وتكتبان جداول فرعية متداخلة.
- **الحالة**: **مؤكد** عدم وجود الحماية؛ حجم الضرر العملي يحتاج تحققاً.

**H5 — لا timeout ولا abort على طلبات TMDB + لا معالجة 429/5xx**
- **الدليل**: `_fetchFromTmdb` بـ `fetch` مكشوف (151)؛ `cancelSession` يمنع عناصر المستقبل فقط ولا يلغي in-flight (938)؛ لا retry ولا throttle؛ `pLimit(3)` بلا تأخير → دُفعة كبيرة تتجاوز حد TMDB بسرعة؛ فشل التعليق الواحد يجمّد الدُفعة كاملة.
- **الحالة**: **مؤكد**.

**H6 — حماية SSRF معطوبة جزئياً (مؤكد بتجربة runtime)**
- **الدليل**: `SSRF_BLOCKLIST` regex (`tmdb-enrichment-service.ts:14-15`) لديه `$` في موضع خاطئ. تجربة node:
  ```
  127.0.0.1 => false | 10.0.0.1 => false | 192.168.1.5 => false
  172.16.0.1 => false | 172.31.0.1 => false | 169.254.169.254 => false
  localhost => true | [::1] => true | 0.0.0.0 => true | metadata.google.internal => true
  ```
  المحجوب فعلياً: `localhost/[::1]/0.0.0.0/metadata.google.internal` فقط. فحص الـ Controller (186-187) يعمل عبر prefix لكنه يغطي `172.16.` فقط (لا `172.17–172.31`). مسار الرفع اليدوي (`upload-image` ← controller check ← `service.uploadImageFromUrl` ← `_saveImage` سطر 493) يسمح بـ `http://172.20.10.1/...` → SSRF في RFC1918 (بوابة requireAdmin).
- **الحالة**: **مؤكد** بالتجربة؛ الأثر العملي محصور بمسار admin وروابط TMDB (لا روابط مستخدم عادي).

### Medium

**M1 — نظاما الأحداث غير متناسقين**: `this.emit` + `getEventBus().emit` يتكرران في 9+ مواضع بلا helper موحّد؛ بعض الأحداث تُبث أحادياً (انظر L5). `migration-ledger.md:379-380, 421-423, 585` يزعم ✅ في حين أن التنفيذ ناقص — الكود هو المرجع.

**M2 — كائن `config` ميت عملياً**: `updateConfig` يدمج بـ `this.config` لكن `_getOptions` (176-184) لا يقرأه؛ `downloadImages/downloadCastImages/storageMode/language` مثبتة افتراضياً. أي `updateConfig({downloadImages})` بلا أثر.

**M3 — خيار `downloadCastImages` ميت**: يُقبل من UI→hook→controller→options لكن `_applyEnrichmentFromDetails` يفحص `options.downloadImages` فقط (597). لا يوجد تحميل لصور الممثلين إطلاقاً.

**M4 — إعادة الإثراء تتجاهل `tmdb_id` المخزّن**: `enrichItem` لا يقرأ `media.tmdb_id`؛ حتى مع `force` يُعاد البحث وقد تُطابق نتيجة مختلفة فتستبدل `overview/original_title/rating/year/runtime` (title محفوظ).

**M5 — `approveEnrichment` لا يبث حدث إكمال**: `_applyEnrichmentFromDetails` يبث `media:changed` فقط؛ لا `metadata_completed` على أي من النظامين. UI يحدّث عبر SSE/react-query محلي، لكن كاش الخادم يبقى قديماً (يلتقي مع C1).

**M6 — `cachedTableColumns` يُخزَّن للأبد**: `_ensureTableColumns` (159-163) يخزّن `PRAGMA table_info` مرة واحدة؛ أي عمود جديد عبر migration لا يُلتقط حتى إعادة التشغيل → عمود غير موجود في updateData يُسقَط بصمت.

**M7 — أخطاء TMDB البحثية تُبتلع**: `_searchTMDB` يمسك الأخطاء بـ `/* ignore */` (334, 351) فيتحول فشل الشبكة إلى "No result from TMDB" بلا log/مقياس.

### Low

**L1** — `stats.lastRun` لا يُعيّن أبداً (يبقى null)؛ إحصائيات في الذاكرة تضيع عند إعادة التشغيل.
**L2** — `cancelledSessions` Set ينمو بلا تنظيف (لا delete).
**L3** — `searchCache` يُمسح كل 5 دقائق بغضّ النظر عن حجمه (cap 500).
**L4** — `_getStorageRoot` (`image_storage_root`) يُقرأ من DB مرتين لكل عنصر مع الصور — حسب القرار الموثّق للطزاجة، لكن يمكن قراءته مرة لكل عنصر.
**L5** — `metadata_started` للـ batch يُبث أحادياً فقط (933) بينما الفردي مزدوج (692-693)؛ `metadata_completed` للـ batch أحادي (961)؛ `enrichment_progress` للعناصر أحادي (955) — مع سدّ Controller له عبر `_emitProgress` → EventBus (سطر 55).
**L6** — تسمية النشاط: اللحظي `metadata_completed` مقابل المخزّن `metadata_update` (878) — تباين عرضي في صفحة الأحداث.

---

## D. Positive Findings

1. **فصل الطبقات صحيح في أغلب المسار**: routes→controller→service→repository، لا SQL في الخدمات ولا استدعاءات repo من الـ routes.
2. **عتبة موافقة بشرية** (0.65–0.8) بدل التطبيق الأعمى — حماية من النتائج الخاطئة.
3. **مطابقة العناوين العربية متينة**: تنظيف البادئات ونص الضجيج والسنوات + Jaccard/طول + سنة بونص (186-312) — تصميم مخصص جيد للعربية.
4. **فشل بتأخير أُسي لكل عنصر** (backoff 300s→1h) يعزل الفاشلين داخل الدُفعة.
5. **تخزين الصور خارج الجذر + بادئة web ثابتة** (`ENRICHED_WEB_PREFIX`): المسار في القاعدة ثابت حتى لو تغيّر التخزين، مع تخطي التنزيل إذا وُجد الملف (527-532).
6. **FTS متزامن عبر DB triggers** (002): تعديل title/original_title/overview يُحدّث `media_search` تلقائياً — لا كود JS في مسار الإثراء.
7. **`resetEnrichment` يحذف صفوف FTS** (`enrichment-media-repository.ts:161`) — لا بقايا بحث بعد إعادة الضبط.
8. **عزل فشل العنصر داخل الدُفعة**: try/catch في `enrichItem` (848-855) يحوّل كل فشل لنتيجة ولا يُسقط الدُفعة.
9. **`INSERT OR REPLACE` مع `media_id UNIQUE`** في الموافقات يمنع تكرار اقتراح لنفس العنصر.
10. **كل routes الإثراء تحت `requireAdmin`** (18/18).
11. **تقدم الدفعة عبر SSE فعال**: `_emitProgress` → `enrichment_progress` على EventBus (55) يُستهلك في `/api/admin/events` وuseAdminEventsSSE.

---

## E. Dead Code (مؤكد بعد فحص الاستخدامات)

| البند | الدليل |
|---|---|
| `_detectLanguage` | `tmdb-enrichment-service.ts:186` — لا استدعاءات |
| `createPendingApproval` | `:1011` — لا مستهلكين (المسار الفعلي يستدعي `approvalRepo.createApproval` مباشرة عند 798) |
| `getPersonIdsByNames` | `enrichment-media-repository.ts:124` — لا مستهلكين |
| `config.{language,downloadImages,downloadCastImages,storageMode}` | `_getOptions` (176-184) لا يقرأ `this.config`؛ `apiKey` فقط فعّال |
| `downloadCastImages` option | يُقبل من UI→controller→service بلا استخدام |
| `stats.lastRun` | لا يُعيّن في أي مكان |
| `POST /api/enrich/search` + `searchTmdb` (controller) | لا استدعاء UI + يكسر الطبقات عبر `as unknown as` (151) |
| فرع `metadata_completed` في CacheInvalidator | الحارس يسقط كل ما يصل EventBus — "ميت وظيفياً" |

---

## F. Duplication

1. **SSRF بنسختين مختلفتين**: `isSafeImageUrl`/`SSRF_BLOCKLIST` (الخدمة 14-25 — regex معطوب) مقابل قائمة الـ Controller (186-187 — prefix ناقص 172.17-31). تغطية مختلفة لنفس المفهوم.
2. **بث مزدوج `this.emit` + `getEventBus().emit`** في 9+ مواضع بلا helper موحّد.
3. **`pLimit` معاد كتابته يدوياً** (27-53) بينما `p-limit` مستخدم في الماسح.
4. **منطق الأشخاص مكرر جزئياً**: `_buildPeopleFromLegacy` (metadata-service) مقابل بناء people في `_applyEnrichmentFromDetails`.
5. **قراءة media + فحص "Media not found"** مكررة في `enrichItem`/`approveEnrichment`/`resetItemMetadata`/`uploadImageFromUrl`.

---

## G. Performance Hotspots (مرتبة)

1. **3N+ طلبات TMDB لكل دُفعة** (بحث + تفصيل ar/en لكل عنصر) مع `pLimit(3)` بلا rate-limit — الاختناق الحقيقي. **حرج** للدُفعات الكبيرة.
2. **N رسالة `media:changed` على EventBus لكل عنصر أثناء الدُفعة** (684) → ضجيج SSE لكل عملاء admin. **عالٍ** للدُفعات الكبيرة.
3. **كتابات DB متعددة لكل عنصر بدون transaction** (update + genres + people + companies + credits). **متوسط**.
4. **`getAllIdsForEnrichment` بلا pagination في مسار by-filter** (984) يحمّل كل المعرفات في الذاكرة. **متوسط** للكتالوجات الضخمة.
5. **`getSetting("image_storage_root")` قراءة DB لكل صورة** (مرتين/عنصر). **منخفض**.
6. **`_ensureTableColumns` PRAGMA cached للأبد** — قديم بعد migration. **منخفض**.

---

## H. Data Integrity Risks (مرتبة)

1. **حالة جزئية عند فشل متوسط** (media محدّثة لكن genres/people لا) مع `metadata_status='completed'` مسبقاً (H3). — **عالي**
2. **سباق عنصر واحد** بين batch/manual → last-writer-wins وتداخل كتابات (H4). — **متوسط**
3. **إعادة الإثراء قد تطابق نتيجة مختلفة** وتستبدل حقولاً معتمدة مسبقاً (M4). — **متوسط**
4. **نافذة DELETE قبل INSERT** في saveGenres/savePeople عند انقطاع. — **متوسط**
5. **FTS `phonetic_key`/genres/cast_names تبقى قديمة للأبد بعد الإثراء** (مؤكد):
   - trigger `media_items_au` يزامن `title/original_title/overview/created_at` فقط (002:21-34).
   - `backfillMissing` لا يلمس صفوفاً ذات `phonetic_key` غير فارغ (`search-repository.ts:266`) ولا يُستدعى إلا بعد `scan_completed` (`search-service.ts:148-152`).
   - العناصر المُثراة لها phonetic_key غير فارغ (من backfill المسح) → لن تُحدَّث أبداً حتى `rebuildIndex` يدوي.
   - الأثر: بحث نصي عن طاقم/نوع جديد أُضيف بالإثراء لا يجد العنصر؛ البحث الصوتي بحرفيات قديمة.
   - **حالة**: **مؤكد**. — **متوسط**
6. **SSRF gap** في `172.17–172.31` بمسار الرفع اليدوي (H6). — **منخفض–متوسط** (بوابة requireAdmin).

---

## I. Recommended Architecture (اقتراح تصميم — **لم يُنفَّذ**)

الحد الأدنى التصحيحي مع الإبقاء على الهندسة الحالية:

1. **طبقة TMDB client واحدة** (`tmdb-client.ts`): timeout/AbortController، retry مع `Retry-After` عند 429، rate-limit، تعقيم استجابات.
2. **بث موحّد عبر helper واحد** (`emitEnrichmentEvent(name, payload)`) يبث على this + EventBus دائماً — يزيل M1/L5 ويفتح مسار الإبطال.
3. **إبطال كاش**: إضافة `media:changed` إلى `EVENT_PREFIX_MAP` (أو جعل `metadata_completed` الناجح المصدر) + **تجميع/تأجيل** purge في نهاية الدُفعة (بدل N×6 purge).
4. **transaction واحدة لكل عنصر** عبر `runInWriterContext` مع `withTransaction` تغطي update+genres+people+companies+credits.
5. **حارس لكل عنصر** (Set in-flight) لمنع تداخل batch × manual.
6. **حفظ مفتاح TMDB في settings** (إعداد `tmdb_api_key`) + قراءته عند بدء الخدمة + إبطال عند `settings_updated`.
7. **إصلاح route `metadata/[id]`**: قبول POST (أو تحويل العميل إلى PATCH) — الأسرع والأكثر أماناً فوراً (C3).
8. **إزالة dead code** (E) ودمج SSRF في مكان واحد (regex مُصحَّح يطابق بادئات + استثناءات).

---

## J. Execution Plan (مقترح — **لم يُنفَّذ**)

| المرحلة | الهدف | الملفات المتوقعة | المخاطر | الاختبارات المطلوبة | الاعتماد |
|---|---|---|---|---|---|
| J0 | إصلاح C3 (POST/PATCH) + إصلاح regex SSRF | `metadata/[id]/route.ts` أو `use-admin-media.ts`؛ `tmdb-enrichment-service.ts:14-25` | منخفض | وحدة: مسار metadata يحفظ فعلياً | — |
| J1 | بث `metadata_completed` الناجح على EventBus + إبطال كاش صحيح (وتجميع الدُفعة) | tmdb-enrichment-service، cache-invalidator، cache-prefixes | ازدواج إبطال → يتطلب تجميع | وحدة: بث النجاح، purge واحد لكل دفعة | — |
| J2 | transaction + حارس عنصر واحد + **مزامنة FTS لكل عنصر** (`addToIndex` بعد النجاح) | tmdb-enrichment-service، enrichment-media-repository، metadata-service، search-repository | سباق صفوف فرعية؛ تعارض addToIndex مع مسح نشط → عبر runInWriterContext | وحدة: فشل منتصف العملية يترك اتساقاً؛ صف FTS محدَّث (genres/cast/phonetic) بعد إثراء/تعديل/إعادة ضبط | J1 |

> **ملاحظة J2-FTS (من استفسار فهرس البحث)**: بعد تعديل البيانات الوصفية حالياً، الـ trigger يزامن 4 أعمدة نصية فقط، و`addToIndex` يُستدعى فقط من `MediaService.updateMedia` (media-service:540) — مسارات الإثراء (`_applyEnrichmentFromDetails`/`updateMetadataManually`) لا تفهرس الأنواع/الطاقم/المفتاح الصوتي، و`resetEnrichment` يحذف صف FTS دون إعادة إدراج. الحل: استدعاء `searchRepo.addToIndex(id)` داخل `runInWriterContext` **بعد نجاح** transaction الإثراء/التعديل/إعادة الضبط (وليست fire-and-forget كـ media-service:540)، فيغلق V4/H5 بالكامل بلا `rebuildIndex` كامل.
| J3 | TMDB client موحّد (timeout/retry/rate-limit) | ملف جديد + حقن | تغيير سلوك 429 | وحدة: 429/5xx/timeout/malformed | J1 |
| J4 | حفظ المفتاح في settings | settings-registry، update-apikey، services/index | تسريب سر في logs | وحدة: قراءة بعد إعادة البناء | — |
| J5 | إزالة dead code + دمج SSRF | tmdb-enrichment-service، enrichment-controller، enrichment-media-repository | كسر بلا مستهلك | typecheck+lint+build | بعد J1-J4 |
| J6 | واجهة مزوّد Provider interface (TMDB كمزود أول + مشغّل إثراء تلقائي بعد scan_completed + معرّفات متعددة) — ميزة تطورية، ليست إصلاحاً | ملف جديد provider interface + تعديل service | إعادة هيكلة كبيرة | وحدة: مزوّدان وهميان، Fallback بينهما | بعد J3-J4 |
| J7 | **Sidecar مثل Emby**: حفظ البيانات الوصفية والصور بجانب ملفات الوسائط (`*.nfo` + `poster.jpg`/`backdrop.jpg`)، مع إبقاء SQLite مصدر الحقيقة والصيغة web-relative كما هي | tmdb-enrichment-service (كتابة مرآة بعد نجاح transaction)، metadata-service، image-service، media-repository (مسار الملف من media_files)، settings-registry (إعداد `metadata_save_mode`: db/sidecar) | فشل كتابة NFO يجب ألا يُسقط الإثراء (فصل الخطأ)؛ صيغة المسارات في القاعدة تبقى دون تغيير | وحدة: كتابة NFO+صور بجانب مسار ملف العنصر بعد نجاح؛ وضع `db` بلا أي كتابة ملف؛ إخفاق NFO لا يؤثر على DB | بعد J4 (ميزة جديدة فوق طبقة مستقرة) |

**الترتيب**: J0 فوراً (ميزة معطلة + ثغرة). J1 ثم J2 (الإبطال يجب أن يسبق ليشمل الأحداث الناجحة). J5/J6 أخيراً، وJ7 ميزة مستقلة تُبنى بعد استقرار J1-J4 (تُنفَّذ "كتابة أولاً، قراءة عند الطلب" كمرحلة أولى بلا مساس بقراءة النظام الحالية).

---

## ملاحظات التحقق (Verification round)

- **TTLs مؤكدة**: MEDIA_DETAIL=300s (`media-service.ts:34`)، MEDIA_LIST=60s (`:42`)، TAXONOMY=300s (`:51`)، SEARCH=30s (`search-service.ts:15`).
- **C3 مؤكد بالتتبع الكامل**: Dialog(139,326) → useUpdateItemMetadata → updateItemMetadata(251) → apiPost(POST) → route بـ PATCH فقط.
- **H6 مؤكد بتجربة node** على الـ regex الفعلي (نتائج أعلاه).
- **V4/FTS مؤكد**: trigger يزامن 4 أعمدة فقط؛ backfillMissing يقتصر على صفوف phonetic_key فارغ.
- **المسارات البث الأُحادية مؤكدة**: batch `metadata_started`(933)، `enrichment_progress`(955)، batch `metadata_completed`(961) — all `this.emit`؛ تعويض التقدم عبر Controller `_emitProgress`(55).
- **الاختبارات**: لا توجد أي اختبارات إثراء في `src/tests` (grep صفر نتيجة) — كل بند أعلاه بلا تغطية.

---

## تحديث ما بعد التنفيذ (J0) — نُفِّذ وأُثبت بالتحقق الفعلي

| البند | التغيير | الدليل |
|---|---|---|
| C3 | أُضيف `POST` إلى `src/app/api/enrich/metadata/[id]/route.ts` بجانب `PATCH` (العميل يرسل POST عبر `use-admin-media.ts` فكان يفشل بـ 405) | `src/tests/unit/enrichment-metadata-route.test.ts` (POST+PATCH تفويض + معالجة خطأ) |
| H6 | أُصلح `SSRF_BLOCKLIST` في `tmdb-enrichment-service.ts` إلى فحص **بادئ** حساس لحالة الأحرف + أُصدِّر `isBlockedHostname` واستُخدم في `enrichment-controller.ts` بدل القائمة الناقصة (`172.16.` فقط) | `src/tests/unit/ssrf-blocklist.test.ts` + `src/tests/unit/enrichment-ssrf-upload.test.ts` |

**التحقق الفعلي على القرص (18 ملف اختبار / 113 اختباراً):**
- `npx.cmd tsc --noEmit` → exit 0 ✓
- `npx.cmd vitest run` → 18 files / 113 tests ✓ (105 سابقة + 8 جديدة)
- `npm run lint` → 0 errors (تحذيرات `<img>` سابقة الوجود) ✓
- `npm run build` → exit 0 ✓

**ملاحظة صادقة على التحقق**: اكتُشف أثناء التنفيذ أن نتائج جلسة سابقة موثقة في التقرير (نجاح 19 ملفاً / 131 اختباراً وتصحيح "توجد اختبارات إثراء") لم تكن منعكسة على القرص الفعلي إطلاقاً — `git status` وقراءة الملفات المباشرة لم تُظهر أي من تلك التعديلات، واختبارات الإثراء **لم تكن موجودة** قبل J0. أُعيد تنفيذ J0 بالكامل مع تحقق مباشر بعد كل تعديل (git diff + قراءة)، والنتائج أعلاه مأخوذة من القرص الفعلي.

**بقي من الخطة**: J3 (TMDB client) ← J4 (حفظ المفتاح) ← J5 (تنظيف) ← J6 (مزوّدات) ← J7 (Sidecar).

---

## تحديث ما بعد التنفيذ (J1) — نُفِّذ وأُثبت بالتحقق الفعلي

**الهدف**: إغلاق M1/L5 — بثّ `metadata_completed` الناجح على الحافلة العامة `EventBus`
(وليس على حافلة الخدمة المحلية فقط) كي يفعل إبطال الكاش المُعدّ مسبقاً
(`cache-invalidator.ts:58` يربط `metadata_completed` → `MEDIA_INVALIDATION_PREFIXES`
مع `shouldInvalidate: isSuccessfulEnrichment`)، مع تجميع نتائج الدفعة في حدث واحد
بدل `N×` بثّ جزئي.

| البند | التغيير | الدليل |
|---|---|---|
| البث الموحّد | `enrichItem(id, options, emitGlobal = true)` — كل نتائج `metadata_completed` (نجاح يدوي/بحث، skipped، pending، فشل) تُبث على `this` **و** `getEventBus()`؛ الدفعة تمرّر `emitGlobal: false` لكل عنصر وتتجمع نتائجها في حدث واحد `source: "batch"` مع `success/skipped/failed/total` في نهاية الجلسة | `src/backend/services/tmdb-enrichment-service.ts` (enrichItem 749+، enrichBatch 1030+) |
| تجميع الدفعة | `enrichBatch` يجمع نتائج العناصر في عدادات (success/skipped/failed) ويبثّ `metadata_completed` مجمّعاً مرة واحدة بعد `Promise.all` — بلا بثّ لكل عنصر | نفسه |
| TSDoc | أُضيف/حُدّث TSDoc عربي كامل لكل دالة معدّلة (enrichItem/enrichBatch ونتائجها) | نفسه |
| الاختبارات | ملف جديد `src/tests/unit/enrichment-global-events.test.ts` (4 اختبارات): بثّ النجاح الفردي على الحافلة العامة، بثّ skipped، تجميع الدفعة في حدث واحد، وتكرار جلسة الدفعة | `src/tests/unit/enrichment-global-events.test.ts` |

**ملاحظة**: إبطال الكاش نفسه (رابط `metadata_completed`) كان موجوداً سلفاً في
`cache-invalidator.ts` منذ البداية؛ المشكلة الحقيقية كانت أن خدمة الإثراء لم تكن
تبثّ على الحافلة العامة إطلاقاً فلم يُفعَّل الرابط. J1 أغلقت هذه الفجوة.

---

## تحديث ما بعد التنفيذ (J2) — نُفِّذ وأُثبت بالتحقق الفعلي

**الهدف**: إغلاق H3/H5 (السلامة الجزئية + فهرس بحث قديم) — كل كتابات الإثراء داخل
معاملة ذرّية، حارس عنصر واحد يمنع تداخل batch × manual، ومزامنة صف FTS
`addToIndex` بعد كل نجاح (إثراء/تعديل يدوي/إعادة ضبط) وليست fire-and-forget.

| البند | التغيير | الدليل |
|---|---|---|
| transaction ذرّية | `_applyEnrichmentFromDetails` و`updateMetadataManually` تغلّفان كل الكتابات (update + refreshEnrichmentStatus + saveGenres + savePeople + saveProductionCompanies + updateCreditsSyncTime) داخل `runInWriterContext` + `withTransaction` (SAVEPOINT) — أي فشل في المنتصف يسترجع كامل الحالة السابقة | `tmdb-enrichment-service.ts:683-743`، `metadata-service.ts:112-127` |
| مزامنة FTS | `searchRepo.addToIndex(mediaId)` تُستدعى (await) داخل نفس `runInWriterContext` بعد نجاح المعاملة في: نجاح الإثراء، التعديل اليدوي، و`resetItemMetadata` (تعيد إنشاء الصف بعد أن يحذفه `resetEnrichment`) — فتُصبح الأصناف/الطاقم/المفتاح الصوتي قابلة للبحث فوراً | `tmdb-enrichment-service.ts:742`، `:1253-1257`، `metadata-service.ts:118` |
| حارس العنصر الواحد | `inFlightItems: Set<number>` في `enrichItem` — نداء ثانٍ لنفس العنصر أثناء جلسة نشطة يعيد `{ success: false, inProgress: true }` فوراً دون أي كتابة، ويُحرَّر الحارس في `finally` | `tmdb-enrichment-service.ts:768-776`، `:963-965` |
| الإعداد (DI) | `TmdbEnrichmentService` و`MetadataService` تلقيا `SearchRepository` في constructor؛ `services/index.ts` يمرّر الـ singleton نفسه | `tmdb-enrichment-service.ts:137-161`، `metadata-service.ts:17-30`، `services/index.ts:142-150` |
| الاختبارات | ملف جديد `src/tests/unit/enrichment-j2-transaction.test.ts` (4 اختبارات): نجاح الإثراء يكتب فعلياً ويُحدّث صف FTS بالأصناف والطاقم؛ فشل `saveGenres` في منتصف المعاملة يسترجع كل الكتابات (لا حالة جزئية)؛ `resetItemMetadata` يمسح الإثراء ويعيد توليف الصف بلا أنقاض؛ الحارس يمنع التزامن ويُحرَّر بعد الانتهاء | `src/tests/unit/enrichment-j2-transaction.test.ts` |

**تحقيق J2 بالقرص (20 ملفاً / 121 اختباراً):**
- `npm run typecheck` → exit 0 ✓
- `npm test` → 20 files / 121 tests ✓ (117 بعد J1 + 4 جديدة في J2)
- `npx eslint` على الملفات المعدّلة → 0 errors (التحذيرات الخمسة في `index.ts`/`tmdb-enrichment-service.ts` **سابقة الوجود** — أثبتت بمقارنة stash: نفسها قبل J2) ✓
- `npm run format:check` → ملفات TS نظيفة (التحذيرات في markdown/AGENTS.md سابقة الوجود) ✓

**ملاحظات تشخيصية اكتُشفت أثناء J2 (خارج النطاق — سُجّلت للعلم):**
- **استعلام `media_search ... WHERE media_id = ?` غير موثوق** على جدول FTS5 لأن
  `media_id` عمود `UNINDEXED`: قد يعيد صفّاً خاطئاً أو مجموعة فارغة حسب قائمة
  الأعمدة المُختارة (أُثبت تجريبياً). الاستعلامات الموثوقة هي عبر الأعمدة المفهرسة
  (`title`, `MATCH`). هذا خلل/خصوصية قائمة في المشروع (لا علاقة له بـ J2) —
  اختبارات J2 تعتمد على `WHERE title = ?` لتجنّبه، ويستحق معالجة مستقلة.
- **`addToIndex` يُنشئ صفوفاً مكررة في FTS5** (كل `INSERT OR REPLACE` يضيف صفاً
  برقم rowid جديد بدل استبدال الصف القائم — تُراجع أثناء البحث وتُستبعد
  التكرارات عبر `dedupeAppend`). سلوك قائم منذ البداية، خارج نطاق J2، ويستحق
  معالجة مستقلة (حذف مسبق أو استهداف rowid).

**بقي من الخطة بعد J0+J1+J2**: J3 (TMDB client موحّد timeout/retry/rate-limit) ←
J4 (حفظ المفتاح في settings) ← J5 (إزالة dead code + دمج SSRF) ← J6 (مزوّدات) ←
J7 (Sidecar NFO + صور).

---

## تحديث ما بعد التنفيذ (J4) — نُفِّذ وأُثبت بالتحقق الفعلي

**الهدف**: إغلاق بند J4 وخطر «تسريب سر في logs» — حفظ مفتاح TMDB API في إعدادات
النظام بدل الذاكرة المؤقتة (التي كانت تفقده عند كل إعادة تشغيل)، مع تقنيع قيمته
في سجل تدقيق الإعدادات.

| البند | التغيير | الدليل |
|---|---|---|
| سجل الإعدادات | أُضيف `tmdb_api_key` (string، فئة storage، isPublic:false، isSecret:true، maxLength:500) إلى `SETTINGS_REGISTRY`، وحقل `isSecret?: boolean` في `SettingDefinition` | `src/backend/settings/settings-registry.ts` |
| تقنيع التدقيق | `upsertSetting` يقنّع `old_value`/`new_value` للأسرار (`***`) في `settings_audit_log` — يمنع التسريب للكتابات الجديدة | `src/backend/repositories/settings-repository.ts` |
| خدمة الإثراء | `saveApiKey(apiKey, userId?, ip?)` (ذاكرة فوراً + persist عبر `updateSettings`)، و`loadApiKeyFromSettings()` للتحميل عند البدء، واشتراك `settings_updated` لتحديث المفتاح في الذاكرة من أي مصدر | `src/backend/services/tmdb-enrichment-service.ts` |
| DI | `services/index.ts` يستدعي `loadApiKeyFromSettings()` عند تهيئة الخدمات (خلفية، لا تحجب البدء) | `src/backend/services/index.ts` |
| Controller/Route | `updateApiKey(body, userId?, ip?)` يستدعي `saveApiKey` بدل `updateConfig`؛ مسار `update-apikey` يبني ctx عبر `buildContext(request, auth)` | `enrichment-controller.ts`، `src/app/api/enrich/update-apikey/route.ts` |
| النوع الأمامي | `tmdb_api_key?: string` أُضيفت إلى `AdminSettings` (تبقى متطابقة مع السجل) | `src/shared/types/settings.ts` |
| الاختبارات | ملف جديد `src/tests/unit/enrichment-j4-api-key.test.ts` (4 اختبارات): قراءة بعد إعادة البناء، تحديث الحدث لخدمة قائمة، تقنيع التدقيق (old/new + user_id + ip)، وتوافق خلفي بلا SettingsService | نفسه |

**تحقيق J4 بالقرص (22 ملفاً / 128 اختباراً):**
- `npm run typecheck` → exit 0 ✓
- `npm test` → 22 files / 128 tests ✓ (124 سابقة + 4 جديدة)
- `npm run lint` → 0 أخطاء جديدة (الخطأان في `scripts/fetch-tools.mjs` و`src/app/api/auth/route.ts` سابقا الوجود — ملفات غير معدّلة) ✓
- `npx prettier --check` على الملفات المعدّلة → نظيف ✓

**التحقق الحي (بعد إعادة تشغيل الخادم على :4000):**
- `POST /api/auth` (admin/admin123) → نجاح ✓
- `POST /api/enrich/update-apikey {apiKey}` → `{"success":true,"data":{"message":"API key updated"}}` ✓
- فحص القاعدة الحية `data/media_library.db` (قراءة فقط): صف `settings.tmdb_api_key` يحمل المفتاح، وأحدث صف في `settings_audit_log` يحمل `old_value="***"`/`new_value="***"` مع `user_id` و`ip_address` ✓
- إعادة تشغيل الخادم ثم `POST /api/enrich/test-connection` **دون إعادة إدخال المفتاح** → `TMDB connection successful / Fight Club` ✓ (يثبت `loadApiKeyFromSettings`)

**ملاحظة أثر تاريخي (خارج نطاق هذا التعديل)**: قبل J4، سُجّل المفتاح نصاً صريحاً في
`settings_audit_log` للقاعدة الحية في ~86 صفاً (أقدمها 2026-06-02). **عولجت بموافقة
المستخدم**: أُخذت نسخة احتياطية (`data/backups/backup-j4-audit-cleanup-<ts>.db` عبر
`VACUUM INTO`)، ثم حُذفت الصفوف ذات القيمة الصريحة (شرط `new_value != '***'`) — بقي
صف مقنّع واحد فقط، وصف `settings.tmdb_api_key` لم يُمس (التحقق بعده: test-connection →
Fight Club ✓).

**بقي من الخطة بعد J0+J1+J2+J4**: J3 (TMDB client موحّد timeout/retry/rate-limit) ←
J5 (إزالة dead code + دمج SSRF) ← J6 (مزوّدات) ← J7 (Sidecar NFO + صور).
