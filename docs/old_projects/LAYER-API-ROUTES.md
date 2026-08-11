# LAYER-API-ROUTES — طبقة مسارات الـ API (Route Handlers Layer)

> **الغرض:** توثيق مسارات `src/app/api/**` — العدد، النمط القياسي، عقود المصادقة،
> والتعارضات المؤكدة بين ما تعلنه الـ Routes وما تتوقعه الواجهة (admin hooks).
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### الحجم والنمط

- **~140 Route Handler** موزعة على **19 route group** تحت `src/app/api/`.
- النمط القياسي لكل Handler (10-15 سطراً):

```ts
export async function GET(req: NextRequest, { params }: RouteContext<"id">) {
  const ctx = await buildContext(req);
  if ("error" in ctx) return toNextResponse(ctx);
  const { controller } = getControllers();
  const result = await controller.getAction(ctx, params);
  return toNextResponse(result);
}
```

- مساعدات النمط في `src/backend/api/route-helpers.ts`:
  - `buildContext(request, auth?)` — `:121` — يبني `RequestContext` (مع تحليل auth وIP).
  - `requireAuth(request)` — `:62` — يقرأ كوكي `session_token` ويزيل `AuthContext`.
  - `requireAdmin(request)` — `:68` — يفرض role admin.
  - `toNextResponse(result)` — `:133` — يحوّل `ControllerResult` إلى `NextResponse`.
  - `getQueryParam` `:74` / `getQueryNumber` `:81` / `parseBody` `:107` / `handleRouteError` `:92`.
- الاستثناءات الموثقة من النمط القياسي (تُنشئ Controller محلياً بدلاً من `getControllers()`):
  - `libraries/scan-all/route.ts` و`libraries/[id]/scan/route.ts` → `new ScanController(scanner, library)`.
  - `scan-events/route.ts` (SSE) → يستمع إلى EventBus لأحداث `scan_*`.

### مصفوفة المصادقة الفعلية (Auth Matrix — قراءة فعلية)

| المجموعة | GET | POST | PUT/PATCH | DELETE |
|---|---|---|---|---|
| `media` (قائمة) | عام → `getLatest`؛ `?admin=true` → requireAdmin | — | — | — |
| `media/[id]` | عام | — | **PATCH: requireAuth فقط** (`[id]/route.ts:38-47`) | requireAdmin (`:29`) |
| `media/[id]/stream` | عام + دعم Range (200/206/404/416) | — | — | — |
| `media-reports` | **requireAdmin** (`:5-17`) | **عام** (`:19-27`) | — | — |
| `media-reports/[id]/status` | — | — | PUT requireAdmin | — |
| `progress` | عام (يعيد تقدم المستخدم) | — | — | — |
| `progress/[mediaId]` | عام (null) | — | PUT requireAuth | — |
| `user` | requireAdmin (limit/offset) | requireAdmin (create) | — | — |
| `user/[id]` | requireAdmin | — | — | — |
| `dashboard/**` (9 نقاط) | requireAdmin (route.ts يعيد getStats) | — | — | — |
| `settings` | **عام** (getPublic) | requireAdmin | PUT requireAdmin | — |
| `settings/all`، `system/info` | requireAdmin | — | — | — |
| `messages` | requireAdmin (limit/offset/type/status/userId) | **عام** | — | — |
| `news` | عام (published=true أو limit/offset) | requireAdmin | — | — |
| `ads` | عام (active+position أو limit/offset) | requireAdmin | — | — |
| `store-products` | عام (categories=true أو limit/offset/category/active) | requireAdmin | — | — |
| `scan-events` (SSE) | requireAdmin + فلتر libraryId | — | — | — |
| `enrich/**` (17 نقطة) | إدارة (requireAdmin غالباً) | — | — | — |
| `translate/**` (7 نقاط) | إدارة | — | — | — |
| `database/**` (stats/optimize/backup) | requireAdmin | — | — | — |
| `auth` | — | POST login (يقرأ x-forwarded-for/x-real-ip، يضبط كوكي session_token httpOnly/sameSite=lax/maxAge=2h — `:40-48`) | — | — |
| `auth/verify-admin` | يتحقق JWT + role (401/403/200) | — | — | — |
| `auth/change-password` | — | POST (auth) | — | — |
| `images/[id]` | عام | — | — | — |
| `health` | عام | — | — | — |
| `search`، `search/live`، `search/years` | عام | — | — | — |
| `admin/events`، `admin/validate-hierarchy` | requireAdmin | — | — | — |

> **ملاحظات أمنية معتمدة للطبقات الأخرى:**
> - `GET /api/media` بلا `admin=true` يعيد `getLatest` **بلا pagination** وبلا فحص الصلاحية
>   للمحتوى غير المنشور — يحتاج مراجعة (Phase 2).
> - `POST /api/messages` و`POST /api/media-reports` عامة — مقصودة كنماذج عامة، لكن تحتاج
>   حماية Rate-Limit صريحة (Phase 2).
> - `PATCH /api/media/[id]` بلا requireAdmin — أي مستخدم مسجّل يستطيع تعديل بيانات
>   الوسائط (تعارض مع `DELETE` الذي يتطلب admin) — **مشكلة مؤكدة (Phase 2).**

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### API-01 — تعارض عقد `/api/progress` مع `use-admin-processes` (Phase 1)

