# LAYER-MIDDLEWARE — طبقة الحماية والوسائط (Middleware Layer)

> **الغرض:** توثيق آلية الحماية في طبقتين منفصلتين: (1) `src/middleware.ts` على Edge
> (الحماية الرئيسية) و(2) `src/backend/middleware/` (Factories جاهزة غير مفعّلة بعد).
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### 1.1 Edge Middleware (`src/middleware.ts` — 80 سطراً)

**إعدادات المسارات:**

- `adminPaths = ["/admin"]` (`:4`) — الحماية الرئيسية.
- `authPaths = ["/login", "/register", "/forgot-password"]` (`:5`) — تُمرَّر دائماً.
- `passThroughPaths = ["/_next", "/api", "/favicon.ico", "/assets", "/images", "/robots.txt", "/sitemap.xml"]` (`:6`).
- `matcher` (`:76-79`): `"/((?!_next/static|_next/image|favicon.ico|assets|images).*)"`.

**السلوك (قراءة فعلية):**

1. **دائماً:** `x-url` يُضبط على `pathname + search` (`:17`، ويعاد ضبطه في `:72`)
   — تستهلكه الصفحات السفلى (مثل `(viewer)/layout.tsx:23,29` لتحديد callbackUrl).
2. **passThrough:** `/_next` و`/api` والأصول — تُمرَّر مباشرة (الحماية الداخلية تترك
   للمسارات نفسها/للـ Route Handlers).
3. **authPaths:** تُمرَّر دائماً.
4. **adminPaths:** فحص صارم:
   - بلا كوكي `session_token` → redirect إلى `/login?callbackUrl=<path>` (`:31-36`).
   - **يستدعي `/api/auth/verify-admin`** عبر fetch مع تمرير الكوكي (`:38-42`) —
     **لا يقرأ قاعدة البيانات** (قاعدة حاكمة).
     - 401 → redirect `/login?callbackUrl=` (`:44-48`).
     - **403 → صفحة HTML مدمجة «غير مصرح»** (`:50-55`).
     - غير `ok` أو استثناء fetch → redirect (`:57-66`).
   - النجاح → تمرير.
5. **Viewer routes:** تمرير (الحماية تُدار في `(viewer)/layout.tsx` عبر
   `viewer_access_mode` — راجع LAYERS-OVERVIEW §6).

### 1.2 Backend Middleware (`src/backend/middleware/` — 3 ملفات)

كلها **Factories** جاهزة للتوصيل، لكن — **غير مُفعّلة**: لا يوجد أي استدعاء لها في
الكود الحالي (grep على `createRateLimiter|createMaintenanceMiddleware|
createVisitorTrackingMiddleware` يعيد تعريفاتها فقط، ولا يوجد استخدام للـ `.auth()`/
`.api()`).

- **`rate-limiter.ts`:**
  - نافذة: `WINDOW_MS = 15 * 60 * 1000` (`:13`)، `AUTH_MAX = 5` (`:14`) —
    يتوافق مع `MAX_LOGIN_ATTEMPTS` في AuthService (5 محاولات / 15 دقيقة).
  - `apiMax = 500` افتراضياً (`:16`) ويقرأ `api_rate_limit` من الإعدادات عند الإنشاء
    (`:31-35`) ويُحدَّث عبر حدث `settings_updated` (`:37-44`).
  - **التخزين في الذاكرة (Map)** (`:17`) — يُصفَّر عند إعادة تشغيل الخادم، وليس
    موزّعاً بين عمليات/نسخ.
  - يعيد `{ ... }` (429) مع `error` بالعربية/الإنجليزية.
- **`maintenance.ts`:** يقرأ `getAllSettings(false)` ويُحدِّث cache دورياً — يُرجع
  `503` في وضع الصيانة (افتراضياً غير موصول).
