# تقرير التحقيق الهندسي — SQLITE_BUSY وأداء قاعدة البيانات في Library Manager V2

**التاريخ:** 2026-08-13 (تحديث التنفيذ: 2026-08-15)
**النطاق:** تحليل Root-Cause ثم تنفيذ الإصلاحات منخفضة المخاطر (القسم N) — لا تغيير config، لا migration.
**المصادر:** كود `src/backend` (المسارات الحساسة مقروءة بالكامل) + السجلات الفعلية:
`data/dev-server.log`، `C:\Users\Administrator\AppData\Local\Temp\opencode\lmv2-dev.log`،
`C:\Users\Administrator\AppData\Local\Temp\opencode\lmv2-dev.err.log` + فحص
`data/media_library.db` (WAL نشط فعليًا، `-wal` = 3.97MB).

---

## A. الخلاصة التنفيذية

- **آلية مؤكدة (PROVEN):** البنية تتضمن **اتصالين لملف SQLite واحد** (WAL): اتصال رئيسي لكل طلبات HTTP + اتصال كاتب مخصص للماسح/الإثراء — بقفل كتابة واحد مشترك و`busy_timeout = 30000` على كليهما، مع طبقة إعادة محاولة تصل إلى 3 محاولات على **كل** عبارة (`wrapDbMethods`).
- **آلية مؤكدة (PROVEN):** `POST /api/enrich/batch` **fire-and-forget** — يعود فورًا (158ms) ويستمر الإثراء بالخلفية بـ `pLimit(3)` على اتصال الكاتب، وبعد كل عنصر يُطلق `_logMetadataResult` **كتابة INSERT غير مُنتظَرة (`void`)** على الاتصال الرئيسي (`tmdb-enrichment-service.ts:1118`).
- **نتيجة مشاهدة (OBSERVED):** 22× `Failed to log metadata result: SQLITE_BUSY` + 2× فشل تنظيف جلسات auth في `err.log` — كلها كتابات على الاتصال الرئيسي تتصادم مع كاتب الإثراء.
- **آلية بطء HTTP (HYPOTHESIS-HIGH، متوافقة كميًا):** العبارة التي تصطدم بالقفل تنتظر `busy_timeout=30s`، ومع `wrapDbMethods` (3 محاولات) يمكنها حجب الاتصال الرئيسي الوحيد 30–90 ثانية؛ وnode-sqlite3 **يصفّ كل العبارات على الاتصال نفسه**، فتنتظر خلفها كل قراءات HTTP (صور/auth/settings). القياسات الفعلية تطابق ذلك: صور ≈30.7s، auth/settings ≈60s، enrich/status ≈91s (3×30s).
- **سبب الجذر النهائي: NOT YET PROVEN 100%** — الجزء الوحيد غير المثبت هو «مَن يحمل قفل الكتابة باستمرار ≥30s» (مفصّل في القسم J).

---

## B. منهجية التحقيق والأدلة

| المصدر                                                                                                                        | النوع   | الاستخدام                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `src/backend/db/db.ts` (566 سطر كامل)                                                                                         | كود     | إثبات اتصالين + busy_timeout + retry wrapper + معاملات SAVEPOINT + حالة على `globalThis`        |
| `src/backend/services/tmdb-enrichment-service.ts` (مقروء 640–1259)                                                            | كود     | إثبات fire-and-forget + writer context + `_logMetadataResult` + `inFlightItems` + `enrichBatch` |
| `src/backend/controllers/enrichment-controller.ts`                                                                            | كود     | إثبات `_processBatchInBackground` وردّ الـ158ms                                                 |
| `src/backend/scanner/media-sync.service.ts` + `scan-orchestrator.ts`                                                          | كود     | بنية SAVEPOINT للدفعة عبر المشي الكامل (`runBatched`)                                           |
| `base-repository.ts`, `auth-service.ts`, `view-publisher.ts`, `settings-service.ts`, `database-service.ts`, `image-*`, routes | كود     | توزيع القراءات/الكتابات على الاتصال الرئيسي                                                     |
| `lmv2-dev.log`                                                                                                                | Runtime | timeline HTTP الحقيقي (158ms → 30.7s → 60s → 91s → 16.5min SSE)                                 |
| `lmv2-dev.err.log` (24 سطر كامل)                                                                                              | Runtime | 22× SQLITE_BUSY إثراء + 2× auth + 2× ECONNRESET                                                 |
| `dev-server.log` (1214 سطر)                                                                                                   | Runtime | لا أحداث scan ولا أحداث enrichment؛ 45× `Database ready`؛ خطأ `no such column: character` متكرر |
| فحص `media_library.db` + `-wal`                                                                                               | Runtime | WAL فعلي (326MB قاعدة + wal 3.97MB)                                                             |

