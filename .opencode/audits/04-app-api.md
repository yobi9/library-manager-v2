# المرحلة 4 — مراجعة `src/app/api` (Audit Report)

> **النوع:** Audit Report (تحقيق قراءة فقط — لم يتم إجراء أي تعديل)
>
> **التاريخ:** 2026-08-13
>
> **النطاق:** جميع مسارات `src/app/api` (129 ملف `route.ts`) — **الحدود بين الـ HTTP والطبقة الخلفية**.
> طبقة الـ backend نفسها (controllers/services/repositories) خارج النطاق ما عدا حيث يلزم
> التحقق من عقد التفويض/الاستجابة عند الحدود.
>
> **المنهجية:** فحص آلي شامل (حضور `getControllers`/`toNextResponse`/`requireAdmin`/`requireAuth`) ثم
> قراءة عينات موزعة (المسارات العامة، مسارات المستخدم، مسارات المسح/SSE، stream، images، auth، verify-admin).
> **ملاحظة منهجية:** أول تمريرة عدّادية فشلت جزئياً لأن PowerShell يعامل `[id]` في المسار كـ wildcard —
> أُعيد الحساب بقراءة المحتوى مباشرة (`Get-Content -Raw`) بدل `Select-String -Path`.

## الملخص التنفيذي

**البنية العامة ممتازة**: 70/129 مساراً تتبع النمط الرفيع المعتمد (`getControllers()` + `toNextResponse` +
`handleRouteError`)، و91 مساراً إدارياً يفرض `requireAdmin` عند الحدود. عقد الاستجابة `{success, data}`
متسق مع كلا زوجَي أدوات العميل (`apiClient` يفك `json.data`، و`apiFetch` يقرأ `success`).

لكن توجد **ثغرتان تفويض فعليتان (IDOR)** في مسارات المستخدم والتثبيت، و**انحرافان معماريان** في
مسارات المسح/SSE عن عقد DI، وغياب حماية Brute-force على تسجيل الدخول.

---

## 🔴 Critical

لا توجد اكتشافات حرجة على مستوى ترفيع الامتياز (privilege escalation). أهم الثغرتين أدناه ترفعان مستوى
وصول مصادق عادي إلى بيانات مستخدمين آخرين — منزلة High (وليست حرجة لأنها لا تتجاوز سلم الصلاحيات).

---

## 🟠 High

### H1 — IDOR: أي مستخدم مصادق يقرأ إحصائيات ونشاط أي مستخدم آخر

**المسارات:**
- `GET /api/user/[id]/stats` → `user-controller.getStats(id)` → `userService.getUserStats(userId)`
- `GET /api/user/[id]/activity` → `user-controller.getActivity(id)` → `userService.getUserActivity(userId)`

**الأدلة:**
- المساران يستخدمان `requireAuth` فقط (مؤكد آلياً) **ولا يمرّران `ctx`/هوية** إلى الـ controller.
- `user-controller.ts:59-67` و`:83` يستدعيان الخدمة بـ `id` خام من المسار — بلا فحص ملكية أو مدير.
- `user-service.ts:289-314` ينفذ استعلامات SQL على `user_progress`/`user_sessions` لمستخدم تعسفي
  (عدادات المشاهدة، الجلسات النشطة/الإجمالية، آخر نشاط).
- بالمقابل، بقية دوال `user-controller` (create/update/delete/changeAdminStatus/blockUser)
  **تمرّر `ctx.userId!/ctx.isAdmin!`** — أي أن الفحص الداخلي موجود في النظام لكنه غائب هنا.

**الأثر:** يقرأ أي مستخدم مصادق إحصاءات مشاهدة وجلسات وأرشيف نشاط أي مستخدم آخر (تسريب خصوصية / IDOR).
الـ admin يقرأها عبر نفس المسار بلا تمييز (ما يزال قاصراً عن تولي/تعديل — تأثير الخصوصية هو الأساس).

**الإصلاح المقترح:** تمرير `ctx` إلى `getStats`/`getActivity` والتحقق من `ctx.userId === id || ctx.isAdmin`
(أو تحويل المسارين إلى `requireAdmin` إن كانت الإحصائيات ميزة إدارية فقط — يُقرَّر عقد الاستخدام أولاً).

---

### H2 — `POST /api/media/[id]/toggle-pin` بلا فحص مدير