- **`visitor-tracking.ts`:** يحدّث نشاط الزائر عبر `visitorRepo.updateVisitorActivity`
  و`parseCookies` (`:36`) — غير موصول.

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### MID-01 — Rate-Limiter معرّف لكن غير مفعّل إطلاقاً (Phase 2 — Security)

- **المشكلة:** `createRateLimiter` (`rate-limiter.ts:30`) موجود وجاهز، لكن لا يوجد
  استدعاء له في أي Route (لا في `/api/auth` ولا في نقاط POST العامة الأخرى). النتيجة:
  - **`/api/auth` بلا حدود محاولات فاعلة من الـ API** (القيود في AuthService عبر
    Map داخل العملية، لكنها لا تغطي المتطلبات الشبكية وتُصفَّر عند إعادة التشغيل).
  - نقاط POST العامة (`/api/messages`، `/api/media-reports`، `/api/news`،
    `/api/ads`، `/api/store-products`) **بلا حماية Rate-Limit إطلاقاً** — هدف
    Spam/DoS.
- **المرحلة:** Phase 2 — Security (أولوية عالية).
- **الاتجاه المقترح:** تفعيل `rateLimiter.api`/`.auth` في الـ Route Handlers الحساسة
  (أو تحويل النقاط العامة عبر وسيط)، مع ملاحظة حد الذاكرة (في الحالات المتعددة
  العمليات يلزم تخزين مشترك).

### MID-02 — Visitor-tracking وMaintenance معرّفان بلا مستهلك (Phase 5)

- لا مشترك في `visitorRepo.updateVisitorActivity`؛ ولن يظهر وضع الصيانة حتى لو ضُبط
  الإعداد لأن `createMaintenanceMiddleware` غير موصول. **سلوك فعلي:** إعداد
  maintenance_toggle يُبث عبر EventBus (`settings-service.ts:147,169`) لكن بلا وسيط
  يطبّق الـ 503.
- **المرحلة:** Phase 5 — Secondary Improvements (رابط مباشر بقرار التفعيل).

### MID-03 — اختبار `verify-admin` بالحالة الرقمية لا الرسالة (Phase 5)

- `middleware.ts:44-61` يفرّق 401/403/غير-ok بالأرقام فقط — يعمل حالياً لأن
  `verify-admin/route.ts` يرد 401/403 بدقة، لكن أي تغيير مستقبلي في أكواد الحالة
  للـ verify قد يكسر منطق التوجيه دون أن يلاحظه أحد.
- **المرحلة:** Phase 5 — توثيقي/تنظيمي (إضافة تعليق عقدي على الحالات الثلاث).

---

## 3. العقود المقدمة (Contracts Exposed)

- **`x-url` header** — دائماً مضبوط (middleware.ts:17,72)؛ تستهلكه الطبقات السفلى.
- **`/api/auth/verify-admin`** — عقد الحالة: 200 `{valid:true,user}` / 401 `{valid:false}`
  / 403 `{valid:false}` (يستهلكه middleware.ts:38-55).
- **كوكية `session_token`** — `httpOnly, sameSite=lax, maxAge=2h`
  (يضبطها `auth/route.ts:40-48`).
- **الحدود:** Edge Middleware **لا يقرأ قاعدة البيانات أبداً** — كل فحص admin عبر
  fetch إلى verify-admin؛ حماية الـ viewer في الـ Layout (Server Component).

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي تفعيل لـ Rate-Limiter يجب أن يغطي معاً: `/api/auth` + كل نقاط POST العامة
   (MID-01) وأن يتوافق مع `MAX_LOGIN_ATTEMPTS/LOCKOUT` في AuthService.
2. لا تُضف قراءة DB في Edge Middleware — القاعدة حاكمة (استخدم fetch).
3. أي تعديل في أكواد الحالة لـ `verify-admin` يجب أن يحدّث middleware.ts بالتوازي.
4. عند تفعيل maintenance middleware — يجب أن يستجيب لحدث `maintenance_toggle`
   (موجود بالفعل في settings-service.ts:147,169).