---

## C. البنية والتدفق (Architecture)

```
ملف واحد: data/media_library.db (WAL)
 ├─ الاتصال الرئيسي (getDatabase)   → كل طلبات HTTP: قراءات + كتابات (activities / login / session / views)
 └─ اتصال الكاتب (runInWriterContext) → الماسح + الإثراء (SAVEPOINT، wal_autocheckpoint=0)
        ⤷ قفل كتابة WAL واحد مشترك بين الاتصالين
```

- `db.ts:352` → `PRAGMA busy_timeout = 30000` على الاتصالين.
- `db.ts:190-264` → كل `all/get/run/exec` مغلّفة بطبقة retry: `MAX_RETRIES=3`، إرجاء `100ms/200ms` لكل استدعاء.
- `db.ts:157-172` → `withExclusiveTransaction` = طابور JS يُسلسل كتل SAVEPOINT فقط (لا يمنع التنافس مع الاتصال الرئيسي).
- `db.ts:26-31,55-71` → الحالة على `globalThis` (سبب: إعادة تقييم Turbopack في dev). رغم ذلك `dev-server.log` يظهر 45× `Database ready` = إعادة تهيئة متكررة في جلسة dev.
- `tmdb-enrichment-service.ts:1188` → `pLimit(3)`؛ `:818-838` → كل كتابات العنصر داخل `runInWriterContext` + SAVEPOINT (قصيرة، بدون شبكة)، ثم `addToIndex` (FTS) في سياق الكاتب.
- `tmdb-enrichment-service.ts:1118-1129` → `_logMetadataResult`: `void activityRepo.logActivity(...).catch(console.error)` — **غير مُنتظَر، على الاتصال الرئيسي، الخطأ يُطبع فقط بلا retry**.
- `enrichment-controller.ts:96` → `_processBatchInBackground` يُطلق بـ `setImmediate` بعد عودة الاستجابة.

---

## D. الدليل التشغيلي (Timeline الفعلي)

```
POST /api/enrich/batch    → 200 in 158ms       ← fire-and-forget (الدفعة مستمرة بالخلفية)
GET  /api/images/*        → 200 in ~30.7s  ×8  ← قراءات على الاتصال الرئيسي تتأخر خلف كتابة محجوبة
GET  /api/auth            → 200 in 60s         ← 2× busy_timeout (محاولتان لعبارة تصطدم)
GET  /api/settings        → 200 in 60s
GET  /api/enrich/status   → 404  in 91s        ← ~3×30s busy_timeout + 2 إرجاء (100+200ms)
GET  /api/admin/events    → 200 in 16.5min     ← SSE stream مفتوح (عادي، ليس بطء) PROVEN
err.log: 22× enrichment metadata SQLITE_BUSY + 2× auth cleanup SQLITE_BUSY
dev-server.log: لا أحداث scan/enrichment؛ SQLITE_ERROR: no such column: character متكرر
```

**قراءة كمية:** 30.7s ≈ `busy_timeout` واحد اكتُسب فيه القفل قبل انتهاء المهلة؛ 60s ≈ استنفاد محاولة (30s) ثم نجاح محاولة ثانية (30s)؛ 91s ≈ 3 محاولات × 30s استُنفدت كلها ثم فشل. هذا التطابق يُرجّح آلية «عبارة واحدة محجوبة تملّك الاتصال الرئيسي الوحيد» بقوة.

