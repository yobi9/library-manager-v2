# مرجع المعمارية: الوضع الراهن (As-Is) والقرار المعماري وخطة التنفيذ

> وثيقة مرجعية موحّدة لتحليل **نموذج معالجة البيانات** (Data-Flow Architecture) في Library Manager V2.
> تمثل هذه الورقة القرار المعماري الكامل: الوضع الفعلي الموثّق بالكود، ومقارنة
> **Full-Stack Next.js** مقابل **Decoupled (API خلفية منفصلة)**، والتوصية، ومراحل التنفيذ.
> **لا تستبدل** تقارير الجودة التفصيلية `docs/audits/00-overview.md` ← `06-features-admin.md` —
> بل تربطها وتجمع اكتشافاتها المعمارية في مرجع واحد.
> أُنشئ: 2026-08-16 | حالة: **مرجع معتمد للتنفيذ (قرارات المستخدم مدمجة).**

---

## 1) الملخص التنفيذي

- **البنية الفعلية المثبتة بالكود:** تطبيق **Full-Stack Next.js Monolith** — الخلفية داخل العملية
  نفسها (`src/backend/` عبر DI lazy singletons)، وواجهة React 19 تُدار فيها استجابات الخادم
  محلياً. **ليست** بنية Decoupled، وليست Server Actions.
- **القرار المعماري: Full-Stack هو الأنسب لهذا المشروع.**
  - **الأنسب (Full-Stack):** يتطابق مع الوضع الراهن، وطبيعة النشر (جهاز LAN واحد + Installer
    + `release/app/server.js` = عملية Next standalone واحدة عبر nssm)، وSQLite المحلي،
    ولا يوجد أي مستهلك خارجي حالياً.
  - **غير الأنسب (Decoupled):** يضيف خادماً ثانياً ومنطقة تحكم (CORS/CORS_ORIGINS/Secure cookies
    وتزامن إصدارات) دون فائدة حالية؛ و`CORS_ORIGINS` في `src/lib/config/env.ts` **كود ميت مؤكد**
    (لا `Access-Control-Allow-Origin` في أي مكان في الكود — grep: لا نتائج).
- **المشكلة الحقيقية ليست في البنية بل في الانضباط الداخلي:** عميلا HTTP متوازيان في
  `src/lib/frontend/` + 10 نقاط `fetch` خام/مخصصة + تسريبات طبقات موضعية (عائلة scan خارج DI،
  SSE خارج DI، `(viewer)/layout.tsx` يقرأ الخدمات مباشرة).
- **الجدول الكامل والتفاصيل والحواف** في الأقسام §2–§6، والمراحل المتفق عليها في §7،
  و**قرارات المستخدم** (خاصة هوكي Folder Picker) في §8.

---

## 2) الوضع الراهن (As-Is) — موثق من الكود

### 2.1 الخريطة العامة لتدفق البيانات

```
Client (React Query hooks)
  │  apiClient (نسبي /api) — 26 موقعاً   ← src/lib/frontend/api-client.ts
  │  api.ts (عناوين كاملة)  — 49 موقعاً  ← src/lib/frontend/api.ts   ← الباريل index.ts يصدّر هذا فقط
  │  fetch خام/مخصصة        — 10 مواقع
  ▼
src/app/api/*  — 130 route.ts
  │  127 بنمط canonical: requireAuth → getControllers().<ns>.<method>() → toNextResponse/handleRouteError
  │  3 استثناءات موثقة:
  │    ├─ /api/health        → getDatabase() مباشرة  (src/app/api/health/route.ts:6-7)
  │    ├─ /api/auth/verify-admin → JWT مضمّن (يستخدمه proxy.ts للتحقق)
  │    └─ /api/admin/events  → SSE مباشرة عبر EventBus
  │  14 مساراً تتجاوز Controllers: عائلة scan تُنشئ `new ScanController` لكل طلب
  │    (src/app/api/libraries/[id]/scan/route.ts:14-15) + admin/events + watcher
  ▼
src/backend/controllers → services → repositories → SQLite (WAL, runInWriterContext)
```

### 2.2 طبقة الخادم (مكتملة المراجعة في `04-app-api.md`)

- **التحقق من الهوية لكل معالج:** `parseAuthFromRequest` يدعم Cookie `session_token` + `Authorization: Bearer`
  (`src/backend/api/route-helpers.ts:34-37`)؛ `requireAuth`/`requireAdmin`.
- **DI lazy singletons:** `getControllers()` → `getServices()` → repositories
  (`src/backend/services/index.ts`, `src/backend/controllers/index.ts`).
- **الاستثناءات المؤكدة:** `health` (DB مباشر)، `verify-admin` (JWT مضمّن — مطلوب لأن الـ proxy
  لا يقرأ DB)، `/api/admin/events` (SSE). هذه استثناءات **مقبولة وموثقة** — تُبقى كما هي.
- **الأمن:** `src/proxy.ts` يحمي `/admin/*` عبر fetch داخلي لـ `/api/auth/verify-admin`؛ حماية
  الواجهة العامة عبر `(viewer)/layout.tsx:18-27` (`viewer_access_mode` + `AuthService.verifyToken()`).
- **ثغرات معلّقة (مرتبطة):** IDOR على `user/[id]/{stats,activity}` و`toggle-pin` بلا فحص مدير
  — `04` H1/H2، وصدى رسائل الخطأ الخام `route-helpers.ts:92` — `04` H3. **خارج نطاق هذه الورقة**
  (تعالج في حزمة P0 من `00-overview.md`).

### 2.3 طبقة العميل — التشتت (محور هذه الورقة)

| النقطة | الواقع المثبت | الحجم |
|---|---|---|
| عميل HTTP موحّد غائب | `api-client.ts` (نسبي، يفك `data`، يفحص `json.success`) مقابل `api.ts` (عناوين كاملة، يرجع `ApiResponse` بلا فحص `success`) | 26 مقابل 49 موقعاً |
| باريل مضلل | `src/lib/frontend/index.ts` يصدّر **`api.ts` فقط** — المستوردون الذين يقرأون `index` لا يرون `apiClient` | 1 ملف |
| fetch خام/مخصصة | 10 مواقع موثقة (§3.3) | 10 |
| عقد معطوب | `fetchRecommendations` يبني `/media/recommended/{mediaId}/{libraryId}` بينما المسار `[id]/[type]` — يمرر `libraryId` في فتحة `[type]` ويرسل `?type=` تتجاهلها الـ route | `02` H1 |
| طبقات مكسورة | `media-helpers.ts:2-4` يستورد من `@/features/viewer/...`؛ روابط الصور مبنية يدوياً `media-helpers.ts:129,157-158` بدل `image-helpers` | `05` M5 |

### 2.4 الخط الأساس (تم التحقق — لا تغييرات بعد)

- `npm run typecheck` ✅ | `npm run lint` ⚠️ 0 أخطاء / 63 تحذيراً | `npm test` ✅ 128/128 (22 ملفاً) | `npm run build` ✅ (آخر بناء قبل هذا المرجع).

---

## 3) الاكتشافات المعمارية الجديدة من جلسة التدقيق (2026-08-16)

> هذه الاكتشافات **مكمّلة** لتقارير `00`–`06`؛ الأرقام التالية من قراءة فعلية للملفات.

### 3.1 طبقة العميل `src/lib/frontend` (17 ملفاً قُرئت بالكامل)

| # | الاكتشاف | الموقع | الخطورة |
|---|---|---|---|
| N1 | **عقد `fetchRecommendations` معطوب** — `libraryId` يُمرَّر في فتحة `[type]` و`?type=` تتجاهلها الـ route؛ الـ controller يستخرج `mediaType` من سجل الميديا إلا عند `"all"`؛ النتيجة: توصيات دائمة بنفس النوع وبارامتر `mediaType` ميت | `api-media.ts:364-379`, `app/api/media/recommended/[id]/[type]/route.ts:11,13`, `media-controller.ts:205-217`, `media-repository.ts:400-416` | 🔴 (منطق خاطئ حالي) |
| N2 | **`MediaItem` فضفاض** — أسماء مزدوجة snake/camel + حقل `pined` (typo) في `api-media.ts:39` | `api-media.ts` | 🟠 |
| N3 | **نمط unwrap دفاعي متكرر** `X \| { data: X }` ~15 مرة عبر `api-media.ts` | `api-media.ts:313-317` وغيرها | 🟡 |
| N4 | **`favorites-context.tsx`** — `loading` دائماً `false`، لا مزامنة عبر التبويبات، `clearLocalFavorites`/`clearWatchLaterIds` غير مستخدمين | `favorites-context.tsx:33` | 🟡 |
| N5 | **أثر `translate.ts`** — ~10 تصديرات ميتة + تعليقات `// === التعديل المطلوب هنا ===` + نسخ محلية من `SORT_OPTIONS`/`LIBRARY_TYPES` في `library-items-page.tsx:20`/`library-form.tsx:43` | `02` H3 | 🟠 |
| N6 | **`image-helpers.ts:3`** — تعليق قديم يشير لمسار خاطئ + ~20 سطراً فارغاً | `image-helpers.ts` | 🟡 |

