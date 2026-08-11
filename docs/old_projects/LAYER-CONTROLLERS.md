# LAYER-CONTROLLERS — طبقة الـ Controllers (Application Layer)

> **الغرض:** توثيق طبقة الـ Controllers — دورها كوسيط بين Routes وServices، نمطها
> الموحّد، قاعدة `ControllerResult`، وقاعدة الـ Singletons عبر `getControllers()`.
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### الموقع والحجم

- المجلد: `src/backend/controllers/` — **20 Controller** + `index.ts` (الـ Registry).
- القائمة الفعلية (21 ملفاً): `ads, auth, dashboard, database, enrichment, image,
  library, media, messages, news, progress, report, scan, search, settings,
  store-products, translation, user, visitor` + `base-controller.ts` + `index.ts`.

### نمط الـ Singleton

- `getControllers()` في `src/backend/controllers/index.ts:44` يُنشئ كل Controller مرّة
  واحدة (lazy) ويمرّر له Services جاهزة من `getServices()`.
- خريطة الحقن الفعلية (`index.ts:48-71`):
  - `auth ← s.auth`، `media ← s.media`، `library ← s.library`، `user ← s.user`،
    `settings ← s.settings`، `dashboard ← s.dashboard`، `search ← s.search`،
    `progress ← s.progress`، `report ← s.report`، `database ← s.database`،
    `image ← s.image`، `visitor ← s.visitor`، `news ← s.news`، `messages ← s.messages`،
    `ads ← s.ads`، `storeProducts ← s.storeProducts`.
  - `enrichment ← new EnrichmentController(...)` (`:60`) و`translation` (`:66`) بحقن
    مركّب (عدة Services/Repositories).
  - `scan ← new ScanController(s.scanner, s.library)` (`:71`) — يستقبل Scanner وليس
    Service عادياً، ولهذا تستثني Routes الـ Scan النمط القياسي (راجع LAYER-API-ROUTES).

### قاعدة `BaseController` (`base-controller.ts`)

- **`ControllerResult`** (`:8`) — عقد الإخراج الموحّد:
  ```
  { success, status, data?, message?, error? }
  ```
- **مساعدات النجاح:** `ok` (`:17`, 200)، `created` (`:21`, 201).
- **مساعدات الخطأ:** `error` (`:25`, افتراضي 400)، `notFound` (`:29`, 404)،
  `unauthorized` (`:33`, 401)، `forbidden` (`:37`, 403).
- **أدوات تحقق المدخلات:**
  - `parseId(value)` (`:41-45`) — يرمي `"INVALID_ID"` عند غياب/قيمة غير صحيحة.
  - `parseNumber(value, fallback)` (`:49-51`).
  - `parseLimit(value, fallback=20)` (`:54-57`) — **يُقتطع عند 100**
    (`Math.min(n, 100)`) — قاعدة موحّدة لجميع Controllers.
  - `handleError(err)` (`:60-68`) — يترجم رسائل معروفة: `INVALID_ID`→400،
    `AUTH_REQUIRED`→401، `ADMIN_REQUIRED`→403، رسائل تنتهي بـ `" not found"`→404،
    غيرها→500.

### نمط الـ Action داخل Controller

```ts
async getMedia(ctx: RequestContext): Promise<ControllerResult> {
  try {
    const data = await this.service.getMedia(ctx);
    return this.ok(data);
  } catch (err) {
    return this.handleError(err);
  }
}
```

### أمثلة عقود مؤكدة (قراءة فعلية)

- **`auth-controller.login`** (`auth-controller.ts:10-18`): يفحص `username/password` فارغة،
  يرمي `ok(result)` عند النجاح؛ عند الخطأ يترجم: `"Account locked"` → **423**،
  `"Invalid credentials"` → **401**، غيرها → **500**. كما يملك `verify` (:25)،
  `logout` (:34)، `changePassword` (:43)، `register` (:56)، `isActive` (:64)، `countActive` (:69).
- **`dashboard-controller`**: كامل النقاط التسع عبر `parseLimit` (افتراضي 10/30 حسب النقطة).
- **`library-controller`**: `list, getById, create, update, delete, getGenres,
  getRatings, getStats, refreshCount, getContainers` — مع `notFound("Library not found")`.
- **`ads-controller`**: `listActive`/`list` بحد 50، `getById`, `create`.
- **`report-controller` / `scan-controller` / `media-controller`**: العقود كما في
  LAYER-API-ROUTES ومصفوفة المصادقة؛ `scan-controller.startScan` يتفرع
  (`scanContainer` لـ isContainer/type==="main" أو `startScan` العادية) ويعيد `accepted`
  برمز 202 بلا انتظار.

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### CON-01 — `startScan` في ScanController يفرغ من السياق الزمني (Phase 1)

- `scan-controller.ts:21-36`: يطلق `startScan`/`scanContainer` **fire-and-forget**
  (لا await للنتيجة، يرمي `accepted` فوراً). هذا مقصود (عمليات طويلة) لكن:
  - لا يُعاد `scanId` موثّق كجزء من عقد الاستجابة — الواجهة لا تملك طريقة قياسية
    لتتبّع تقدم العملية إلا عبر `/api/scan-events` أو `/api/progress` (التي تعيد تقدم
    المستخدم لا العمليات — انظر API-01).
- **المرحلة:** Phase 1 — Functional Integrity.
- **الاتجاه المقترح:** إرجاع `{ scanId, libraryId, accepted }` في الاستجابة، وربطه
  ببث EventBus.

### CON-02 — تكرار `new ScanController(scanner, library)` خارج الـ Registry (Phase 5)

- Routes `libraries/scan-all` و`libraries/[id]/scan` تنشئ Controller محلياً بدلاً من
  `getControllers().scan`. لا خرق وظيفي (المُنشئ خفيف)، لكنه كسر لقاعدة الـ Singleton.
- **المرحلة:** Phase 5 — Secondary Improvements.

### CON-03 — لا وجود لـ `updateMediaManually`/حقول التحقق في BaseController (Phase 3)

- تحقق الحقول المرسلة (مثل whitelist `ItemMetadataPayload` في `use-admin-media.ts`)
  يتم في الطبقات السفلى (انظر LAYER-SERVICES) لا في Controller؛ BaseController لا يملك
  أدوات Validate Generic. عند إضافة أي Controller جديد يجب اتباع نمط `handleError`
  حصراً وعدم إعادة تعريف أخطاء داخل الـ Controller.
- **المرحلة:** Phase 3/5 — ملاحظة توثيقية (لا إصلاح عاجل).

---

## 3. العقود المقدمة (Contracts Exposed)

- **الإخراج الوحيد:** `ControllerResult` — يُحوَّل إلى `NextResponse` عبر
  `toNextResponse` (`route-helpers.ts:133`) الذي يقرأ `success/status/data/error/message`.
- **المدخلات:** `RequestContext` (من `buildContext` في route-helpers.ts:121) —
  يشمل `{ request, auth?, ip? }` حسب ما يمرّره الـ Route.
- **الحدود:** لا يلمس Controller قاعدة البيانات مباشرة ولا يعرف NextResponse —
  يكتفي بإرجاع `ControllerResult`.

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي Controller جديد يجب أن يرث `BaseController` ويستخدم `parseId/parseLimit/handleError`.
2. لا تُنشئ Singleton خارج `getControllers()` إلا للاستثناءات الموثقة (Scan).
3. عند تغيير عقد استجابة: حدّث `toNextResponse` والواجهة المستهلكة معاً (راجع
   LAYER-API-ROUTES §4).
