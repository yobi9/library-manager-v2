# LAYER-FRONTEND — طبقة الواجهة (Frontend Layer)

> **الغرض:** توثيق طبقة الواجهة — البنية (app/features/shared/providers/lib-frontend)،
> أنماط الصفحات الثلاثة، تدفق البيانات والـ hooks، والمشاكل المؤكدة في التكامل مع
> الـ API.
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### البنية والمجلدات

```
src/
├── app/
│   ├── (viewer)/      ← القوائم: certification, genre, items, itemView, liveStream,
│   │                    person, player, rating, sections, watch-later, year
│   ├── (auth)/        ← login/register/forgot-password
│   ├── admin/         ← 19 مجلداً: ads, database, events, exclusive, help, ItemsControl,
│   │                    libraries, license, messages, news, processes, reports,
│   │                    requests, settings, store, subscription, team, terms, upload, users
│   └── api/           ← 19 route groups (راجع LAYER-API-ROUTES)
├── features/          ← viewer/pages (home, lib-items, item-detail, live-stream, people,
│                        person-detail, player, watch-later, years) + auth/pages + admin/hooks
├── shared/            ← components/{ui (16), layout} + constants + hooks + types + utils
├── providers/         ← QueryClientProvider + AuthProvider + ThemeProvider (next-themes) + Toaster
└── lib/frontend/      ← api.ts, api-client.ts, api-media.ts, media-queries.ts,
                          favorites-storage.ts, watch-later-storage.ts, image-helpers.ts,
                          media-constants.ts, media-helpers.ts, translate.ts,
                          use-season-episodes.ts, use-watch-later.ts, index.ts
```

### أنماط الصفحات الثلاثة (Flat Pattern — صفحة واحدة لكل Route)

- **Pattern A — صفحات قوائم رفيعة:** Client Component مضمّن مع hook + قائمة.
  تستخدم: `genre/[slug]`، `year/[year]`.
- **Pattern B — Player/Sections:** `"use client"` مع `dynamic(ssr: false)` في صفحة
  Client. تستخدم: `player/[id]`، `sections`، `sections/[id]`.
- **Pattern C — صفحات كثيفة:** `"use client"` يعيد تصدير من `@/features/*`:
  ```ts
  "use client";
  export { ItemDetailPage as default } from "@/features/viewer/pages/item-detail-page";
  ```
  تستخدم لمعظم صفحات الـ viewer + login. كذلك `rating/[value]` و`certification/[cert]`
  عبر `rating-items-page` / `certification-items-page`.

### عميل الـ API (مؤكد بالقراءة)

- **`api-client.ts`** (`:1-41`): `BASE_URL="/api"` + `credentials:"include"`؛ يرمي
  عند `!success` ويعيد `json.data` مباشرة. **عقد الواجهة: كل استجابة API يجب أن
  تحمل `{success, data}`** أو يرمي العميل.
- **`api.ts`** (`:39-41`): يرمي `ApiError` عند `!response.ok`.
- **`media-queries.ts`**: `mediaKeys` (`:30`) + `useMediaByFilter` (`:40-51`) مع
  `staleTime: 2min`؛ فهارس أخرى تتراوح بين 1-10 دقائق (10min للأدلة الثابتة مثل
  libraries/years/libraryInfo، 2min للقوائم المفصلة).
- **الموفِّدون:** `providers/index.tsx` يجمع QueryClientProvider + AuthProvider +
  ThemeProvider (next-themes) + Toaster (Sonner).

### الحماية في الـ Viewer Layout

- `(viewer)/layout.tsx:23,29` يقرأ `x-url` (من middleware) و`viewer_access_mode`؛ في وضع
  `protected` يتحقق عبر `AuthService.verifyToken()` ويعيد توجيه فاشل التحقق إلى
  `/login?callbackUrl=<x-url>`.

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### FE-01 — `use-admin-processes` يستدعي `/api/progress` بعقد خاطئ (Phase 1)

- `use-admin-processes.ts:25`: `apiFetch<ProcessesResponse>("/api/progress")` ويتوقع
  `{ rows: ScanProcess[], total }` (`:15-16`) لكن `progress/route.ts` يعيد تقدم مشاهدة
  **المستخدم** (ويعيد `[]` بلا auth). شاشة «العمليات الجارية» معطلة وظيفياً.
- **المرحلة:** Phase 1 — Functional Integrity (يرتبط بـ API-01).

### FE-02 — هوكس الإدارة تعتمد عقد `{rows,total}` غير مدعوم (Phase 1)

- `use-admin-reports.ts:16-17`، `use-admin-news.ts:15-16`، `use-admin-ads.ts:18-19`،
  `use-admin-messages.ts:16-17`، `use-admin-store.ts:14-15` — كلها تتوقع `{rows,total}`
  مع `?limit=&offset=` بينما الـ Routes لا تمرّرها (يرتبط بـ API-02).
- **المرحلة:** Phase 1.
- **الاتجاه المقترح:** توحيد الجميع على عقد `{items,total,page,limit,hasMore}`
  (المصدر: `media-repository.ts:589` و`use-admin-media.ts:95-96` — الـ hook الوحيد
  الصحيح عقداً).

### FE-03 — إرسال `reporter_device_id` مقابل عمود `device_id` (Phase 3)

- `use-admin-reports.ts`/واجهة البلاغات ترسل حقل الـ device بمعرف مخالف لعمود الـ DB
  الفعلي (`device_id` في schema 001:453) — يرتبط بـ DB-01/API-04. يظهر في INSERT
  أيضاً (`report-repository.ts:16`).
- **المرحلة:** Phase 3 — Data Integrity.

### FE-04 — عقد `AdminMediaDetails`/`ItemMetadataPayload` يطابق whitelist التحقق (Phase 5)

- `use-admin-media.ts` يعرّف `ItemMetadataPayload` و`AdminMediaFilters` متوافقين مع
  whitelist التحديث في `updateMetadataManually` — **مثال إيجابي يُحتذى** في التوثيق.
  (لا مشكلة؛ يُسجَّل كمرجع نمط.)

---

## 3. العقود المقدمة (Contracts Consumed)

- **عقد الاستجابة:** `{success, data}` أو `{success:false, error}` (العميل يرمي على
  failure ويعيد `data` فقط).
- **كوكية:** `session_token` تُرسل عبر `credentials:"include"`.
- **عقد القوائم (الموحّد):** `{items,total,page,limit,hasMore}` — لا `{rows,total}`.
- **استعلامات القوائم:** `page/limit/year/genre/certification/minRating/excludeTypes`
  (تطابق `getMediaByFilter` في media-repository.ts:497).
- **SSE:** `use-scan-events.ts` يستهلك `/api/scan-events?libraryId=` عبر EventSource
  (fallback صامت عند عدم الدعم).

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي تعديل على الـ UI يجب أن يحترم قواعد Tailwind v4 (لا `bg-gradient-to-*` القديمة،
   لا arbitrary brackets الممكن استبدالها، و`aspect-2/3` لا `aspect-[2/3]`).
2. أي hook جديد يلتزم بعقد القوائم الموحّد `{items,total,page,limit,hasMore}`.
3. قبل تغيير أي hook: تحقق من الـ Route المقابل (أصلح المتعاقدين معاً — FE-01/02).
4. Server Components افتراضياً؛ `"use client"` فقط عند الحاجة للتفاعل.
5. **قيود السمة (من AGENTS.md):** إعدادات السمة Client-Only؛ لا DB ولا مزامنة سيرفر؛
   Admin وPublic نظامان منفصلان (الـ shadcn في `shared/components/ui` هي الوحيدة
   المشتركة المسموح بها).
