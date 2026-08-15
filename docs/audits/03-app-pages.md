# المرحلة 3 — مراجعة صفحات `src/app` (Audit Report)

> **النوع:** Audit Report (تحقيق قراءة فقط — لم يتم إجراء أي تعديل)
>
> **التاريخ:** 2026-08-13
>
> **النطاق:** صفحات ومسارات `src/app` **عدا** `src/app/api` (المرحلة 4) — الجذور: `layout/global-error/not-found/robots/sitemap`،
> مجموعات `(auth)` و`(viewer)` و`admin` بكل صفحاتها (~40 ملفاً)، إضافةً إلى `src/proxy.ts` (الحماية المركزية) كمرجع أمني.
>
> **المنهجية:** قراءة كل صفحة، ومطابقة مفاتيح `ROUTES` في `src/shared/constants` بالمسارات الفعلية في `src/app`
> (مع `src/proxy.ts`)، ومقارنة سياسات الفهرس (`metadata.robots` مقابل `robots.ts`).

## الملخص التنفيذي

**الالتزام بنمط الصفحات ممتاز**: كل الصفحات تتبع Patterns (A/B/C) بشكل متسق مع AGENTS.md،
ومعظمها re-export رفيع من `@/features/*`. الحماية المركزية (proxy + viewer layout) سليمة البنية.

لكن المسار يحتاج تنظيفاً ومواءمة:

1. **التزام SSOT منخفض في الروابط الثابتة** — 8+ مواضع تكتب `/login` و`/admin` و`/year` و`/genre` و`/`
   يدوياً بدل `ROUTES.*` (بما فيها `proxy.ts` نفسه بـ 4 مواضع).
2. **تعارض في سياسة الفهرسة**: `metadata.robots: { index: false }` في الجذر ينفي ما تسمح به `robots.ts`.
3. **بقايا تطوير**: تعليقات مسار `//src\app\...` في 5 ملفات، أسطر معلّقة في 3 صفحات، و`data-theme="theme"` في
   `(auth)/layout` بقيمة حرفية لا يطابقها أي CSS.

---

## 🔴 Critical

لا توجد اكتشافات حرجة (الحماية المركزية سليمة؛ لا مسار إداري غير محمي).

---

## 🟠 High

### H1 — تعارض سياسة الفهرسة: `metadata.robots` مقابل `robots.ts`

**الملفات:**
- `src/app/layout.tsx:110-113` — `metadata.robots = { index: false, follow: false }` → يضيف
  `<meta name="robots" content="noindex,nofollow">` على **كل** الصفحات العامة.
- `src/app/robots.ts` — يسمح بفهرسة الصفحات العامة ويمنع `/admin` و`/api` فقط.

**Root Cause:** مكوّنان متضادان بلا قرار واضح:
- مع `index: false` تصبح `sitemap.ts` و`robots.ts` والتحسينات العامة (SEO) بلا قيمة.
- مع بقاء `robots.ts` يبدو أن النية فهرسة الواجهة العامة.

**Recommended Fix:** تحديد القرار (تطبيق خاص LAN ⇒ `index: false` مستحق وحذف `robots.ts`/`sitemap.ts`،
أو عام ⇒ إزالة `index:false`)، ثم حذف المكوّن الفائض.

---

### H2 — `(auth)/layout.tsx`: `data-theme="theme"` حرفي لا يطابق CSS + تسريب ثيم الإدارة للصفحة العامة

**الملف:** `src/app/(auth)/layout.tsx:7-8`
- `data-theme="theme"` — قيمة حرفية، وCSS يعرّف فقط `.admin-layout[data-theme="light"]` (globals.css:308).
  أي أن السمة عاطلة تماماً (بلا أثر).
- الصفحة تحمل كلاس `admin-layout` (ثيم الإدارة الداكن) داخل مجموعة `(auth)` العامة — خلط بين نظامي
  الثيم المنفصلين (الإدارة مقابل العام) في صفحة تسجيل الدخول.
- تنسيق: مسافة بادئة في `className` (سطر 7) ومحاذاة شاذة (سطر 8).

**Recommended Fix:** حذف `data-theme="theme"`، واعتماد ثيم العام للصفحة العامة (أو فئة مخصصة لصفحة
الدخول تتبع نظام الإدارة بوعي) مع توثيق القرار.