### 3.2 الطبقة المشتركة `src/shared` + `src/lib`

| # | الاكتشاف | الموقع | الخطورة |
|---|---|---|---|
| N7 | **`src/shared/hooks` = قشرات فارغة**: 4 ملفات = 0 بايت مؤكد (`use-infinite-scroll`, `use-media-filters`, `useDebounce`, `useLocalStorage`) + `readme.md` نص وصفي يحتوي **ادعاءً خاطئاً** (يقول إن `useOpenFolder` مستخدم في الأدمن — الصحيح: الأدمن يستخدم `useFolderPicker`). | `src/shared/hooks/*` | 🟠 |
| N8 | **`cn` مكرر**: `src/lib/utils.ts:4` (المستخدم — 47 استيراداً من `@/lib/utils`) مقابل `src/shared/utils/index.ts:4` (**صفر مستهلكين**). كذلك `formatDate`/`formatDateTime` في `shared/utils/index.ts` **بلا مستهلكين** — ونسخ محلية في `person-detail-page.tsx:17` و`user-detail-modal.tsx:27` | `src/lib/utils.ts`, `src/shared/utils/index.ts` | 🟠 |
| N9 | **ثوابت ميتة**: `API_ROUTES` (`constants/index.ts:52`), `PAGINATION` (:60), `USER_ROLES` (:66) — **صفر استيرادات/استخدام**. `DEFAULT_IMAGES` مستخدم (3 مواقع) لكنه لا يكمل SSOT الصور (روابط مبنية يدوياً في media-helpers) | `src/shared/constants/index.ts` | 🟠 |
| N10 | **`ExclusiveItem` (admin) ينسخ `ExclusiveSettingItem` (shared)** — عقدان لنفس المجال بجسر `as ExclusiveItem[]` في `use-exclusive-items.ts:27` → خطر انحراف الأنواع | `shared/types/settings.ts:19`, `admin/types/exclusive.ts:17` | 🟠 |
| N11 | **تبعية معكوسة**: `src/shared/utils/crew-helpers.ts:6` يستورد `MediaItem` من `@/lib/frontend/api-media` — shared يجب أن يكون أدنى مستوى | `crew-helpers.ts` | 🟡 |
| N12 | ضوضاء: سطر 33 في `constants/index.ts` (`// أو "#" حسب الرغبة`)، مسافات زائدة `" منتج  "` في `crew-roles.ts:55` | `src/shared/constants/*` | 🟡 |

### 3.3 هوكات Viewer وAdmin (27 ملفاً قُرئت بالكامل)

| # | الاكتشاف | الموقع | الخطورة |
|---|---|---|---|
| N13 | **ازدواج مؤكد**: `useStartScan`/`useStopScan`/`useResumeScan` معرّفة **مرتين** (نفس المسارات) | `use-admin-libraries.ts` + `use-admin-processes.ts` | 🟠 |
| N14 | **ازدواج SSE**: `use-admin-events-sse.ts:123` و`use-admin-realtime.ts:57` يفتحان اتصالَي `EventSource` مستقلّين على نفس `/api/admin/events` بنسخ أسماء الأحداث (مطابق `06` M3) | `use-admin-events-sse.ts`, `use-admin-realtime.ts` | 🟠 |
| N15 | **`useOpenFolder` (viewer) و`useFolderPicker` (admin)** — هوكان لنفس الـ Agent (`NEXT_PUBLIC_FOLDER_PICKER_URL \|\| http://localhost:5199`) | `viewer/hooks/use-open-folder.ts:10`, `admin/hooks/use-folder-picker.ts:5-6` | 🟠 → **قرار المستخدم §8** |
| N16 | **10 نقاط fetch خام/مخصصة**: `auth-context.tsx:29,47,60,81`، `media-queries.ts:316`، `video-player.tsx:167`، `use-visitor-request.ts:16`، `use-admin-users.ts:153` (FormData)، `use-admin-database.ts:73` (FormData)، `use-admin-license.ts:55` (غلاف `licenseRequest`) | متعددة | 🟠 |
| N17 | **ضوضاء/بلوك معلّق**: `use-admin-media.ts` (أسطر بيضاء مبعثرة، بلوك معلّق 435-440، تعليقات `// ←`)، 3 تعليقات مسار شاردة (`messages.ts:1`, `events-sse.ts:1`, `visitor-requests.ts:1`)، 5 `console.log` في `use-open-folder.ts:23,27,30,55,57` | `admin/hooks/*`, `viewer/hooks/*` | 🟡 |
| N18 | **إيجابي**: 17/22 هوكاً إدارياً تعبر `@/lib/frontend/api` بنمط موحد + TSDoc شامل — **هذا هو الهدف القياسي لـ Phase 1** | `admin/hooks/*` | ✅ |
| N19 | **تكرار أحداث الأمان في صفحة `admin/events`**: حادثتا **الحظر/رفع الحظر** كانتا تُكتبان في جدولين في نفس الدالة `blockUser` — `activities` بـ `block_user`/`unblock_user` + `entityType:"system"` (يظهر في صندوق «أحداث النظام») **و** `security_events` بـ `user_blocked`/`user_unblocked` (يظهر في صندوق «أحداث الأمان») → نفس الحدث يُعرض مرتين بترجمتين متطابقتين («حظر مستخدم»). بقيّة أحداث الأمان **غير مكررة**: `login_failed` و`password_changed` تكتب في `security_events` فقط، و`user_login` في `activities` فقط. **النمط سبق معالجته** في الترحيل 008 (أزال `login_success` من `security_events` لأنه تكرار لـ `user_login`) — لكن حادثتي الحظر بقيتا تكراراً. **✅ عولجت في المرحلة 3.6:** أُزيل التسجيل في `activities` والاكتفاء بـ `security_events`؛ السجلات التاريخية السابقة تبقى للقراءة. | `user-service.ts` (`blockUser` — أُزيل تسجيل `activities`), `events-page.tsx:53-54` (ACTION_LABELS — تسميات قراءة السجل التاريخي) + `:103-104` (SECURITY_LABELS) | 🟠 → ✅ 3.6 |

### 3.4 أثر عمليات الأدمن على تصفح العملاء (الأداء/التزامن — SQLite كاتب واحد)

> **السياق الجوهري:** SQLite في وضع WAL يسمح بقراءات متزامنة مع **كاتب واحد فقط** في أي لحظة.
> الاتصال الرئيسي (`getDatabase()` → `runtimeState.db`) هو **اتصال واحد مشترك لكل طلبات HTTP**
> (`db.ts:667-672`)، وأي عملية ثقيلة عليه تتسلسل خلفها كل طلبات العملاء. العملاء أنفسهم
> **يكتبون** أثناء تصفحهم (مشاهدة: `INSERT activities` + `incrementViewCount`، وتسجيل الدخول) —
> **بينما تقدم التشغيل والمفضلة خارج القاعدة أصلاً** (`localStorage` حصراً، صفر استعلامات DB) —
> فتتصادم كتاباتهم مع كاتب الماسح/عمليات الأدمن وتنتهي بانتظار `busy_timeout` (30 ثانية) أو فشل `SQLITE_BUSY`.
> **الحالة:** جميع الاكتشافات N20–N29 أدناه **عولجت** عبر المرحلة 3.7 (عمود «الحالة» + خطة §3.5 + §10).