**الأدلة:**
- المسار يستخدم `requireAuth` فقط (`media/[id]/toggle-pin/route.ts:10`).
- `media-controller.ts:126-134` — `togglePin` يستدعي `mediaService.togglePin(mediaId)` بلا أي `ctx`/فحص.

**الأثر:** أي مستخدم مصادق (حتى `viewer`) يعكس حالة "مثبّت" لأي عنصر — ميزة تنظيمية (curated) يجب أن
تكون إدارية حصراً.

**الإصلاح:** رفع المسار إلى `requireAdmin` و/أو تمرير `ctx` للفحص داخل الـ controller.

---

### H3 — كشف رسالة الخطأ الخام عبر `handleRouteError` + غياب حماية Brute-force على تسجيل الدخول

- `route-helpers.ts:92` — عند خطأ غير معرّف (غير AUTH/ADMIN) يردّ `errorResponse(message, 500)`
  بنص الخطأ الفعلي (تفاصيل SQL/مسارات ملفات/أسماء خدمات) للعميل — تسريب تفاصيل داخلية بجانب
  تسجيلها في `logger`. التوصية: رد عام «Internal server error» للعميل والإبقاء على الرسالة للسجل فقط.
- `auth/route.ts:25-65` — POST login بلا أي Rate-Limit/قفل حساب (لا عدّاد فشل، لا تأخير، لا قفل).
  نقطة تسجيل دخول محلية عبر LAN، لذا الخطورة محدودة، لكن الإضافة رخيصة.

---

## 🟡 Moderate

### M1 — انحراف عن عقد DI في مسارات المسح والـ SSE (8 ملفات)

**الملفات:** `libraries/[id]/scan{/,.pause,.resume,.stop,.progress}/route.ts`، `libraries/scan-all/route.ts`،
`scan-events/route.ts`، `admin/events/route.ts`.

**التفصيل:**
- مسارات المسح تُنشئ `new ScanController(s.scanner, s.library)` لكل طلب عبر `getServices()`
  بدل `getControllers()` — أي أن `ScanController` **غير مسجّل** في `getControllers()` (كسر الضمنية
  "DI via lazy singletons: getControllers()" في AGENTS.md).
- `scan-events` و`admin/events` يخاطبان `getEventBus()` والخدمات مباشرة (SSE بالتصميم — مقبول لكن
  خارج عقد المسار الرفيع).

**القرار المطلوب:** إمّا تسجيل `ScanController` في `getControllers()` (وهو الأجدر لاتساق العقد)، أو
توثيق هذا الاستثناء صراحةً.

### M2 — `libraries/[id]/scan/progress` بـ `requireAuth` فقط (تفاوت تصريحي داخل منظومة المسح)

بقية مسارات المسح (start/stop/pause/resume/scan-all/scan-events) تفرض `requireAdmin`، بينما
`scan/progress` تقبل أي مستخدم مصادق لمتابعة تقدم فحص أي مكتبة. ثغرة معلوماتية صغيرة +
تفاوت في النية. إمّا رفعها إلى `requireAdmin` أو توثيق القرار.

### M3 — تحويلات `as boolean` غير آمنة في حمل المسح

`libraries/[id]/scan/route.ts:17-18` و`scan-all/route.ts:13-14`:
`body["deepScan"] as boolean ?? false` — تحويل افتراضي على قيمة غير محققة: إرسال النص `"false"`
يبقى truthy، وغياب أي schema تحقق. الأفضل تحقق حقيقي (`typeof === "boolean"` أو مخطط Zod).

### M4 — تناقض مسار `fetchRecommendations` مع العقد (إحالة من المرحلة 2)

المسار `media/recommended/[id]/[type]` يفترض `[type]` نوع الوسائط، لكن `api-media.ts:364-379` يبني
`/media/recommended/{mediaId}/{libraryId}` — أي أن `[type]` يستقبل libraryId ويفسر كقيمة خاطئة،
ويعمل فقط لأن `media-controller.ts:205-218` يعيد اشتقاق النوع من سجل الوسائط. يُوثَّق هنا كجزء من
عقد المسار (المنتِج سليم؛ العقد بين العميل والمنتج يحتاج مواءمة في مرحلة الإصلاح).

---

## 🟢 Low

### L1 — غياب TSDoc في مسارات الـ thin (~70 ملفاً)
مسارات مثل `user/[id]` و`messages/[id]` و`news/[id]` و`media/[id]/view` بلا TSDoc — بينما المسارات
المركّبة (stream، images، SSE، live-channels، verify-admin) موثقة بشكل ممتاز. المعيار متمايز: يلزم
الحد الأدنى (وصف العقد + المصادقة) لكل مسار.