---

## 🟡 Moderate

### M1 — روابط ثابتة بدل `ROUTES.*` (SSOT)
- `src/proxy.ts:59,71,84,89` → `"/login"` (و`/` في رابط صفحة 403).
- `src/app/(viewer)/layout.tsx:35` → `redirect(`/login?...`)`.
- `src/app/not-found.tsx:8` → `href="/"`؛ `(viewer)/not-found.tsx:7` → `"/"`؛
  `(auth)/not-found.tsx:7` → `"/login"`؛ `admin/not-found.tsx:7` → `"/admin"`.
- `genre/[slug]/page.tsx:30-31` و`year/[year]/page.tsx:30-31` → `"/"` و`"/genre"` و`"/year"`.

**التوصية:** استبدالها بـ `ROUTES.HOME/LOGIN/ADMIN/GENRE/YEAR` (في الملفات الخادمية يلزم استيراد الثوابت).

### M2 — ثوابت ميتة في `src/shared/constants`
- `PAGINATION` (60-64) و`USER_ROLES` (66-69) بلا أي مستهلك (grep مؤكد) —
  بينما `DEFAULT_IMAGES` مستخدمة فعلاً (`search-modal`، `sections-grid`، `library-card`).
- `API_ROUTES` و`ADMIN_LIVE_STREAM` سُجّلا في المرحلة 1.

### M3 — `proxy.ts`: إعدادات قديمة + تكرار
- `authPaths = ["/login", "/register", "/forgot-password"]` (سطر 5) — لا توجد صفحتا `register` أو
  `forgot-password` في `src/app/(auth)` — قائمة مسارات تسمح بمرور صفحات غير موجودة (أثر قديم).
- `x-url` يُضبط مرتين: سطر 34 (لكل الاستجابات) ثم سطر 98 (للمسارات العامة) — إعادة ضبط زائدة.
- `isMatch` (16-18) بلا TSDoc، والوظيفة الرئيسية `proxy` (20) بتعليق إنجليزي واحد بلا TSDoc كامل.

### M4 — صفحة 403 المضمنة في `proxy.ts` (انتهاك فصل الثيم)
**الملف:** `src/proxy.ts:77-80` — كتلة HTML كاملة (ألوان `#0a0a0a`/`#ef4444`/`#3b82f6` مكتوبة يدوياً
ورابط `/` حرفي) داخل كود الـ proxy. أي تعديل ثيم مستقبلي لا يطالها. الأفضل: `notFound()`/`redirect`
أو صفحة ثابتة جاهزة تُعرض من المسار نفسه.

### M5 — كشف رسالة الخطأ الخام في error boundaries
**الملف:** `(auth)/error.tsx:13`, `(viewer)/error.tsx:13`, `admin/error.tsx:13`, `global-error.tsx:15` —
`{error.message}` يُعرض للمستخدم مباشرة (قد يفضح تفاصيل داخلية/مثيلة الخادم في الوضع الإنتاجي).
عرض رسالة عامة «حدث خطأ» مع `digest` يُفضَّل.

### M6 — التكرار ثلاثياً/رباعياً لـ loading وerror
- `loading.tsx` متطابقة في `(auth)`/`(viewer)`/`admin` (سبينر واحد).
- `error.tsx` متطابقة في `(auth)`/`(viewer)`/`admin` (الاستثناء `global-error.tsx` يحتاج html/body لذا يُستثنى).
- يمكن استخراج مكوّن مشترك واحد (يُستثنى `global-error`).

### M7 — استخدام `process.env` مباشرة بدل `getEnv()`
- `layout.tsx:104` → `new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000")`.
- `sitemap.ts:4` → `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000"`.
- مخالفة قاعدة «process.env يمر عبر getEnv()». مع ملاحظة أن `NEXT_PUBLIC_*` غير مشمول في تحقق Zod،
  فالقرار: إما إدراجه في `envSchema` كحقل عام أو توثيق الاستثناء.

---

## 🟢 Low