| # | الاكتشاف | الموقع | الخطورة | الحالة |
|---|---|---|---|---|
| N20 | **`VACUUM INTO` للنسخ الاحتياطي يُنفَّذ على الاتصال الرئيسي المشترك** (`db.run` عبر `getDatabase()`) — عملية نسخ كامل للقاعدة تحبس الاتصال الوحيد الذي تستخدمه كل طلبات HTTP خلفها. الحارس `guardAgainstActiveScan` يمنع أثناء المسح **فقط**، ولا يوجد أي حارس ضد **عملاء نشطين يتصفحون**. النسخ التلقائي (كل 24 ساعة افتراضياً) يتخطى المسح فقط أيضاً. → تهنيج الموقع كاملاً عند نسخ احتياطي أثناء تصفح العملاء. | `database-repository.ts:53-56`, `database-service.ts:125-142`, `auto-backup-scheduler.ts:78-95` | 🔴 | ✅ 3.5.1 |
| N21 | **`deleteLibrary` يفتح `BEGIN TRANSACTION` على الاتصال الرئيسي** (وليس اتصال الكاتب) ويحذف مكتبة كاملة (آلاف الصفوف عبر DELETEs تسلسلية) — طوال المعاملة يحبس قفل الكتابة ويحجز الاتصال المشترك → تهنيج كل العملاء أثناء حذف مكتبة كبيرة. لم يُستثنَ من حارس المسح أيضاً. | `library-service.ts:552-624` (`db.run("BEGIN TRANSACTION")` :557) | 🔴 | ✅ 3.5.2 |
| N22 | **كتابات العملاء أثناء مسح نشط**: كل مشاهدة عميل = `INSERT activities` + `incrementViewCount` على الاتصال الرئيسي (`view-publisher.ts`). **تقدم المشاهدة غير مكتوب في القاعدة إطلاقاً** — `localStorage` حصراً (صفر استعلامات DB، `video-player.tsx:75`)، ومسارات `/api/progress` بلا مستهلك فعلي (يتيمة). تسجيل الدخول أيضاً يكتب (موثق في الكود نفسه: `auth-service.ts:130-156` "السبب الجذري لفشل الدخول العابر الملاحَظ أثناء المسح"). عند تصادم مع كاتب الماسح: انتظار حتى `busy_timeout` (30 ثانية) ثم `SQLITE_BUSY` — `executeWithRetry` (3 محاولات، 100/200/400ms) **يقلل الفشل لكنه لا يزيل التجميد** للطلبات المتزامنة. | `view-publisher.ts:83-111`, `auth-service.ts:135-156`, `db.ts:571` (busy_timeout), `video-player.tsx:75` (تقدم = localStorage) | 🔴 | ✅ 3.5.4 |
| N23 | **`restoreBackup` يغلق الاتصالين كلياً** (`closeDatabase()`) ثم يستبدل ملف القاعدة — أي طلب عميل أثناء نافذة الاستعادة يفشل/يعلق (لا قفل على القاعدة). مقبول بوصفه انقطاعاً مخططاً (يتطلب إعادة تشغيل) لكن دون أي تنبيه للعملاء المتصلين. | `database-service.ts:208-237`, `db.ts:683-696` | 🟠 | ✅ 3.5.5 |
| N24 | **عمليات ثقيلة إضافية على الاتصال الرئيسي المشترك**: `truncateAll` (تصفير: DELETE لكل جدول) و`getTables` (سلسلة `COUNT(*)` لكل جدول) — كلاهما على `getDatabase()` مباشرة. مخفّفة بالكاش (60 ثانية) لكنها تحبس الاتصال أثناء تنفيذها. | `database-repository.ts:34-46`, `:65-80` | 🟠 | ✅ 3.5.3 |
| N25 | **`rebuildIndex` (FTS) صحيح الاتجاه لكنه لا يكفي**: نُقِل إلى اتصال الكاتب (`runInWriterContext`، `search-service.ts:136`) — جيد للقراءات، لكنه يمسك **قفل كتابة WAL** طوال إعادة البناء الكاملة (DELETE+INSERT لكل `media_items`) → كتابات العملاء تتجمد خلفه أثناءها. الحارس يمنع المسح فقط. | `search-service.ts:123-139`, `search-repository.ts:83` | 🟠 | ✅ 3.5.6 |
| N26 | **إنشاء/تعديل المكتبات والأقسام** (`createLibrary`/`updateLibrary` — إظهار/إخفاء قسم، النوع، اللغة، الصورة، `linked_library_id`): تُنفَّذ على الاتصال الرئيسي المشترك (`library-service.ts` يستورد `getDatabase`) — خفيفة (صف واحد) لكنها **كتابة أدمن يومية** تتنافس مع القراءات وقد تتصادم مع كاتب الماسح أثناء المسح. الحذف الثقيل مغطى في N21. | `library-service.ts:177-292` (يمر عبر `libraryRepo` على الرئيسي) | 🟠 | ✅ 3.5.7 |
| N27 | **المحتوى الحصري** (`exclusive_items`) يُحفظ عبر `PUT /api/settings` → `updateSettings` → `settingsRepo.upsertSetting` على **الاتصال الرئيسي** — كتابة صغيرة (صف إعداد) لكنها من **التحكم بالمحتوى الحصري** الذي يغيّره الأدمن أثناء تصفح العملاء. | `settings-service.ts:77-91`, `use-exclusive-items.ts:44-58` | 🟡 | ✅ 3.5.8 |
| N28 | **قبول/رفض الإثراء بموافقة إدارية**: `approveEnrichment`/`rejectEnrichment`/`approveAllPendingEnrichments` — تطبيق الإثراء نفسه يعمل على الكاتب (`_applyEnrichmentFromDetails` داخل `runInWriterContext` :838)، لكن **تحديث حالة الموافقة** (`approvalRepo.updateStatus`) يُنفَّذ في كتلة كاتب **منفصلة** (`:1430/1438/1449`) → تصادم كاتِب-كاتب محتمل بين كتلة الإثراء وكتلة الحالة عند التسلسل. النسبة قليلة أصلاً لكن التوحيد يزيل الاحتمال. | `tmdb-enrichment-service.ts:1404-1474` | 🟡 | ✅ 3.5.9 |
| N29 | **خدمة الترجمة** (`translateItem`/`processBatch` — تحديث حقول العنصر + أسماء الأشخاص/الشخصيات): الكتابة تُنفَّذ على **الاتصال الرئيسي** (`translation-service.ts` يدعو `mediaRepo.update`/`batchUpdatePersonNames`/`batchUpdatePersonCharacters` مباشرة دون `runInWriterContext`) — الترجمة الدفعية (حتى 500 عنصر) أثناء تصفح العملاء تُبقي كل كتاباتها على الاتصال المشترك وتتصادم مع كاتب الماسح. | `translation-service.ts:333,340,352` + `:397-459` (processBatch) | 🟠 | ✅ 3.5.10 |

### 3.5 خطة العزل والاستجابة الفورية (عزل قراءة العملاء عن كتابة الأدمن)

> **الهدف:** صفر إحساس بالثقل/الانقطاع للعملاء أثناء **كل** عمليات الأدمن: مسح المكتبات،
> إثراء البيانات الوصفية (TMDB)، النسخ الاحتياطي، الحذف الكامل، إعادة بناء البحث، إعادة
> الترقيم. الخطة تعتمد على البنية القائمة (اتصالا `main`/`writer` + WAL) ولا تُدخل أي
> اعتماد جديد — فقط **نقل كل عمليات الكتابة الثقيلة إلى اتصال الكاتب** و**جعل أي كتابة
> تتصادم مع الكاتب تفشل فوراً (fail-fast) بدل الانتظار 30 ثانية**.
> **✅ نُفِّذت بالكامل (المرحلة 3.7):** كل البنود 3.5.1–3.5.10 مطبَّقة ومتحقَّق منها — التفاصيل والتحقق في §10.

#### أ) المبدأ الفيزيائي الحاكم (يجب فهمه أولاً)