---

## E. آلية الانهيار (Chain)

1. مستخدم يُطلق دفعة إثراء → استجابة فورية (158ms) والدفعة تواصل بـ 3 عناصر متوازية على **اتصال الكاتب**.
2. كل عنصر ناجح/فاشل يستدعي `_logMetadataResult` → **INSERT غير مُنتظَر** في `activities` على **الاتصال الرئيسي**.
3. الكاتب يمسك قفل الكتابة WAL أثناء معاملات SAVEPOINT و`addToIndex`؛ INSERT على الرئيسي يصطدم → ينتظر **30s** داخل `busy_timeout`، ولو استُنفد يُعيد الـ wrapper محاولتين إضافيتين (حتى ~90s) ثم `SQLITE_BUSY` يُطبع في `err.log` (الـ22×).
4. **بينما الاتصال الرئيسي مشغول بعبارة محجوبة، تتوقف كل طلبات HTTP التي تحتاج DB خلفها** (node-sqlite3 يصفّ العبارات على نفس الاتصال) → صور/auth/settings = 30–90s.
5. تنظيف auth (كل 5 دقائق) يكتب على الرئيسي أيضًا → اصطدام إضافي (الـ2×)؛ وview-publisher يكتب view counts غير مُنتظرة على الرئيسي (MAX_CONCURRENT=5) → ضغط إضافي.

**المصدر المحتمل للإمساك المستمر ≥30s (غير مثبت نهائيًا):** كاتب الإثراء يكتب بشكل متواصل تقريبًا أثناء دفعة من 3 عناصر (SAVEPOINT متتالية عبر `withExclusiveTransaction` + FTS commits)، وقد تكون معاملة الدفعة في الماسح (SAVEPOINT مفتوح عبر المشي كاملًا — `media-sync.service.ts:106-115`) لو كان scan نشطًا — لكن **السجلات لا تُظهر scan قيد التنفيذ**.

---

## F. سبب الجذر (تصنيف)

- **PROVEN:** بنية اتصالين + busy_timeout=30s + retry wrapper على كل عبارة + `_logMetadataResult`/auth cleanup/view-publisher ككتّاب غير مُنتظرين على الاتصال الرئيسي + fire-and-forget الإثراء.
- **HYPOTHESIS-HIGH (السبب الأرجح):** **التصادم بين الكتابات غير المُنتظَرة على الاتصال الرئيسي وكاتب الإثراء على قفل WAL، مع `busy_timeout=30s` الذي يحوّل كل اصطدام إلى حجب 30–90s لكل HTTP يمر عبر الاتصال الوحيد.**
- **NOT YET PROVEN:** هوية حامل القفل خلال نافذة ≥30s متواصلة (مطلوب قياس — القسم K).

---

## G. مسألة التكرار (Duplicates 106482–106486)

- **PROVEN (كود):** `inFlightItems` (`tmdb-enrichment-service.ts:867-874`) يمنع إثراء نفس المعرف **بالتزامن** داخل نفس نسخة الخدمة.
- **HYPOTHESIS:** لا يوجد **منع إعادة إرسال عبر الجلسات** — لا "enriched recently" للنجاحات (فقط `recentlyFailed` backoff للفشل، `:919`)، والـ controller لا يلغي المعرّفات المكررة بين جلسات/فلاتر متداخلة → إعادة إرسال نفس IDs في دفعة ثانية/فلتر بعد اكتمال الأولى تُثريها مجددًا (كل مرة: كتابة metadata + activity). هذا يفسر ظهور نفس المعرّفات في أكثر من `item_started`.
- **UNKNOWN (حاجز):** أسطر التوجيه (`search_result`, `batch_started`, `item_started`, `Finished filesystem cache database compaction`, المعرّفات 106482–106486) **غير موجودة نهائيًا** في `dev-server.log` ولا في أي ملف workspace (grep شامل صفر نتائج؛ و`compaction`/`filesystem cache` غير موجودين في الكود). لا يمكن تأكيد التكرار الفعلي لتلك المعرّفات من الأدلة المتاحة.