- **المشكلة:** `use-admin-processes.ts:25` يستدعي `apiFetch("/api/progress")` ويتوقع
  `{ rows: ScanProcess[], total }` (الأشكال: `:15-16`، `:10`). لكن `progress/route.ts`
  يعيد **تقدم مشاهدة المستخدم** لا عمليات المسح، ويعيد `[]` عند عدم وجود auth.
- **الأثر:** شاشة «العمليات الجارية» تعرض بيانات خاطئة/فارغة دائماً.
- **المرحلة:** Phase 1 — Functional Integrity.
- **الاتجاه المقترح:** إنشاء نقطة `GET /api/libraries/[id]/scan/progress` أو
  `/api/scan/progress` تعيد بيانات `ScanState` الفعلية (تُقرأ عبر ScanOrchestrator)،
  أو تحويل الـ hook لاستخدامها.

### API-02 — عقود `{rows, total}` + `limit/offset` غير مدعومة في الـ Routes (Phase 1)

- **المشكلة:** هذه الـ hooks تتوقع `{rows,total}` مع `?limit=&offset=`:
  - `use-admin-reports.ts:16-17,25` → `/api/media-reports`
  - `use-admin-news.ts:15-16` → `/api/news`
  - `use-admin-ads.ts:18-19` → `/api/ads`
  - `use-admin-messages.ts:16-17` → `/api/messages`
  - `use-admin-store.ts:14-15` → `/api/store-products`
- لكن الـ Routes المقابلة **لا تقرأ** `limit/offset` (مثال موثق: `media-reports/route.ts:5-17`
  يمرر `ctx` فقط بلا فلتـر/صفحة).
- **الأثر:** الترقيم والفلاتر في لوحات الإدارة معطلة (أو تعرض كل الصفوف دفعة واحدة).
- **المرحلة:** Phase 1 — Functional Integrity.
- **الاتجاه المقترح:** توحيد عقد القوائم في الـ Routes على `{items,total,page,limit,hasMore}`
  (نفس عقد `getMediaByFilter` في `media-repository.ts:589`)، وتحديث الـ hooks لتستهلكه.

### API-03 — `GET /api/media` العام يعيد قائمة بلا pagination (Phase 2/4)

- `media/route.ts:13-39`: عند `adminList!=="true"` يُستدعى `getLatest(type, limit)`
  بلا فحص دور أو فلتـر نشر، وبحد أقصى `24` افتراضياً.
- **الأثر:** المحتوى غير المنشور/غير المتاح قد يظهر للعموم؛ وفتح القائمة الكاملة بلا
  ترقيم حمل غير محدود.
- **المرحلة:** Phase 2 (الخصوصية) / Phase 4 (الأداء).

### API-04 — `media-reports` GET بلا pagination مع `reporter_device_id` (Phase 4)

- `media-reports/route.ts` GET لا يقرأ `limit/offset` (المشكلة في API-02)، كما أن
  الإدراج يستخدم `reporter_device_id` (و**ليس** `device_id`) — لا يوجد عمود `device_id`
  في `media_reports`. أي كود قديم يرسل `device_id` يُفقد البيانات.
- **المرحلة:** Phase 4.

### API-05 — SSE `scan-events` بلا إعادة اتصال في العميل (Phase 4)

- `use-scan-events.ts:33` يوثق سلوك EventSource مع fallback صامت. الـ route (`scan-events`)
  تتطلب admin؛ عند انتهاء الصلاحية يسقط الاتصال بلا تجربة إعادة مع `Last-Event-ID`.
- **المرحلة:** Phase 4 — Performance/Reliability.

---

## 3. العقود المقدمة (Contracts Exposed)

- **استجابة موحّدة:** `{ success, data }` أو `{ success:false, error }` عبر
  `successResponse/errorResponse` (`route-helpers.ts:29,22`) ثم `toNextResponse:133`.
- **قوائم مفوترة:** راجع عقد `{items,total,page,limit,hasMore}` في LAYERS-OVERVIEW §5.
- **كوكيات:** `session_token` (httpOnly, sameSite=lax, maxAge=2h).
- **SSE:** `/api/scan-events?libraryId=…` يبث `scan_started/scan_progress/scan_completed/error`.

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. قبل إضافة/تعديل Route: راجع مصفوفة المصادقة أعلاه وقارن مع الواجهة المستهلكة.
2. لا تصلح Hookاً دون إصلاح الـ Route المقابلة (وأدر المتعاقدين معاً — API-02).
3. أي Route جديد يخالف النمط القياسي (يستورد Service مباشرة) يُضاف إلى قائمة الاستثناءات في
   LAYERS-OVERVIEW §4.
4. كل تعديل يُوثق هنا بتاريخه ومرحلة الإصلاح.