| المبدأ | المعنى العملي |
|---|---|
| WAL = **كاتب واحد + قراء متزامنون** | قراءات العملاء على `main` **لا تتأثر أبداً** بكاتب الماسح على `writer` (القراءة لا تنتظر قفل الكتابة) |
| **المشكلة الوحيدة هي الكتابات** | كاتب الماسح يمسك قفل كتابة WAL أثناء المعاملات → كتابات العملاء/الأدمن الأخرى تنتظر `busy_timeout` أو تفشل `SQLITE_BUSY` |
| عمليات ثقيلة على الاتصال المشترك | أي `VACUUM INTO`/`BEGIN TRANSACTION`/`DELETE` كبير على `getDatabase()` يحبس **كل** طلبات HTTP خلفه (اتصال واحد مُصفَّر) |

#### ب) خريطة العلاج (كل بند يزيل مصدر ثقل محدَّد) — ✅ **منفَّذة بالكامل (2026-08-16)**

| الإجراء | يستبدل/يصحح | يضمن | الحالة |
|---|---|---|---|
| **3.5.1** نقل `VACUUM INTO` (النسخ الاحتياطي) إلى **اتصال كاتب** (نفس اتصال الماسح أو اتصال منفصل مخصص) بدل الاتصال الرئيسي | N20 | القراءات لا تنتظر النسخ؛ يُحظر فقط أثناء المسح (كقاعدة تنافس كاتِب-كاتب) | ✅ |
| **3.5.2** نقل `deleteLibrary` من `BEGIN TRANSACTION` على الرئيسي إلى **`runInWriterContext` + `withExclusiveTransaction`** (نمط الماسح القائم: SAVEPOINT + دفعات) | N21 | حذف مكتبة كاملة لا يحبس الاتصال المشترك؛ القراءات حرة | ✅ |
| **3.5.3** نقل `truncateAll` + `getTables` إلى **`runInWriterContext`** | N24 | تصفير القاعدة/إحصاءاتها لا يحبسان طلبات HTTP | ✅ |
| **3.5.4** **Fail-fast لكتابات العملاء**: تعليق `executeWithRetry` المتدرّج بـ `busy_timeout` قصير (مثلاً 200-500ms) لمسارات المشاهدة والدخول بحيث **تنتهي الكتابة فوراً بالنجاح أو برفض سريع** بدل الانتظار 30 ثانية. **تقدم المشاهدة خارج النطاق أصلاً** (localStorage حصراً — صفر كتابة DB) | N22 | زائر يفتح صفحة/يسجل دخولاً أثناء المسح: بلا تجميد؛ يُسجَّل الحدث فوراً أو يُرفض بهدوء (`view-publisher` تلتقط الفشل وتتجاهله) | ✅ |
| **3.5.5** `restoreBackup`: إبقاء سلوك إغلاق الاتصالين لكن **بفصل النافذة الحرجة**: تحذير العملاء عبر حالة «صيانة» (SSE `/api/admin/events`) قبل الإغلاق، واستعادة الاتصالين تلقائياً دون انتظار إعادة تشغيل | N23 | انقطاع مخطط ومعلَن قصير بدل انقطاع صامت | ✅ |
| **3.5.6** `rebuildIndex`: تعليق داخل **دفعات صغيرة** (batch مع `setImmediate` بينها) على اتصال الكاتب | N25 | نوافذ إصدار قفل الكتابة بين الدفعات → كتابات العملاء تنفذ خلالها | ✅ |
| **3.5.7** **إنشاء/تعديل المكتبات والأقسام** (`createLibrary`/`updateLibrary` — إظهار/إخفاء قسم، النوع، اللغة، الصورة) تُنفَّذ على الرئيسي حالياً → نقلها إلى **`runInWriterContext`** (نفس نمط `updateMetadataManually`/`approveEnrichment`). الحذف يشمل 3.5.2 | N21 (جزء) + كتابة أدمن يومية | تعديل الأقسام أثناء تصفح العملاء: صفر تهنيج؛ خفيفة أصلاً لكن عزلتها تزيل أي تصادم | ✅ |
| **3.5.8** **المحتوى الحصري** (`exclusive_items` عبر `PUT /api/settings` → `updateSettings` → `upsertSetting`) يُكتب على الرئيسي حالياً → نقل إلى **`runInWriterContext`**. لا يُحظر عند المسح (يكتب صف إعداد واحد فقط) لكن يُعزل عن القراءات | كتابة أدمن على `settings-service.ts:77-91` | تعديل قائمة الأقسام/المحتوى الحصري لا يحبس طلبات العملاء | ✅ |
| **3.5.9** **قبول/رفض الإثراء بموافقة إدارية** (`approveEnrichment`/`rejectEnrichment`/`approveAllPendingEnrichments`): الإثراء نفسه يعمل على الكاتب بالفعل عبر `runInWriterContext` (`tmdb-enrichment-service.ts:838`)، لكن **تحديث حالة الموافقة** يُنفَّذ في `runInWriterContext` منفصل (`:1430/1438/1449`) → التوحيد في كتلة كاتب واحدة يزيل تصادم كاتب-كاتب بين كتل الإثراء والحالة. نسبة الموافقات قليلة أصلاً | كتابة أدمن على `tmdb-enrichment-service.ts:1404-1474` | قبول إثراء أثناء تصفح العملاء: الكتابة كلها على الكاتب + عملية واحدة متسلسلة | ✅ |
| **3.5.10** **خدمة الترجمة** (`translateItem`/`processBatch` — تحديث حقول العنصر + أسماء الأشخاص/الشخصيات): الكتابة تُنفَّذ على الرئيسي حالياً (`translation-service.ts:333,340,352`) → نقلها إلى **`runInWriterContext`** + دفعات مع `setImmediate` بين العناصر (عند batch) | كتابة أدمن على `translation-service.ts:397-459` | ترجمة دفعية أثناء تصفح العملاء: كل الكتابة على الكاتب، القراءات حرة، والقفل يُطلق بين العناصر | ✅ |

#### ج) نموذج الضمان النهائي (بعد تنفيذ 3.5.1–3.5.10 — ✅ منفَّذ)

```
عميل يتصفح (main)          أدمن ينفذ (writer)
─────────────────────      ─────────────────────
SELECT ... (قراءة)  ──┐     scan/enrich/backup/delete ──┐
SELECT ... (قراءة)  ──┼──►  libraries/sections/edit ────┼──►  كلها عبر
INSERT (مشاهدة)  ──┐  │     exclusive_items ────────────┤    runInWriterContext
      fail-fast ───┴──┴──►  enrich approve/reject ──────┤    + دفعات
      (200ms ثم نجاح/رفض)   translation batch ──────────┘    + إصدار قفل
تقدم المشاهدة = localStorage  (صفر كتابة DB أصل)
```

- **القراءات**: لا تنتظر أبداً (WAL) — حتى أثناء مسح/إثراء/نسخ/ترجمة/تعديل أقسام.
- **الكتابات**: لا تتجاوز 200-500ms ثم إما نجحت أو رُفضت بهدوء (تُعاد عبر طابور/تُسقَط حسب الحساسية).
- **العمليات الثقيلة**: جميعها على الكاتب + دفعات صغيرة → نوافذ كتابة منتظمة للعملاء.
- **كتابات الأدمن اليومية** (المكتبات/الأقسام/المحتوى الحصري/الموافقات/الترجمة): كلها معزولة على الكاتب.
- **تقدم المشاهدة**: خارج النطاق أصلاً — `localStorage` حصراً (صفر استعلامات DB، صفر تحميل على SQLite، استجابة 0ms، وعزل تام عن عمليات الأدمن).

#### د) شروط عدم التطبيق (متى لا تكفي الخطة)

- مكتبة واحدة بعشرات آلاف العناصر تُمسح من صفر (المسح نفسه يعمل بدفعات على الكاتب أصلاً — لا تُلمس القراءات).
- استعادة نسخة احتياطية ضخمة: الإغلاق الحتمي يُخفَّف بالحالة المعلنة (3.5.5) لا بالإزالة.

---

## 4) جدول المقارنة: Full-Stack Next.js مقابل Decoupled