---

## H. عوامل مساهمة

1. **`busy_timeout=30000` + wrapper retry على كل عبارة** — يحوّل أي تصادم قصير إلى حجب طويل (30–90s) على الاتصال الوحيد. (PROVEN)
2. **كتّاب غير مُنتظرين على الاتصال الرئيسي** (`_logMetadataResult`, `_logSystemEvent`, auth cleanup, view-publisher) — تتراكم في طابور الاتصال. (PROVEN)
3. **عدم احترام `isScanActive`** من قِبل `_logMetadataResult` وview-publisher — بينما auth/retention/backup تتحقق منه. (PROVEN كوديًا)
4. **الجلسة الواحدة في dev:** 45× `Database ready` — إعادة تهيئة متكررة (Turbopack/restarts) رغم `globalThis`؛ كل تهيئة تشغّل `PRAGMA optimize` وفحص هجرات. (OBSERVED — dev-only)
5. **FTS `addToIndex` داخل سياق الكاتب لكل عنصر** — يُطيل إمساك القفل قليلًا. (OBSERVED كوديًا)

---

## I. أخطاء ثانوية مشاهدَة (خارج نطاق السؤال)

- **`SQLITE_ERROR: no such column: character`** متكرر في `dev-server.log` → `GET /api/media/103695 500` (1380ms). Schema drift في قاعدة dev (كود يتوقع عمود `character` غير موجود). خطأ حقيقي مستقل، مرتبط منطقيًا بسير «فلتر بلا محتوى» الذي سبق التوجيه، لكنه **ليس** المصدر المطلوب للتحقيق.
- **2× `Error: aborted ... ECONNRESET`** — إجهاض اتصالات من طرف العميل، عرضي.

---

## J. فجوات الأدلة (UNKNOWN)

1. **مَن يحمل قفل الكتابة ≥30s متواصلة؟** لا توجد سجلات op/txn/connection-id/thread ID. الاحتمالات: كاتب الإثراء (SAVEPOINT+FTS متتابعة)، معاملة batch للماسح إن كانت نشطة (لا دليل في السجلات على scan)، أو سلسلة إعادة محاولات متتابعة على الرئيسي.
2. **أسطر/معرّفات التوجيه** غير موجودة في workspace → لا يمكن بناء timeline التوجيه ولا تأكيد التكرار.
3. **هل كان scan نشطًا أثناء نافذة 30–90s؟** السجلات لا تُظهر أحداث scan (لكن أحداث الإثراء أيضًا غير موجودة في `dev-server.log` — أي أن logger قد يكتب لمخرج آخر لا نملكه).

---

## K. القياس المطلوب (لإغلاق الفجوات) — نُفِّذ جزئيًا، راجع K2

- ~~إضافة connection-id/thread-id و`operationId` لكل `db.slow_statement`~~ ✅ `connection` أصبح حقلاً في `DbObservation` (و`db.busy_detected`/`db.busy`/`db.slow_statement` كلها تحمل `connection`).
- ~~تسجيل `busyOccurrences` و`lockWaitMs` وattempt لكل عبارة على **الاتصالين**~~ ✅ المراقبة (`observe`) مفعّلة الآن على الاتصالين (كانت للكاتب فقط).
- ✅ تسجيل معاملات SAVEPOINT مفتوحة (فتح→إغلاق) لكل اتصال، مع `ageMs` لحظة أي تصادم (تفاصيل التنفيذ في K2).
- [متبقٍ] إبقاء أحداث `enrichment.*` و`scan.*` في نفس ملف سجل latencies — تحقق عند إعادة الإنتاج الفعلية.
- (عند تجربة الإصلاح لاحقًا) قياس قبل/بعد لكل من: `await` على `_logMetadataResult`، تقليل busy_timeout، جعل view-publisher يحترم `isScanActive`.

## K2. تنفيذ أداة القياس (تم) + دليل التشغيل