### L1 — بقايا تطوير
- تعليقات مسار: `layout.tsx:1`، `(viewer)/loading.tsx:2`، `items/[id]/page.tsx:2`، `player/[id]/page.tsx:1`، `admin/layout.tsx:1`.
- أسطر معلّقة: `genre/page.tsx:14,28`، `sections/page.tsx:7`، `sections/[id]/page.tsx:9`.
- مسافات زائدة: `admin/layout.tsx:145,162`، `sections/[id]/page.tsx:10`.
- تعليقات مرقّمة بخطوات في `layout.tsx:4,8,12,31,65,125` + ملاحظة placeholder «تأكد من صحة المسار لملفاتك» (سطر 12).

### L2 — `template.tsx` بلا وظيفة
- `(auth)/template.tsx`، `(viewer)/template.tsx`، `admin/template.tsx` — ممرّات فارغة `<>{children}</>`
  بلا أي حالة/حركة. إما تُستثمر للأنيميشن أو تُحذف.

### L3 — عدم اتساق توجيه `"use client"` في صفحات admin
- `admin/help/page.tsx` و`admin/terms/page.tsx` بلا `"use client"` (بقية الـ 19 صفحة تحمله).
  يعمل لأن الوحدات الأساسية `help-page`/`terms-page` ساكنة (Server)، لكنه غير متسق مع النمط المعتمد.

### L4 — تفاصيل RTL/وصول دقيقة
- `(viewer)/layout.tsx:68` — `focus:left-4` (يسار فيزيائي) بدل `inset-inline-start` في رابط التخطّي.
- أزرار إعادة المحاولة في error boundaries بأسلوب يدوي متكرر (يمكن الاعتماد على `Button` المشترك).

### L5 — أداء حسب التصميم (لا يُعدَّ خللاً)
- `proxy.ts:64-68` — طلب HTTP داخلي كامل إلى `/api/auth/verify-admin` عند كل طلب إداري (قرار موثّق
  لعدم لمس الـ DB من الـ Edge؛ مقايضة أداء مقبولة لكن يمكن بديلاً التحقق من JWT مباشرة في الـ Edge).
- `(viewer)/layout.tsx:17-61` — قراءة `getAllSettings` + كتابة `trackView` عند كل طلب عام (ديناميكية
  مقصودة لانعكاس تغييرات الإعدادات فورياً).

---

## ✅ ملاحظات إيجابية

- **الالتزام الكامل بنمط Patterns**: كل صفحات (viewer) إما re-export رفيع (Pattern C) أو صفحة رفيعة
  بمكوّن واحد (Pattern A/B) — مطابق لـ AGENTS.md حرفياً.
- **الحماية المركزية سليمة**: `/admin/*` محمية حصرياً عبر `proxy.ts` (فحص cookie ثم `verify-admin`)،
  ووضع الحماية/الصيانة للواجهة العامة مركز في `(viewer)/layout.tsx` مع `redirect` واحد.
- **تتبع الزوار غير حرج**: `trackView` داخل try/catch وbest-effort (لن يُسقط الصفحة العامة).
- **عزل ثيم الإدارة**: `admin/layout.tsx` عبر `useSyncExternalStore` + `localStorage` فقط — مطابق لقاعدة
  الثيم العميل (لا خادم، لا قاعدة بيانات، لا تأثير متبادل بين المتصفحات).
- **`DEFAULT_IMAGES`** مستخدمة فعلاً وموثقة بـ TSDoc مع ربطها بالخادم (`image_placeholder_dir`).
- **skip-link للوصول** في `(viewer)/layout.tsx` مع تعليق عربي يشرح القرار الأمني لـ `x-visitor-session-id`.

---

## ما يحتاج تأكيداً

| # | الموضوع | أين |
|---|---------|-----|
| 1 | هل منصة LAN خاصة ⇒ تعطيل الفهرسة مقصود (وحذف robots/sitemap)، أم عام ⇒ إزالة `index:false`؟ | `layout.tsx:110` vs `robots.ts` |
| 2 | هل «/register» و«/forgot-password» ميزتان مقصودتان مستقبلاً؟ | `proxy.ts:5` |
| 3 | هل صفحة تسجيل الدخول يجب أن تتبع ثيم الإدارة (admin-layout) أم الثيم العام؟ | `(auth)/layout.tsx:7` |

---

## مؤشرات خط الأساس (المرحلة 0)

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` | ✅ 0 أخطاء |
| `npm run lint` | ⚠️ 0 أخطاء / 63 تحذيراً |
| `npm test` | ✅ 22 ملف / 128 اختبار ناجحاً |