| البُعد | Full-Stack (الراهن) | Decoupled (API منفصلة) |
|---|---|---|
| **عدد العمليات/النشر** | عملية واحدة (Next standalone + nssm) — تطابق Installer الحالي | خادمان (API + الواجهة) — Installer مزدوج وتعقيد إدارة |
| **قوة** | جاهز ويعمل؛ زمن تطوير منخفض؛ إعادة تحميل حرارية؛ typescript واحد عبر الحدود | فصل صارم؛ إعادة استخدام عبر عملاء متعددين؛ توظيف فرق منفصلة |
| **ضعف** | اقتران الواجهة بالخادم داخل نفس التطبيق؛ صعوبة خدمة عملاء خارجيين جاهزاً | CORS + Secure-cookies + مزامنة إصدارات + إدارة مفاتيح + نشر مزدوج |
| **المناسب هنا** | ✅ **مناسب جداً**: SQLite محلي، LAN واحد، بدون مستهلك خارجي، Installer موحّد | ❌ غير مناسب حالياً: **صفر** `Access-Control-Allow-Origin` في الكود → `CORS_ORIGINS` (`env.ts`) كود ميت يثبت غياب حاجة فعلية |
| **الأثر على الخطة** | تنظيف داخلي (توحيد العملاء + سد التسريبات) — هذه الورقة §7 | تأجيل إلى وجود عميل/API مفتوح حقيقي (انظر §7 المرحلة 4 الاختيارية) |

### القاعدة الحاكمة
> الاختيار بين البنيتين يُحسم بالحاجة الفعلية للمستهلك الخارجي، لا بالتفضيل التقني.
> حالياً لا يوجد أي مستهلك خارجي — لذا **Decoupled يعالج مشكلة غير موجودة** بثمن بنيوي مباشر.

---

## 5) التوصية

- **البقاء على Full-Stack Next.js** (الوضع الراهن) مع **توحيد عميل HTTP واحد** و**ترحيل الـ fetch الخام** و**إغلاق تسريبات الطبقات**.
- استثناءات البنية المقبولة (تُوثّق ولا تُكسر): `/api/health`، `/api/auth/verify-admin`، `/api/admin/events` (SSE) — **لكن** يجب نقل استدعاء `new ScanController` خارج معالجات الـ route إلى `getControllers().scan`.
- **لا حاجة لأي اعتماد جديد** (OpenAPI/Postman) إلا عند فتح واجهة API خارجية (Phase 4 اختيارية).

---

## 6) خريطة التبعية لربط الـ SSOT (ماذا يُعدّل دون كسر)

> قاعدة صارمة: كل تغيير في دالة/نوع/عقد يجب أن يسبقه فحص كل المستهلكين. خريطة المستهلكين المؤكدة:

| الأصل | المستهلكون الموثقون |
|---|---|
| `cn` في `lib/utils.ts` | 47 استيراداً (مكونات UI + صفحات viewer/admin) — **المصدر الوحيد** |
| `ROUTES` | 26 استيراداً من `@/shared/constants` |
| `DEFAULT_IMAGES` | `search-modal.tsx:108`, `section-card.tsx` (features/viewer/components/sections/), `library-card.tsx:80` |
| `getDeviceId` | `use-visitor-request.ts:2` |
| `getUniqueCrewByRole` | `item-detail-page.tsx:487` |
| `ExclusiveSettingItem` | `shared/types/settings.ts` (يُقرأ في admin عبر `useExclusiveItems`) |
| `AdminSettings` | `use-admin-settings.ts:3`, `use-exclusive-items.ts` |
| `ScanProgress` | `use-admin-libraries.ts`, `use-scan-events.ts` |

---

## 7) خطة التنفيذ المعتمدة (Roadmap)

| المرحلة | المحتوى | الاكتشافات المعالجة | التحقق |
|---|---|---|---|
| **0 — تجميد القواعد** | إضافة بند AGENTS: «عميل HTTP واحد عبر `@/lib/frontend/api-client`؛ ممنوع `fetch` خام إلا باستثناء موثق» | — | typecheck + lint |
| **1 — توحيد عميل HTTP** | **✅ منفَّذة ومتحقَّق منها (2026-08-16).** دُمج `api.ts` + `api-client.ts` في `api-client.ts` واحد: `apiFetch`-family تُرجع `ApiResponse<T>` كاملة (تتوافق مع 17 هوك أدمن الذين يفحصون `.success` يدوياً) مع إضافة `credentials: "include"` + دعم `FormData` + `ApiError` عند `!response.ok`؛ `apiClient` (4 مستهلكين) يُعيد `.data` المفرّغ بمسارات نسبية. حُذف `api.ts`، حُدّث الباريل `index.ts`، حُوّلت 17 استيراداً للهوكات، وترحيل مواقع `fetch` الخام ذات `FormData` (رفع الصورة `use-admin-users.ts` + استعادة النسخة `use-admin-database.ts`) إلى `apiPost`. نُقلت `@deprecated` في `use-admin-ads.ts` (حُذفت `AdminAd` + `useCreateAdminAd`/`useUpdateAdminAd`/`useDeleteAdminAd` بعد ترحيل `ads-page.tsx` إلى `AdItem` + `useCreateAd`/`useUpdateAd`/`useDeleteAd`). **استثناء موثق:** `use-admin-license.ts` يبقي `licenseRequest` المخصص (غلاف `LicenseEnvelope` + تفضيل `message` العربي على `error`) | N2, N16, `02` H2, `06` M2, L5 | typecheck ✅ + lint ✅ + test ✅ 147/147 + build ✅ |
| **2 — ترحيل الـ fetch الخام** | **✅ منفَّذة ومتحقَّق منها (2026-08-16).** جُردت مواقع `fetch` الخام (29 موضعاً) وصُنّفت: **6 مواقع رُحّلت إلى `api-client`** — `use-visitor-request.ts` (`apiPost` لإرسال طلب)، `media-queries.ts:316` (`apiFetch` لفحص الفيديو)، `auth-context.tsx` ×4 (`apiFetch` لتحميل المستخدم/التحديث + `apiPost` للدخول + `apiDelete` للخروج مع تجاهل أخطاء الخادم). **استثناءات موثقة أُبقيت كما هي:** `video-player.tsx:167` (`keepalive` لمنارة المشاهدة — يفرضه التقرير)، `use-open-folder.ts`/`use-folder-picker.ts` (وكيل خارجي على منفذ 5199 وليس واجهة المشروع)، `use-admin-license.ts:55` (استثناء المرحلة 1). **خارج النطاق (خادم/خارجي):** `proxy.ts:66` + TMDB/live/image services. أما `refetch()` في React Query فليست `fetch` خاماً | N16 | typecheck ✅ + lint ✅ + test ✅ 147/147 + build ✅ |
| **3 — إغلاق تسريبات الطبقات** | **✅ منفَّذة ومتحقَّق منها (2026-08-16).** عائلة scan (8 مسارات) → `getControllers().scan` بدل `new ScanController` داخل معالجات الـ route؛ أُصلح تجاوز `scanAll` للـ DI (كان يستدعي `getServices()` داخلياً)؛ أُنشئ `EventsController` (history/clearHistory/security) وحُوّلت نقاطا نهاية أحداث الأدمن إليه؛ استُخرج حارس `(viewer)/layout.tsx` إلى `ViewerAccessService` (قراءة الإعدادات + التحقق من الجلسة + تتبع الزوار Best-Effort)؛ أُضيف `setWatcher` إلى `ScanController` (نقل watcher داخل DI). **استثناءات موثقة أُبقيت:** health/verify-admin/SSE (`/api/admin/events` + `scan-events`) — وحُدّثت توثيقاتها؛ `06` M3 (ازدواج هوكَي SSE) موثق كاستثناء مقبول (صفحتان منفصلتان، لا تداخل فعلي) | `04` M1, `06` M3 | typecheck ✅ + lint ✅ (ملفات معدَّلة) + test ✅ 147/147 + build ✅ |
| **3.5 — توحيد الطبقة المشتركة** | **✅ منفَّذة ومتحقَّق منها (2026-08-16).** §8-N15 (نقل هوكَي Folder Picker إلى `src/lib/frontend/hooks/` دون دمج + حذف 5 `console.log` + تحديث TSDoc)، حذف القشرات الفارغة (`src/shared/hooks/` — 4 ملفات فارغة + readme)، حذف الثوابت الميتة (`API_ROUTES`/`PAGINATION`/`USER_ROLES` في `shared/constants` + `shared/utils/index.ts` بلا مستهلكين)، توحيد `ExclusiveItem` بتمديد `ExclusiveSettingItem` (مع إصلاح TSDoc المصدر)، إزالة الاعتماد العكسي في `crew-helpers.ts` (نوع `CrewMember` محلي بدل استيراد `MediaItem`)، وتنظيف الضوضاء (تعليقات `// ←` وكتلة `useUploadMediaImage` المحذوفة في `use-admin-media.ts` + 3 تعليقات مسار + `Producer: "منتج"` + حذف تعليق N12). **استثناء موثق:** نسختا `formatDate`/`formatDateTime` المحليتان في `person-detail-page.tsx` و`user-detail-modal.tsx` قيد الاستخدام وخارج نطاق الحذف | N7-N12, N17 | typecheck ✅ + lint ✅ (ملفات معدَّلة) + test ✅ 147/147 + build ✅ |
| **3.6 — إزالة تكرار أحداث الحظر** | **✅ منفَّذة ومتحقَّق منها (2026-08-16).** القرار (§9-6): إزالة تسجيل `block_user`/`unblock_user` من `activities` والاكتفاء بـ `security_events` (`user_blocked`/`user_unblocked`) — تماشياً مع الترحيل 008 («القيمة الأمنية الحقيقية تبقى في `user_blocked`/`user_unblocked`») ومع **قرار المستخدم**. تبقى تسميات `ACTION_LABELS` (`block_user`/`unblock_user`) في `events-page.tsx` لقراءة السجلات التاريخية السابقة فقط. فُحص مستهلكو `activities`/`security_events` بالكامل (§6) — لا قراءة برمجية لـ `block_user`/`unblock_user` خارج تسميات العرض. | N19 | typecheck ✅ + lint ✅ + test ✅ 147/147 + build ✅ |
| **3.7 — عزل العمليات الثقيلة عن الاتصال الرئيسي** | **✅ منفَّذة ومتحقَّق منها (دفعتان، 2026-08-16).** خطة العزل §3.5 (تفصيلي): 3.5.1 `VACUUM INTO`→اتصال كاتب؛ 3.5.2 `deleteLibrary`→`runInWriterContext`+`withExclusiveTransaction`؛ 3.5.3 `truncateAll`/`getTables`→`runInWriterContext`؛ 3.5.4 **fail-fast لكتابات العملاء** (`withClientWriteFailFast` — مشاهدة/دخول فقط؛ تقدم المشاهدة localStorage أصلاً)؛ 3.5.5 `restoreBackup` بإعلان صيانة عبر `system_alert` (SSE) قبل/بعد الاستعادة؛ 3.5.6 `rebuildIndex` بدفعات + `setImmediate`؛ **3.5.7 المكتبات/الأقسام، 3.5.8 المحتوى الحصري، 3.5.9 موافقات الإثراء (توحيد كتلة كاتب واحدة)، 3.5.10 الترجمة** → كلها على الكاتب. الملاحظة: القياس (`SLOW_QUERY_MS` + `db.slow_statement` + `db.busy_detected`) يبقى اختيارياً لاحقاً لتأكيد الأثر بعدياً | N20-N29 | typecheck ✅ + lint ✅ (ملفات معدَّلة) + test ✅ 147/147 + build ✅ |
| **4 — (اختياري) عقد API خارجي** | OpenAPI/Postman + اختبار Bearer token — **يُنفَّذ فقط عند وجود مستهلك خارجي حقيقي** | — | — |
| **5 — تنظيف CORS** | حذف `CORS_ORIGINS`/`getCorsOrigins` — **يتطلب موافقة صريحة** | env.ts | typecheck |

