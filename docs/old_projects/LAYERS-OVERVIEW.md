# LAYERS-OVERVIEW — خريطة طبقات النظام (Architecture Layer Map)

> هذه الوثيقة هي فهرس ودليل الخريطة المعمارية لمشروع **Library Manager V2**
> (Next.js 16.2 / React 19.2، RTL عربي، قاعدة بيانات SQLite).
> تُقرأ قبل أي من ملفات `LAYER-*.md` التسعة، وتحدد المصطلحات، والقاعدة الذهبية للتدفق،
> وحدود المسؤولية لكل طبقة، ومبدأ «العقد بدلاً من التخمين».

---

## 1. الغرض (Purpose)

المستند يثبّت المعرفة المعمارية الناتجة عن التدقيق الشامل للكود (قراءات فعلية موثقة بمراجع
`file:line`) بحيث لا تضيع عند الانتقال بين المراحل أو عند تغيير المطوّر/الـ Agent.
هو **خريطة** لا وثيقة تصميمية نظريّة: كل ما يُذكر هنا مثبّت من الكود الفعلي الموجود اليوم.

### قاعدة لا تخمين (No-Guessing Rule)

- كل ادّعاء عن سلوك يعتمد على قراءة الكود الفعلي وليس على اسم الملف أو استدلالات الـ grep.
- كل مشكلة مُدرجة تحمل مرجع `file:line` دقيقاً + مرحلة الإصلاح المقترحة (Phase).
- الوثيقة تفصل بوضوح: **الوضع الحالي** (Current State) / **المشاكل المؤكدة** (Confirmed Issues) /
  **الخطط المستقبلية** (Planned) / **خارج النطاق** (Out of Scope).

---

## 2. الملفات المرجعية النهائية (Source of Truth)

| المرجع                                             | الدور                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `AGENTS.md` (جذر المشروع)                          | قواعد التطوير، الاختصارات، أنماط الصفحات، الحماية، قواعد الهجرة       |
| `ARCHITECTURE_RULES.md` (جذر المشروع)              | الدستور المعماري — طبقات Clean Architecture وقاعدة لا استيراد لأعلى   |
| `src/backend/db/schema.ts`                         | تعريف الجداول (23 جدولاً) — مصدر الحقيقة لنموذج البيانات              |
| `src/backend/db/migrations/001_initial_schema.sql` | الـ DDL الفعلي المنفّذ                                                |
| `src/backend/api/route-helpers.ts`                 | مساعدات مسارات الـ API (buildContext, toNextResponse, requireAuth...) |
| ملفات `LAYER-*.md` (هذه المجموعة)                  | التفاصيل المعمارية لكل طبقة                                           |

---

## 3. الطبقات والتقسيم المعتمد (Layers)

التقسيم الفعلي في الكود (حسب بنية المجلدات والاستيرادات الحقيقية):

```
طبقة Frontend  ── src/app (routes + layouts) / src/features / src/shared / src/providers / src/lib/frontend
     │
طبقة API Routes ── src/app/api/** (19 route groups) + src/backend/api/route-helpers.ts
     │
طبقة Controllers ── src/backend/controllers/ (20 ملفاً، Singletons عبر getControllers())
     │
طبقة Services ── src/backend/services/ (20+ ملفاً، Singletons عبر getServices())
     │
طبقة Repositories ── src/backend/repositories/ (24 ملفاً)
     │
طبقة DB ── src/backend/db/ (db.ts + schema.ts + migrations/)
```

الطبقات الجانبية (Cross-cutting):

```
Middleware ── src/middleware.ts (Edge) + src/backend/middleware/ (rate-limiter, maintenance, visitor-tracking)
Scanner ── src/backend/scanner/ (ScanOrchestrator, LibraryMonitor, HierarchyRules, ...14 ملفاً)
```

---

## 4. القاعدة الذهبية: لا استيراد لأعلى (No Upward Imports)

```
controllers → services → repositories → db
```

- **UI لا تستورد من Services أو Repositories مباشرة** — مرور عبر Controllers فقط.
- **Route Handlers لا تستورد Services مباشرة** في النمط القياسي (10-15 سطراً عبر
  `getControllers()`).
- **استثناءات موثقة** (موجودة فعلياً في الكود — ليست مخالفات جديدة):
  - `src/app/api/libraries/scan-all/route.ts` و`libraries/[id]/scan/route.ts` تُنشئ
    `new ScanController(scanner, library)` محلياً (تحتاج Scanner + Library معاً).
  - `src/app/api/scan-events/route.ts` (SSE) تستمع مباشرة إلى EventBus لأحداث `scan_*`.
- أي استيراد جديد يخالف القاعدة يجب توثيقه هنا قبل إضافته.

---

## 5. العقود الموحّدة (Shared Contracts)

### عقد القوائم المفوترة (Paginated List Contract)

```
{ items, total, page, limit, hasMore }
```

- المصدر: `getMediaByFilter` في `src/backend/repositories/media-repository.ts:589`.
- المستهلك: `src/app/api/media/route.ts:35` و`use-admin-media.ts:95-96`.

### ملاحظة تعارض عقد القوائم

العديد من هوكس الإدارة (admin hooks) تتوقع عقداً مختلفاً:

```
{ rows, total } + معاملات ?limit= & ?offset=
```

- أمثلة: `use-admin-reports.ts:16-17`، `use-admin-news.ts:15-16`، `use-admin-ads.ts:18-19`,
  `use-admin-messages.ts:16-17`، `use-admin-store.ts:14-15`، `use-admin-processes.ts:15-16`.
- الـ Routes المقابلة **لا تدعم** `limit/offset` (مثال: `media-reports/route.ts` بلا قراءة
  لهما)، أو تعيد شكلاً مختلفاً (مثال: `progress/route.ts` يعيد تقدم المستخدم لا عمليات المسح).