**ما نُفِّذ** (تشخيصي فقط — بلا تغيير سلوكي، مغلّف بـ`logger.enabled` فلا أثر في الإنتاج):

- `src/backend/db/db.ts`: `DbRuntimeState` أضيف له خريطتا `inflightStatements` و`openTransactions` (بمفتاح `main`/`writer`). عند كل `SQLITE_BUSY`/`SQLITE_LOCKED` على أي اتصال يُرسَل `logger.warn("db.busy_detected", …)` يتضمن: `connection`، `sql` (مقتطع ≤120)، `attempt`، `elapsedMs`، `operationId`، `context`، **وصورة الاتصال الآخر**: `otherInflight` (العبارة قيد التنفيذ + `ageMs` + `operationId` + `context`) و`otherOpenTxn` (`keyword`/`sql`/`depth`/`ageMs`/`operationId`) — أي «الحامل المرجّح لقفل الكتابة» لحظة التصادم. `observe = logger.enabled` (الاتصالان)، مع `trackTxnAfterSuccess` (SAVEPOINT/BEGIN يفتح، COMMIT/RELEASE/ROLLBACK يغلق، `ROLLBACK TO SAVEPOINT` لا يغلق).
- `src/backend/observability/db-stats.ts`: حقل `connection: "main" | "writer"` في `DbObservation` + في `db.busy` warn.
- `src/tests/unit/db-busy-detection.test.ts`: اختبار يثبت أن تصادم كتابة على `main` أثناء `SAVEPOINT` مفتوح على `writer` يُنتج `db.busy_detected` مع `otherOpenTxn.keyword = "SAVEPOINT"` و`otherConnection = "writer"`.

**دليل التشغيل لالتقاط الأدلة (إعادة إنتاج الدفعة):**

```powershell
# 1) شغّل dev مع تفعيل القياس (DEV_CONSOLE للستاندرد أوت، أو DEV_LOG_FILE لملف JSONL)
$env:DEV_CONSOLE = "1"
$env:SLOW_QUERY_MS = "5000"
npm run dev
# أو ملف: $env:DEV_LOG_FILE = "C:\projects\library-manager-v2\data\measure.jsonl"

# 2) أعد تشغيل نفس الدفعة التي تسببت بـ SQLITE_BUSY سابقًا:
#    POST /api/enrich/batch (الدُفعة الكبيرة 106482–106486 وما حولها) عبر واجهة الإثراء.

# 3) افحص السجل:
#    - db.busy_detected: لكل تصادم — انظر otherInflight/otherOpenTxn لمعرفة «مَن يمسك القفل».
#    - db.slow_statement: العبارات التي تتجاوز 5s واتصالها.
#    - db.busy / db.query.completed: latencies على الاتصالين.
```

متى يظهر `db.busy_detected` بحامل قفل مقنع (مثلاً `otherInflight.sql` هي `INSERT INTO activity_log…` على `writer`، أو `otherOpenTxn` SAVEPOINT إثراء بعمر ≥30s) تُرفع النتيجة في قسم M من HYPOTHESIS-HIGH إلى **PROVEN** مع عيّنة الحقول الفعلية.

---

## L. اتجاهات الإصلاح (مقترحات) — بند 1 وبند 3 نُفِّذا في القسم N

1. ~~`await activityRepo.logActivity(...)` بدل `void`~~ ✅ **نُفِّذ (القسم N، مع تخطي أثناء `isScanActive`).**
2. تقييد/ضبط `busy_timeout` (30s مفرط) على الاتصال الرئيسي أو فصل اتصال ثالث خاص بالكتابات الخفيفة (activities/views) بحيث لا يحجب HTTP. **[لم يُنفَّذ — قرار معماري.]**
3. ~~معاملة `view-publisher` و`_logMetadataResult` بنفس حارس `isScanActive`~~ ✅ **نُفِّذ لـ `_logMetadataResult`/`_logSystemEvent` (القسم N).** (`view-publisher` لا يزال خارج النطاق.)
4. منع إعادة إرسال المعرفات المكررة عبر الجلسات (dedup على مستوى controller/session). **[لم يُنفَّذ.]**
5. معالجة `no such column: character` (إصلاح schema dev / هجرة). **[لم يُنفَّذ — خارج نطاق.]**