---

## 8) قرارات المستخدم (معتمدة)

> **قرار N15 — هوكيا Folder Picker: إصلاح المكان دون الدمج.**
> - **مقبول:** نقل الهوكين إلى موضع مشترك (المكان المستهدف `src/lib/frontend/hooks/`) بحيث لا
>   تتكرر صيغة `NEXT_PUBLIC_FOLDER_PICKER_URL || http://localhost:5199` في موضعين.
> - **مرفوض:** دمج `useOpenFolder` و`useFolderPicker` في هوك واحد. يبقى `useOpenFolder`
>   (يفتح مجلداً في Explorer — يستخدمه viewer) و`useFolderPicker` (يختار مجلداً — يستخدمه
>   admin Library Form) **هوكين منفصلين** لهما نية مختلفة.
> - **التنفيذ عندها:** ينتقل الملفان إلى `src/lib/frontend/hooks/` مع تحديث مسارات الاستيراد
>   في `media-actions.tsx:10` و`library-form.tsx:17` فقط، وحذف `console.log` الخمسة
>   في `use-open-folder.ts` (نفايات)، وتحديث TSDoc، وإبقاء readme الأصلي خارج `src/shared/hooks`
>   (نص وصفي يُحذف مع القشرات الفارغة في المرحلة 3.5).

---

## 9) أسئلة مفتوحة (تحتاج تأكيداً قبل التنفيذ)

1. **ترتيب التنفيذ:** هل يبدأ العمل بـ **Phase 1 ثم 2** مباشرة، أم ينتظر اعتماد الوثيقة؟
2. **`use-admin-processes` مقابل `use-admin-libraries` (N13):** أيّهما المستهلك الفعلي للشاشات؟
   هل يُدمج الفحوص في دالة واحدة مشتركة، أم يبقى كل هوك في موضعه مع هوك أساسي واحد مشترك؟
3. **`excludeTypes` في `use-admin-media.ts:114`** (من `00-overview` Open Question 2): هل توجد قائمة
   أنواع معتمدة مركزيّة تُقرأ منها؟
4. **`tags` من `genres`** (Open Question 4 في `00-overview`): نفس الحقل أم مختلفان؟
5. **`apiClient` في `media-selector-modal.tsx`** (Open Question 5): هل التحويل لـ`apiFetch` مقبول؟
6. **تكرار أحداث الحظر (N19):** ~~هل الحل هو إزالة تسجيل الحظر من `activities` (الاكتفاء بـ `security_events`
   — متسق مع الترحيل 008)، أم الفلترة العرضية في `events-page.tsx` (إبقاء التسجيل المزدوج للنشاط
   التاريخي)~~ — **مقرر ومُنفَّذ ✅:** **إزالة تسجيل `block_user`/`unblock_user` من `activities`** والاكتفاء
   بـ `security_events`، وفق **قرار المستخدم** أثناء التنفيذ. تبقى حادثة الحظر متاحة في سجل «أحداث
   الأمان» فقط؛ السجلات التاريخية في `activities` لا تُمسّ وتُقرأ بتسميات `ACTION_LABELS` القائمة.
7. **أثر عمليات الأدمن على العملاء (N20-N29):** ~~هل تُعالج دفعة واحدة في Phase 3.7، أم يُبدأ بقياس فعلي~~ — **مقرر ومُنفَّذ ✅:** عولجت كلها في المرحلة 3.7 على دفعتين (3.5.1–3.5.4 ثم 3.5.5–3.5.10) دون قياس مسبق؛ القياس (`SLOW_QUERY_MS` + `db.slow_statement`/`db.busy_detected`) يبقى اختيارياً لتأكيد الأثر بعدياً.
8. **خطة العزل §3.5 — نطاق التنفيذ:** ~~هل تُنفَّذ كاملة في مرحلة واحدة أم على دفعتين~~ — **مقرر ومُنفَّذ ✅:** دفعتان (أ) 3.5.1–3.5.4 (نقل العمليات الثقيلة للكاتب + fail-fast)، ثم (ب) 3.5.5–3.5.10 (صيانة معلنة + دفعات + بقية كتابات الأدمن على الكاتب). كل دفعة متحقَّق منها بـ typecheck + lint + test + build.

---

## 10) الحالة والتحقق

- الوثيقة مبنية على **قراءة فعلية** (130 مساراً معدوداً، 17 ملف `lib/frontend`، 27 هوكاً، ملفات shared كلها) — لا تكهنات.
- جميع الاكتشافات هنا مربوطة بتقارير `docs/audits/00-overview.md` ← `06-features-admin.md`؛
  أي تعديل في الكود لاحقاً **يلزم أن يحدّث هذه الورقة** (حالة «مرجع معتمد للتنفيذ»).
- عند فتح أي مرحلة: تُلتقط خطوط الأساس (`typecheck`/`lint`/`test`/`build`) قبلها وبعدها،
  ويُحدَّث TSDoc لكل دالة معدّلة.