- تفصيل كامل: `LAYER-API-ROUTES.md` و`LAYER-FRONTEND.md`.

### عقد الاستجابة للـ API (Response Wrapping)

- `toNextResponse(result)` في `route-helpers.ts:133` يحوّل `ControllerResult` إلى `NextResponse`.
- `api-client.ts` (الواجهة): `BASE_URL="/api"` + `credentials:"include"` ويرمي عند
  `!success` ويعيد `json.data` مباشرة (`src/lib/frontend/api-client.ts:1-41`).
- `api.ts` (المساعد): يرمي `ApiError` عند `!response.ok` (`src/lib/frontend/api.ts:39-41`).

---

## 6. المصادقة والحماية (Auth Model — ملخص، التفصيل في LAYER-MIDDLEWARE)

```
Middleware (Edge)
 └── /admin/*  →  Cookie session_token موجود؟  →  fetch /api/auth/verify-admin (JWT+role)
                      401 → redirect /login?callbackUrl=…
                      403 → 403 Forbidden
                      200 → pass

Viewer Layout (Server Component)
 └── viewer_access_mode (SettingsService):
       "public"    → allow all
       "protected" → AuthService.verifyToken() → invalid → redirect /login?callbackUrl=…
```

- `session_token` كوكي httpOnly/sameSite=lax/maxAge=2h — يُضبط في `src/app/api/auth/route.ts:40-48`.
- `verify-admin` يعيد `{valid:false}` (401/403) أو `{valid:true, user}` —
  `src/app/api/auth/verify-admin/route.ts`.
- `x-url` يُضبط دائماً في الـ middleware (`src/middleware.ts:17,72`) ويستهلكه
  `(viewer)/layout.tsx:23,29` لتحديد callbackUrl.
- إعدادات الحماية على الـ Routes:
  - `requireAdmin` حيثما يجب: `/api/media?admin=true` (media/route.ts:16)،
    `/api/media/[id]` DELETE (29)، `/api/dashboard/**`، `/api/settings` POST/PUT،
    `/api/user`، `/api/news` POST، `/api/ads` POST، `/api/store-products` POST،
    `/api/media-reports` GET (5-17)، `/api/scan-events`، `/api/database/**`.
  - `requireAuth` فقط: `/api/media/[id]` PATCH (38-47)، `/api/progress/[mediaId]` PUT.
  - **عام (بلا auth):** `POST /api/messages`، `GET /api/news`، `GET /api/ads`،
    `GET /api/store-products`، `GET /api/settings`، `POST /api/media-reports` (19-27).
  - تفصيل كامل: `LAYER-API-ROUTES.md`.

---

## 7. فهرس ملفات الطبقات (Index of Layer Docs)

| الملف                   | يغطي                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `LAYER-API-ROUTES.md`   | 19 route groups، نمط الـ Route Handler القياسي، التعارضات المؤكدة مع الـ hooks            |
| `LAYER-CONTROLLERS.md`  | 20 Controller، قاعدة BaseController، getControllers()، عقود ControllerResult              |
| `LAYER-SERVICES.md`     | 20+ Service، getServices()، AuthService، SettingsService، EventBus، CacheService          |
| `LAYER-REPOSITORIES.md` | 24 Repository، BaseRepository، عقد pagination، getMediaByFilter                           |
| `LAYER-DB.md`           | schema.ts (23 جدولاً)، db.ts (WAL+retry)، migrations، الأعمدة is_leaf/unavailable_*       |
| `LAYER-SCANNER.md`      | ScanOrchestrator، HierarchyRules (leafTypes)، completeScan → enforceAvailabilityInvariant |
| `LAYER-MIDDLEWARE.md`   | middleware.ts + backend middleware (rate-limiter, maintenance, visitor-tracking)          |
| `LAYER-FRONTEND.md`     | app/features/shared/providers/lib-frontend، أنماط الصفحات الثلاثة، admin hooks            |

---

## 8. المراحل المخططة للإصلاح (Phase Taxonomy)

تُستخدم هذه المراحل كتصنيف ثابت لكل مشكلة مؤكدة في ملفات الطبقات:

- **Phase 1 — Functional Integrity:** مشاكل وظيفية تعطّل سلوكاً واضحاً (مثال: تعارض
  `use-admin-processes` مع `/api/progress`).
- **Phase 2 — Security:** ثغرات حماية أو فجوات صلاحيات (مثال: PATCH بلا تعيين
  `adminList` في واجهات الإدارة، نقاط POST عامة تحتاج مراجعة).
- **Phase 3 — Data Integrity:** مشاكل سلامة بيانات (مثال: استمرار سكون بيانات الـ
  availability، enrich بلا `enriched` flag محسّن).
- **Phase 4 — Performance:** pagination ناقصة، N+1، SSE بلا إعادة اتصال.
- **Phase 5 — Secondary Improvements:** تحسينات تجميلية/تنظيمية (مثل CacheService بلا مستدع).

---

## 9. خارج النطاق الحالي (Out of Scope)

- **Live TV / Receiver Streaming** — `live-stream-page` و`/api/channels` **Future Feature /
  Planned Module** فقط. لا توجد أداة `channels` في الـ DB إطلاقاً، ولا تُدرج ضمن Media
  Library ولا ضمن المشاكل الحالية.
- **تحويل الواجهة الإدارية لتصميم مستقل** — مستهدفة مستقبلاً (انظر AGENTS.md قسم
  Theme Separation)؛ اليوم تُشارك `globals.css` مع الواجهة العامة، ويُتّرك ذلك كما هو.
- **مراجعة الكود القديم `library-manager77`** — مصدر سلوكي (Last Resort) فقط، لا تنفيذي.