---

## M. الخلاصة النهائية

**سبب الجذر المعلن: HYPOTHESIS-HIGH** — تصادم كتابات غير مُنتظرة على الاتصال الرئيسي (نشاط/جلسات/مشاهدات) مع كاتب الإثراء/الماسح على قفل WAL الوحيد، يتضخم بفعل `busy_timeout=30s` وطبقة retry (3×)، فيحجب الاتصال الرئيسي الوحيد 30–90s أمام كل HTTP. **NOT YET PROVEN 100%** بسبب غياب قياس حامل القفل — **لكن أداة القياس نُفِّذت الآن (القسم K2)** وتنتظر إعادة إنتاج الدفعة لالتقاط `db.busy_detected` مع صورة الحامل. **الإصلاحات منخفضة المخاطر نُفِّذت وتحقق منها (typecheck/اختبارات/lint/build) — القسم N.** تكرار المعرّفات غير قابل للتأكيد من الأدلة المتاحة (فجوة أسطر التوجيه)، والآلية الممكنة (إعادة إرسال عبر جلسات متداخلة) موثقة كوديًا. الخطأ الثانوي `no such column: character` عطل جزئي منفصل في بيئة dev.

---

## N. التنفيذ المنجز (2026-08-15) — إصلاحات منخفضة المخاطر

**النطاق:** إزالة كتّاب الإثراء غير المُنتظرين عن الاتصال الرئيسي + ضبط حد زمني لطلبات شبكة TMDB + تخطي الإثراء أثناء مسح نشط. لا تغيير config، لا migration، لا تغيير في عقود API.

### N1. حد زمني لطلبات الشبكة (J3 من `metadata-enrichment-deep-audit.md`، عولج جزئيًا)

- ثابت `ENRICHMENT_FETCH_TIMEOUT_MS = 10000` + `AbortSignal.timeout` على الاستدعاءات الأربعة: `_fetchFromTmdb`، تحميل الصورتين في `_saveImage`، `testApiKey` (`tmdb-enrichment-service.ts`). أي استجابة شبكية تتعطل لن تحجب الخيط أكثر من 10s.

### N2. حارس المسح النشط (بند L-3)

- `TmdbEnrichmentService` يقبل الآن معامل منشئ اختياري `isScanActive` (افتراضي `() => false`).
- `enrichItem`: أثناء مسح نشط يرفض فورًا بـ `{ success: false, skipped: true }` ويبث حدث `metadata_completed` (تجنبًا لتعليق واجهة انتظار الحدث).
- `enrichBatch`: أثناء مسح نشط يتخطى الجلسة كلها ويرجع `{ skipped: total }`؛ وإن بدأ مسح أثناء الدفعة تُحتسب العناصر المتبقية في حقل `skipped` بجدول `BatchTracker` (المعرفة الجديدة في `BatchTrackerOptions`).
- الحَقْن في الإنتاج: `src/backend/services/index.ts` يمرر `() => scanActivity.isActive()`.

### N3. كتابات الإثراء على اتصال الكاتب بدل الرئيسي (بند L-1)

كل الكتابات التي كانت تُنفَّذ على الاتصال الرئيسي أُعيد توجيهها إلى اتصال الكاتب عبر `runInWriterContext`:

- `_logMetadataResult` و`_logSystemEvent` → داخل `runInWriterContext`، وتُتخطى (بلا `activity_log` مكرر) أثناء مسح نشط.
- `createApproval` (اعتماد الاقتراح) → كتابة عبر اتصال الكاتب.
- `approveEnrichment`/`rejectEnrichment` (`approvalRepo.updateStatus`) → عبر اتصال الكاتب.
- `uploadImageFromUrl` (`mediaRepo.update`) → عبر اتصال الكاتب.