### ✅ المرحلة 3 — إغلاق تسريبات الطبقات — منفَّذة ومتحقَّق منها (2026-08-16)

- **عائلة scan → `getControllers().scan` (8 مسارات):** `libraries/[id]/scan`,
  `libraries/[id]/scan/{pause,resume,stop,progress}`, `libraries/scan-all`,
  `scan/processes`, `admin/validate-hierarchy` — كلها استبدلت
  `new ScanController(s.scanner, s.library)` بـ `const { scan } = getControllers()`.
  أُزيل `getServices()` من كل مسار (`04` M1). `scan/progress` أُبقي على `requireAuth`
  كما هو (`04` M2 خارج نطاق المرحلة — تغيير تصريحي مؤجل وموثق).
- **إصلاح تجاوز DI داخل `ScanController.scanAll`:** كان يستدعي `getServices().library`
  داخلياً — أصبح يستخدم `this.libraryService` المحقون (الطبقة الصارمة محفوظة).
- **`EventsController` جديد (`src/backend/controllers/events-controller.ts`):**
  يُغلّف `getHistory` (بمنطق تجميع `system`/`user` مطابق للمسار القديم حرفياً)،
  `clearHistory` (حذف `activities`)، `getSecurityEvents` (`security_events`).
  حُوّلت `admin/events/history/route.ts` (GET/DELETE) و`admin/events/security/route.ts`
  إليه — أُزيل تسريب `services.activity`/`services.security` من المسارات.
  `admin/events/route.ts` (SSE) و`scan-events/route.ts` (SSE) **بقيا استثناءً موثقاً**
  (وفق §5: لا تُكسر) — التزامات الـ 17 حدثاً والضغط الزمني بلا حاجة لنقلها.
- **watcher داخل DI:** أُضيف `setWatcher(id, active)` إلى `ScanController` (يستدعي
  `libraryMonitor.watchLibrary/unwatchLibrary` + يزامن `is_watched`) وحُوّل
  `libraries/[id]/watcher/route.ts` إليه (يبقي `requireAdmin` + `parseBody`).
  نُقل `LibraryMonitor` إلى مُنشئ `ScanController` في `controllers/index.ts`.
- **استخراج حارس الواجهة العامة:** `src/backend/services/viewer-access-service.ts`
  — `ViewerAccessService.evaluateAccess(input)` يجمع: قراءة `viewer_access_mode` +
  `maintenance_mode`، التحقق من رمز الجلسة (`auth.verifyToken`)، وتتبع الزوار
  Best-Effort (لا يُسقط الصفحة عند الفشل). `(viewer)/layout.tsx` أصبح نحيفاً:
  يجمع الكوكيز/الهيدرات فقط (يبقي `cookies()` للعرض الديناميكي) ويطبّق القرار
  (عرض `MaintenanceScreen` أو إعادة التوجيه `/login?callbackUrl=...`). رُبِط
  `viewerAccess` في `getServices()`.
- **`06` M3 — استثناء مقبول (بدون كود):** هوكّا `use-admin-events-sse.ts`
  و`use-admin-realtime.ts` يفتحان اتصالَي `EventSource` على `/api/admin/events`
  لكنهما على **صفحتين منفصلتين** (`events-page` / `items-control-page`) — لا يوجد
  اتصالان متزامنان فعلياً اليوم. الدمج = إعادة هيكلة أمامية بأولوية 🟠 (N14) وبدون
  عائد فوري؛ موثق هنا كتحسين مستقبلي اختياري.
- **التحقق:** `typecheck` ✅ | `lint` ✅ (الملفات المعدّلة نظيفة) | `test` ✅ 147/147
  (26 ملفاً) | `build` ✅ (115 صفحة).

### ✅ المرحلة 3.5 — توحيد الطبقة المشتركة — منفَّذة ومتحقَّق منها (2026-08-16)

- **§8-N15 (نقل هوكَي Folder Picker دون دمج):** نُقل `use-open-folder.ts`
  (من `features/viewer/hooks`) و`use-folder-picker.ts` (من `features/admin/hooks`) إلى
  `src/lib/frontend/hooks/` (الدليل أُنشئ حديثاً) — الاثنان يبقىان هوكين منفصلين بنيةً
  مختلفة. حُدِّث الاستيراد في `media-actions.tsx:10` و`library-form.tsx:17` فقط،
  حُذفت الـ 5 `console.log` (نفايات) من `use-open-folder.ts` (استُبدلت رسالة خطأ عربية
  للحالة الفارغة مع الحفاظ على عقد العودة `false`)، وحدّثنا TSDoc بالعربية مع إشارة
  إلى كونهما هوكين مشتركين. `src/lib/frontend/hooks` = موطنهما الوحيد الآن.
- **حذف القشرات الفارغة (`src/shared/hooks/`):** 4 ملفات فارغة
  (`use-infinite-scroll.ts`, `use-media-filters.ts`, `useDebounce.ts`, `useLocalStorage.ts`)
  + `readme.md` (كان يحوي ادعاءً خاطئاً بأن `useOpenFolder` مستخدم في الأدمن) — حُذفت كلها.
- **حذف الثوابت الميتة:** `API_ROUTES`/`PAGINATION`/`USER_ROLES` من
  `src/shared/constants/index.ts` (صفر مستهلكين — تحقَّق بالـ grep)؛
  `src/shared/utils/index.ts` (يُصدّر `cn`/`formatDate`/`formatDateTime` مكرّرة عن
  `lib/utils.ts` بلا أي مستورد للمؤشر الصريح) حُذف بالكامل — استيرادا
  `@/shared/utils/crew-helpers` و`@/shared/utils/device` يمرّان عبر الملفات المباشرة
  وليس المؤشر. نسختا `formatDate`/`formatDateTime` المحليتان المستخدمتان
  (`person-detail-page.tsx` / `user-detail-modal.tsx`) بقيتا — خارج نطاق الحذف.
- **توحيد `ExclusiveItem` (N10):** أصبح `ExclusiveItem extends ExclusiveSettingItem`
  (`@/shared/types/settings`) مع إبقاء حقول لوحة الأدمن الإضافية فقط
  (`id`, `video_url`, `rating`, `year` + تضييق `media_id?: number` و`sort_order: number`
  — تضييقان صحيحان نوعياً). حُدِّث TSDoc مصدر الحقيقة (كان يشير خطأً إلى
  `lib/frontend/api-media.ts`). الجسر `as ExclusiveItem[]` في `use-exclusive-items.ts`
  بقي — أصبح cast نزولي صحيحاً (البيانات المخزنة هي الشكل الإداري الأغنى).
- **إزالة الاعتماد العكسي (N11):** `src/shared/utils/crew-helpers.ts` كان يستورد
  `MediaItem` من `@/lib/frontend` (اعتماد من أدنى طبقة إلى أعلى). عُرف نوع `CrewMember`
  محلياً (متطابق بنيوياً مع عنصر `MediaItem["crew"]`) — التطابق البنيوي يُبقي استدعاء
  `getUniqueCrewByRole(media.crew ?? [])` ومكوّن `CrewMemberCard` آمنين نوعياً دون
  تغيير أي مستهلك.
- **تنظيف الضوضاء (N12 + N17):** حذف تعليق «أو "#" حسب الرغبة» في `shared/constants`;
  تصحيح `Producer: " منتج  "` → `"منتج"` في `crew-roles.ts:55`؛ في `use-admin-media.ts`:
  حذف كتلة `useUploadMediaImage` المحذوفة (تعليقاً) + تعليقات `// ←` الأربعة + فراغات
  ومسافات زائدة (حقول `ItemMetadataPayload`, `enrichMediaItem`, `useEnrichItem`)؛ حذف
  3 تعليقات مسار في ملفات هوكات الأدمن (`use-admin-messages.ts`,
  `use-admin-events-sse.ts`, `use-admin-visitor-requests.ts`). السلوك لم يتغير إطلاقاً.
- **التحقق:** `typecheck` ✅ | `lint` ✅ (الملفات المعدّلة 0 أخطاء) | `test` ✅ 147/147
  (26 ملفاً) | `build` ✅ (115 صفحة).

### ✅ المرحلة 3.7 — منفَّذة ومتحقَّق منها (2026-08-16)