### L2 — عقد استجابة مختلف لـ `verify-admin`
`{valid, user}` بدل عائلة `{success, data}` — مقصود (الـ proxy يقرأ الحالة فقط)، لكنه عقد ثانٍ غير
موثّق في `route-helpers`. يُوثَّق أو يُوحَّد.

### L3 — `progress/route.ts` بلا هوية يرد `data: []` (200) بدل 401
اختيار تصميمي (استمرارية التصفح المجهول) — مقبول، يستحق تعليقاً توضيحياً.

### L4 — `media/batch` يقبل `ids` بلا سقف
قائمة `ids` غير محدودة الطول → مخاطرة DoS بطول URL عند العميل (إحالة M5 المرحلة 2).

### L5 — تكرار زمن انتهاء الجلسة
`auth/route.ts:58` يكتب `maxAge: 2 * 60 * 60` يدوياً بينما `auth-service` يثبّت 2h — ثابت مكرر
يحتمل تباعداً مستقبلياً.

### L6 — `health/route.ts` يتجاوز الطبقات
`getDatabase()` + `SELECT 1` مباشرة — مقبول لفحص صحة، لكنه الوحيد الذي يلمس DB خارج
الخدمات/المستودعات (يستحق استثناءً موثقاً).

---

## ✅ ملاحظات إيجابية

- **عقد الاستجابة متسق**: مسارات المشاهد العامة تستخدم `viewerResponse`/`toNextResponse` → `{success, data}`،
  مطابقة لفك `json.data` في `apiClient` ولتوقّع `success` في `apiFetch` (الاستثناءات: verify-admin وSSE وimages).
- **91 مساراً إدارياً** تفرض `requireAdmin` عند الحدود (بلا اعتماد على حماية خفية في الـ proxy).
- **`viewerResponse` (Phase 7)**: `Cache-Control` محسوب حسب `viewer_access_mode` (public → 60s؛ protected → no-store) —
  تصميم أمني صائب يمنع تسريب جلسات مصادقة في كاش مشترك.
- **`media/[id]/stream`**: دعم كامل لـ Range مع backpressure و`cancel()` يُتلف المصدر، مع العمل حول
  خطأ `ERR_INVALID_STATE` (nodejs#54205) — جودة عالية موثقة بـ TSDoc.
- **`images/[id]`**: ETag (SHA-1) + إعادة تحقق 304 — تنفيذ ناضج للكاش الشرطي.
- **مسارات SSE**: تنظيف كامل للاشتراكات عند `abort`، وترويسلة 500ms لحدث `scan_item` — قوية.
- **تسجيل الدخول**: `httpOnly` + `sameSite:lax` (يقي من CSRF عبر POST من أصل خارجي) + `secure`
  مشتق من `NEXT_PUBLIC_APP_URL` (LAN http → بلا TLS يعمل؛ https → secure) + توافق 2h مع الخادم.
- **لا SQL في الـ route handlers** — الحد الفاصل بين HTTP والبيانات سليم (الاستثناء الوحيد: health).

---

## ما يحتاج تأكيداً

| # | الموضوع | أين |
|---|---------|-----|
| 1 | هل `user/[id]/stats` و`user/[id]/activity` ميزتان إداريتان فقط أم ذاتية (self)؟ يحدد الإصلاح (requireAdmin أم فحص ملكية). | `user/[id]/{stats,activity}` |
| 2 | هل `toggle-pin` ميزة إدارية حصراً؟ | `media/[id]/toggle-pin` |
| 3 | هل يُسجَّل `ScanController` في `getControllers()` أم يُوثَّق الاستثناء؟ | `libraries/*/scan*` |
| 4 | هل `scan/progress` يجب أن يكون Admin-only مثل بقية منظومة المسح؟ | `libraries/[id]/scan/progress` |
| 5 | من هو المستهلك الفعلي لـ `user/[id]/stats` و`user/[id]/activity` في الواجهة (يُحدد أثر الإصلاح)؟ | `src/features/**` |

---

## مؤشرات خط الأساس (المرحلة 0)

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` | ✅ 0 أخطاء |
| `npm run lint` | ⚠️ 0 أخطاء / 63 تحذيراً |
| `npm test` | ✅ 22 ملف / 128 اختبار ناجحاً |