**أثر متوقع:** خلال الإثراء (دفعات/فردي) لا تُكتَب أي عبارة على الاتصال الرئيسي — فيختفي التصادم الذي سبّب حجب HTTP (القسم E)، حتى قبل الحاجة لقياس الحامل.

### N4. التحقق

- `npm run typecheck` ✅ | `npm test` ✅ (139 اختبارًا، من بينها 2 جديدان في `src/tests/unit/enrichment-global-events.test.ts` يثبتان تخطي الفردي والدفعة أثناء مسح نشط مع فحص أحداث `metadata_completed`) | `npm run lint` ✅ (0 خطأ جديد) | `npm run build` ✅.

### N5. الحدود المعروفة (لم تُنفَّذ)

- الإثراء الفردي يبقى متزامنًا داخل طلب HTTP (P4: خلفية + SSE) — تحسين UX لاحق، وليس سبب التجميد.
- `view-publisher` لا يزال كاتبًا خلفيًا على الرئيسي (بند L-3 ناقص) — يتخطى جزئيًا خلال المسح في أماكن أخرى.
- لا يوجد dedup عبر الجلسات (بند L-4)، ولا تغيير `busy_timeout` (بند L-2).
- إعادة الإنتاج التشغيلية مع `DEV_CONSOLE=1` + `SLOW_QUERY_MS=5000` (القسم K2) لم تُنفَّذ بعد — هي الرفع النهائي لـ HYPOTHESIS-HIGH إلى PROVEN.

---

## ملحق: المراجع (file:line)

- `src/backend/db/db.ts`: PRAGMAs `:556-576`، `wrapDbMethods` `:377-479` (مراقبة على الاتصالين + `db.busy_detected`)، دوال القياس `classifyTxnSql`/`sqlKeyword`/`trackTxnAfterSuccess`/`emitBusyDetected` (أعلى الملف)، `withExclusiveTransaction`، `runInWriterContext` `:657-661`، `getDatabase` `:663-668`، `executeWithRetry`.
- `src/backend/services/tmdb-enrichment-service.ts`: `_applyEnrichmentFromDetails` `:667-842`، `enrichItem` `:862-1098`، `_logMetadataResult` `:1111-1130`، `enrichBatch` `:1178-1259`، `inFlightItems` `:867-874`، `recentlyFailed` `:919-942`.
- `src/backend/controllers/enrichment-controller.ts`: `enrichBatch` `:76-96`، `_processBatchInBackground` `:96-126`، `enrichByFilter` `:128-146`، تنظيف الجلسات 15 دقيقة.
- `src/backend/scanner/media-sync.service.ts`: `runBatched` `:106-125`، `openBatchSavepoint` `:253-265`، `closeBatchSavepoint` `:273-288`.
- `src/backend/scanner/scan-orchestrator.ts`: استدعاء `runBatched` `:365-368`، SAVEPOINT المتزامن `:492`.
- `src/backend/services/auth-service.ts`: تنظيف كل 5 دقائق (يتخطى أثناء scan).
- `src/backend/services/view-publisher.ts`: `MAX_CONCURRENT=5` كتابة خلفية على الرئيسي.
- `src/backend/services/database-service.ts`: حارس `isScanActive` لـ VACUUM INTO/optimize/truncate/restore.
- `src/backend/services/settings-service.ts`: كاش `settings` (TTL قصير) على الرئيسي.
- `src/backend/services/image-service.ts` + `image-repository.ts` + `controllers/image-controller.ts` + `app/api/images/[id]/route.ts`: سلسلة الصور = قراءات SELECT + ملفات + كاش LRU 60s + ETag.
- `src/backend/observability/db-stats.ts`: حقل `connection` في `DbObservation` + `db.busy` warn.
- `src/tests/unit/db-busy-detection.test.ts`: اختبار يثبت `db.busy_detected` مع `otherOpenTxn` على الاتصال الآخر.
- `src/app/api/auth/route.ts`: GET → `auth.getMe` (قراءة). `src/app/api/admin/events/route.ts`: SSE stream مفتوح.