- **الدفعة الأولى (3.5.1–3.5.4):** `VACUUM INTO`→كاتب (`database-repository.ts:backup`)،
  `deleteLibrary`→`runInWriterContext`+`withExclusiveTransaction` (`library-service.ts`)،
  `truncateAll`/`getTables`→كاتب (`database-repository.ts`)، fail-fast جديد
  `withClientWriteFailFast` (`db.ts`) مطبَّق على `view-publisher` (مشاهدة/عداد) و`auth-service`
  (جلسة/نشاط دخول). تقدم المشاهدة والمفضلة **خارج القاعدة أصلاً** (localStorage حصراً — لم تُلمس).
- **الدفعة الثانية (3.5.5–3.5.10):** `restoreBackup` يعلن نافذة صيانة عبر `system_alert` (SSE) قبل/بعد
  (`database-service.ts`)؛ `rebuildIndex` يطلق قفل الكاتب بين الدفعات بـ`setImmediate`
  (`search-repository.ts`)؛ `createLibrary`/`updateLibrary`→كاتب (`library-service.ts`)؛
  `updateSettings`→كاتب (`settings-service.ts`)؛ `approveEnrichment` وُحِّدت في كتلة كاتب واحدة
  (`tmdb-enrichment-service.ts` — N28)؛ الترجمة→كاتب + `setImmediate` بين العناصر
  (`translation-service.ts` — translatePeople/updateItemFields/processBatch).
- **التحقق:** `typecheck` ✅ | `lint` ✅ (ملفات معدَّلة 0 أخطاء؛ التحذيرات 3 موجودة مسبقاً) |
  `test` ✅ 147/147 (26 ملفاً) | `build` ✅ (115 صفحة، 12.3 ثانية).
- **حدود معروفة (غير مُعالَجة عمداً — خارج نطاق المرحلة):**
  - `search-repository.backfillMissing` يملك نمط حلقة الدفعات نفسه لكنه **لم يُعدَّل** (المراجعة ذكرت
    `rebuildIndex` فقط) — إضافة `setImmediate` له متاحة كتحسين اختياري لاحقاً.
  - `settings-service.resetSettings` لم يُنقَل للكاتب (إجراء أدمن نادر، خارج نطاق 3.5.8).
  - `deleteLibrary` يمسح جدول `user_progress` (سلوك قائم مسبقاً حُوفظ عليه)؛ الجدول **غير مستهلك** من
    الواجهة (المشغّل يستخدم localStorage) — إزالته من ترتيب الحذف قرار معلّق إن رغب المستخدم.

### ✅ المرحلة 3.6 — إزالة تكرار أحداث الحظر (N19) — منفَّذة ومتحقَّق منها (2026-08-16)

- **التغيير:** في `user-service.ts` → `blockUser`، أُزيل تسجيل `activityRepo.logActivity`
  (`block_user`/`unblock_user` على `activities` بـ `entityType:"system"`) وأُبقي
  `securityRepo.logSecurityEvent` (`user_blocked`/`user_unblocked` في `security_events`) فقط —
  وفق **قرار المستخدم** (إزالة من `activities`، الإبقاء على `security_events` فقط) وبما يتسق مع
  سابقة الترحيل 008.
- **التحقق من المستهلكين (§6):** لا توجد أي قراءة برمجية لـ `block_user`/`unblock_user` خارج
  `events-page.tsx` (`ACTION_LABELS` — تُبقيها قراءةً للسجل التاريخي السابق فقط، ولا تُحذف).
  بقيّة `activities` في الخدمة (إنشاء/تعديل/حذف مستخدم، صلاحيات) لم تتأثر. الترحيل 006/008
  غير معدَّلين (مطبّقان سابقاً).
- **التحقق:** `typecheck` ✅ | `lint` ✅ (`user-service.ts` نظيف) | `test` ✅ 147/147 (26 ملفاً) |
  `build` ✅ (115 صفحة).

### ✅ المرحلة 1 — توحيد عميل HTTP — منفَّذة ومتحقَّق منها (2026-08-16)

- **القرار المعماري:** `apiFetch`-family تُرجع **`ApiResponse<T>` كاملة** (لا بيانات مفرّغة) وتُرمي
  `ApiError` عند `!response.ok` فقط — **السبب الحاسم:** الهوكات الـ17 تفحص `.success`/`.data` يدوياً
  بعد كل استدعاء (82 موضعاً عبر الملفات)، وإرجاع بيانات مفرّغة كان سيكسرها. `apiClient`
  (4 مستهلكين: `api-search`/`api-media`/`use-live-channels`/`media-selector-modal`) يُبقي عقده
  (مسارات نسبية + إرجاع `.data` + رمي `Error` عند `!ok || !success`).
- **الملف الناتج:** `src/lib/frontend/api-client.ts` (مصدّرات: `ApiResponse`, `PaginatedResponse`,
  `ApiError`, `apiFetch`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `apiClient`).
  أُضيف `credentials: "include"` + دعم `FormData` (تخطّي Content-Type). حُذف `api.ts` وحُدّث الباريل
  `index.ts`.
- **الترحيل:** 17 هوك أدمن → الاستيراد من `api-client`؛ مواقع `fetch` الخام ذات `FormData`
  (رفع الصورة `use-admin-users.ts:uploadAdminAvatar` + استعادة النسخة `use-admin-database.ts`)
  → `apiPost`.
- **تنظيف `@deprecated`:** حُذفت `AdminAd` + `useCreateAdminAd`/`useUpdateAdminAd`/`useDeleteAdminAd`
  من `use-admin-ads.ts` بعد ترحيل `ads-page.tsx` إلى `AdItem` + `useCreateAd`/`useUpdateAd`/`useDeleteAd`.
- **استثناء موثق:** `use-admin-license.ts` يُبقي غلاف `licenseRequest` المحلي (غلاف `LicenseEnvelope`
  المخصص + تفضيل رسالة `message` العربية على `error`) — خارج نطاق توحيد العميل المشترك.
- **التحقق:** `typecheck` ✅ | `lint` ✅ (الملفات المعدّلة نظيفة) | `test` ✅ 147/147 (26 ملفاً) |
  `build` ✅ (115 صفحة، 13.1 ثانية).

### ✅ المرحلة 2 — ترحيل الـ fetch الخام — منفَّذة ومتحقَّق منها (2026-08-16)

- **الجرد:** 29 موضع `fetch` خاماً في `src` صُنّفت قبل التعديل (مبدأ trace-before-change): مواقع
  عميل قابلة للترحيل، استثناءات موثقة، مواقع خادم/خارجية خارج النطاق، ونداءات `refetch()`
  (React Query وليست `fetch` خاماً).
- **ما رُحِّل (6 مواقع):** `use-visitor-request.ts` (`apiPost` لإرسال طلب)، `media-queries.ts:316`
  (`apiFetch` لفحص الفيديو — `useVideoCheck`)، و`auth-context.tsx` ×4 (`apiFetch` لتحميل المستخدم
  عند التحميل + `refreshAuth`، `apiPost` للدخول، `apiDelete` للخروج مع تجاهل أخطاء الخادم — تُصفَّر
  الحالة محلياً دائماً).
- **استثناءات موثقة أُبقيت:** `video-player.tsx:167` (`keepalive` لمنارة المشاهدة — يفرضه التقرير)،
  `use-open-folder.ts`/`use-folder-picker.ts` (وكيل خارجي على منفذ 5199 وليس واجهة المشروع)،
  `use-admin-license.ts:55` (استثناء المرحلة 1 الموثق). **خارج النطاق (خادم/خارجي):** `proxy.ts:66`
  (Edge verify-admin) + استدعاءات TMDB/live-stream/image.
- **تحذيرات lint المتبقية (5) في `media-queries.ts`** هي استيرادات أنواع غير مستخدمة **سابقة الوجود**
  (`MediaItem`/`MediaFilterResponse`/`GenreItem`/`Person`/`Channel`) — لم تُلمس (ضمن الـ 63 تحذيراً
  الأساسية)، وليست ناتجة عن التعديل (تأكد `git diff`).
- **التحقق:** `typecheck` ✅ | `lint` ✅ (0 أخطاء في الملفات المعدّلة) | `test` ✅ 147/147 (26 ملفاً) |
  `build` ✅ (115 صفحة، 12.0 ثانية).
