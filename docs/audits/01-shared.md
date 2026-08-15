# المرحلة 1 — مراجعة `src/shared` (Audit Report)

> **النوع:** Audit Report (تحقيق قراءة فقط — لم يتم إجراء أي تعديل)
>
> **التاريخ:** 2026-08-13
>
> **النطاق:** `src/shared` بالكامل — `components/ui` (36 ملفاً)، `components/layout` (10 ملفات)،
> `constants` (ملفان)، `hooks` (4 ملفات + readme)، `types` (ملف)، `utils` (3 ملفات). المجموع 53 ملفاً / ~3,335 سطراً.
>
> **المنهجية:** قراءة كل ملف، التحقق من المستهلكين عبر grep لكل تصدير مشكوك فيه،
> التحقق من التتبع في git للملفات الفارغة، ومقارنة كل اكتشاف بقواعد AGENTS.md
> (SSOT، فصل الطبقات، لا كود ميت، TSDoc، أمن، أداء).

## الملخص التنفيذي

الطبقة سليمة البنية عموماً: احترام جيد لـ SSOT (`APP_NAME`، `ROUTES`، `DEFAULT_IMAGES`) في
مكونات الـ layout، وبدون أي `any` أو `@ts-ignore`، مع أمثلة توثيق ممتازة (Switch، MaintenanceScreen، ViewerNavigation).

لكن هناك **نمطان منهجيان**:

1. **كود ميت واسع النطاق** — 7 ملفات UI فارغة + 4 ملفات hooks فارغة (كلها متتبعة في git)،
   ومئات الأسطر من الكود المعلّق في `dropdown-menu` و`spinner` و`listing-page` و`sections-grid` و`viewer-header`.
2. **انتهاك طبقات متكرر** — `shared/layout/*` تستورد من `@/app/admin/layout` (حلقة استيراد دائرية)
   ومن `@/features/viewer/*`، بينما `shared` يفترض أن تكون الطبقة القاعدية.

مع وجود **خطأ بصري محقق** في `Checkbox` (فقدان صنف `peer`) ومخاطرة تشغيل في `getDeviceId`
(`crypto.randomUUID` غير متوفر في سياق HTTP لشبكة LAN).

---

## 🔴 Critical

لا توجد اكتشافات حرجة (لا ثغرة أمنية مباشرة، ولا كسر عقد مُحقق).

---

## 🟠 High

### H1 — ملفات فارغة متتبعة في git توحي بوجود كود غير موجود

**الملفات:**
- `src/shared/hooks/useDebounce.ts`, `useLocalStorage.ts`, `use-infinite-scroll.ts`, `use-media-filters.ts` — 0 أسطر.
- `src/shared/components/ui/accordion.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `collapsible.tsx`, `drawer.tsx` — 0 أسطر.
- `src/shared/components/ui/calendar.tsx`, `hover-card.tsx` — سطر مسافة بيضاء واحد.

**Evidence:**
- `git ls-files` يؤكد تتبعها كلها في المستودع.
- grep يؤكد عدم استيراد أي منها في أي مكان (`shared/hooks|useDebounce|use-infinite-scroll|use-media-filters` → 0 نتيجة).
- `src/shared/hooks/readme.md` **يدّعي** أن `useDebounce`, `useLocalStorage`, `useToggle`, `useInfiniteScroll` موجودة ويصف مكانها الصحيح — توثيق كاذب لملفات فارغة.

**Recommended Fix:**
- حذف الملفات الفارغة غير المستخدمة (أو تنفيذ الـ hooks الموعودة فعلاً إن كانت مطلوبة).
- حذف/إعادة كتابة `readme.md` (هو أثر محادثة ChatGPT منسوخة — ليس توثيقاً للمشروع).

---

### H2 — `Checkbox`: فقدان صنف `peer` يكسر الحالة البصرية عند التحديد

**الملف:** `src/shared/components/ui/checkbox.tsx:28`

**Root Cause:**
- الإدخال المخفي يحمل `className="sr-only"` فقط (سطر 28) دون صنف `peer`.
- الصندوق المرئي (سطر 37) يعتمد على `peer-checked:bg-primary peer-checked:border-primary`،
  و`peer-focus-visible:*` (سطر 38)، و`peer-disabled:*` (سطر 39).
- في CSS الخاص بـ Tailwind، محدد `peer-checked:` يستهدف الأخ **المسبوق بصنف `peer`** — دونه لا يُفعَّل أي منها.
- يبقى الأيقونة `Check` تُعرض عبر `{checked && ...}` (سطر 44)، لكن الخلفية/الحدود/حلقة التركيز/حالة التعطيل لا تعمل.

**Evidence (مقارنة داخلية):**
- `src/shared/components/ui/switch.tsx:10-13` **يوثق صراحة** هذه المشكلة ذاتها: «الحالة تُشتق من خاصية `checked` وليس من أقواس CSS `peer` التي تتطلب ترتيب أشقاء لا ينطبق هنا» — وهذا يؤكد أن نمط `peer` المتبع في `Checkbox` معطوب.

**Recommended Fix:**
- إضافة `peer` إلى صنف الإدخال: `className="peer sr-only"`، أو تبني نمط `checked` الشرطي كما في `Switch`.

---

### H3 — `getDeviceId`: `crypto.randomUUID` معطل في سياق HTTP (نشر LAN)

**الملف:** `src/shared/utils/device.ts:19`

**Root Cause:**
- `crypto.randomUUID()` متوفر فقط في السياقات الآمنة (HTTPS أو localhost).
- المشروع يستهدف النشر عبر LAN (`npm run dev:lan` / `start:lan` على `0.0.0.0`) — أي وصول عبر `http://192.168.x.x` يُعد سياقاً غير آمن في المتصفحات الحديثة.
- عندها `crypto.randomUUID` يكون `undefined` → `TypeError` → انهيار `getDeviceId` → تعطّل ميزة طلبات الزوار (`use-visitor-request.ts:14`).

**Recommended Fix:**
- بديل آمن: توليد UUID v4 يدوياً (Math.random/crypto.getRandomValues مع `crypto.getRandomValues` في حال توفره) مع التحقق `typeof crypto.randomUUID === "function"`.

---

### H4 — `DropdownMenu`: 178 سطراً من الكود المعلّق (تطبيق قديم كامل)

**الملف:** `src/shared/components/ui/dropdown-menu.tsx:1-178`

**Evidence:**
- التنفيذ الحالي يبدأ من سطر 179 (`"use client"`)، وقبله نسخة كاملة معلّقة من تطبيق سابق (Context + Trigger + Content + Item + Separator + Label).
- مخالفة صريحة لقاعدة «لا كود ميت — لا كتل معلّقة».

**Recommended Fix:** حذف الأسطر 1–178.

---

## 🟠/🟡 Moderate

### M1 — `shared/layout/*` يستورد من `@/app/admin/layout` (كسر طبقات + حلقة دائرية)

**الملفات:**
- `src/shared/components/layout/admin-header.tsx:6` → `import { useAdminTheme, useAdminSidebar } from "@/app/admin/layout"`
- `src/shared/components/layout/admin-sidebar.tsx:34` → نفس الاستيراد

**Root Cause:**
- `src/app/admin/layout.tsx` يستورد `AdminHeader` و `AdminSidebar` من `shared`، والمكوّنان يستوردان الـ hooks من `app/admin/layout` → **استيراد دائري** بين طبقة الـ shared وطبقة المسارات.
- يعمل حالياً لأن الـ hooks تُستدعى داخل دوال المكونات (وليس على مستوى الوحدة)، لكنه هش ويخالف فصل الطبقات (shared = طبقة قاعدية بلا استيراد تصاعدي).

**Recommended Fix:** نقل تعريفات `useAdminSidebar` / `useAdminTheme` (مع Context) إلى `src/shared/` (مثلاً `src/shared/contexts/admin-layout.tsx`) واستيرادها منه في `app/admin/layout.tsx` والمكونات معاً — يكسر الحلقة ويعيد الاتجاه الصحيح.

---

### M2 — `shared/layout/*` يستورد من `@/features/*` (استيراد تصاعدي)

**الملفات:**
- `src/shared/components/layout/listing-page.tsx:4` → `@/features/viewer/components/unified-media/unified-media`
- `src/shared/components/layout/viewer-header.tsx:19-20` → `@/features/viewer/hooks/use-visitor-request` + `@/features/viewer/components/search/search-modal`
- `src/shared/components/layout/sections-grid.tsx:11` → `@/features/viewer/components/section-header`

**Root Cause:** `shared` يجب ألا يستورد من طبقة features (اتجاه التبعية يسمح فقط بـ features → shared).

**Recommended Fix:** نقل المكونات المشتركة فعلاً (ListingPage، ViewerHeader، SectionsGrid) إلى `src/features/viewer/` أو `src/lib/frontend/`، أو إعادة تصدير المكونات المشتركة عبر `src/features/viewer/components` لتجنب جعل shared يعتمد على features.

---

### M3 — `API_ROUTES` غير مستخدمة وفيها قيمة خاطئة

**الملف:** `src/shared/constants/index.ts:52-58`

**Evidence:**
- grep لـ `API_ROUTES` → نتيجة واحدة فقط هي التعريف نفسه؛ لا مستهلك في كامل `src`.
- القيمة `USERS: "/api/users"` **خاطئة** — المسار الفعلي مفرد `/api/user` (تحقق: `src/app/api/user` موجود، و`src/app/api/users` غير موجود).
- المخاطرة: أي استخدام مستقبلي سيكسر طلبات المستخدمين فوراً.

**Recommended Fix:** إما الحذف (لا مستهلك)، أو التصحيح إلى `/api/user` مع إكمال بقية المسارات المفقودة (المسارات الفعلية مفردة في `src/app/api`).

---

### M4 — `ROUTES.ADMIN_LIVE_STREAM` يشير لمسار غير موجود + عنصر قائمة «البث المباشر» رابط `#`

**الملفات:**
- `src/shared/constants/index.ts:33` → `ADMIN_LIVE_STREAM: "/admin/live-stream"` (لا يوجد `src/app/admin/live-stream`).
- `src/shared/components/layout/admin-sidebar.tsx:56` → `{ label: "البث المباشر", href: "#", icon: Tv, external: true }`.

**Evidence:** مقارنة `ROUTES.ADMIN_*` بمسارات `src/app/admin/*` (21 دليل) — لا يوجد `live-stream`؛ والقائمة تستخدم `#` بدل الثابت.

**Recommended Fix:** إزالة الثابت الميت، وتحديد وجهة حقيقية لعنصر «البث المباشر» (مثل `ROUTES.LIVE_STREAM`) أو إزالته من القائمة حتى وجود صفحة إدارية له.

---

### M5 — `src/shared/utils/index.ts`: `cn` مكرر + `formatDate`/`formatDateTime` بلا مستهلكين

**الملف:** `src/shared/utils/index.ts`

**Evidence:**
- `cn` معرّف بنفس المنطق في `src/lib/utils.ts:4` و`src/shared/utils/index.ts:4`.
- كل المستهلكين (50+ موضعاً) يستوردون من `@/lib/utils`؛ و`@/shared/utils` بلا أي استيراد (grep → 0).
- `formatDate`/`formatDateTime` تصديران بلا مستهلكين (شخصان يعرّفان `formatDate` محلياً في `person-detail-page.tsx:17` و`user-detail-modal.tsx:27` بدل استخدام المشترك).

**Recommended Fix:** حذف `cn` المكرر (إبقاء `lib/utils`)، ونقل `formatDate`/`formatDateTime` لمكان يُستهلك فعلاً أو حذفهما مع توحيد الدالتين المحليتين عليهما.

---

### M6 — `AdminSidebar`: تكرار كامل لواجهة الموبايل والديسكتوب (~130 سطراً)

**الملف:** `src/shared/components/layout/admin-sidebar.tsx:121-261` مقابل `264-401`

**Evidence:** البلوكان متطابقان تقريباً (هيدر + logo + شارة «بروفاشنال» + قائمة + زر تصغير) مع اختلاف في كلاسات الاستجابة فقط (mobile: `lg:hidden` + `closeMobile`؛ desktop: `lg:flex`).

**Recommended Fix:** توحيد في مكوّن واحد `<aside>` بكلاسات `lg:` مشروطة، أو مكوّن داخلي مشترك للهيدر والقائمة.

---

### M7 — `LibraryFilters` يعيد بناء select/input يدوياً بدل الـ primitives المشتركة

**الملف:** `src/shared/components/layout/library-filters.tsx:29-84`

**Evidence:** يستخدم `<select>` و`<input>` أصليين مع كلاسات مكررة (border-input، bg-background...) بينما توجد `@/shared/components/ui/select` و`@/shared/components/ui/input` (التي هي نفسها تكرر هذه الأنماط داخلياً).

**Recommended Fix:** إعادة استخدام `Select`/`Input` المشتركة لتقليل تكرار الأنماط.

---

### M8 — مخاطرة تقويم هجري في `ar-SA` (نمط عام في المشروع)

**الملفات ذات الصلة:**
- `src/shared/utils/index.ts:8-24` (دالتا `formatDate`/`formatDateTime` بـ `Intl.DateTimeFormat("ar-SA")`)
- `src/features/admin/components/users/user-detail-modal.tsx:29` (`toLocaleString("ar-SA")`)

**Root Cause:** إعداد `ar-SA` افتراضياً يستخدم التقويم الهجري (`islamic-umalqura`) في متصفحات V8/Chrome. بينما `person-detail-page.tsx:20` تستخدم `ar-EG` (ميلادي) — أي أن الصفحتين قد تعرضان تاريخين بمعيارين مختلفين لنفس النوع من البيانات.

**Recommended Fix:** تحديد `calendar: "gregory"` صراحةً: `toLocaleString("ar-SA", { calendar: "gregory" })`، وتوحيد المعيار عبر المشروع. (تأكيد بصري/تشغيلي عبر صفحة إدارة المستخدمين.)

---

### M9 — `Tooltip`: حالة مؤقت عامة على مستوى الوحدة

**الملف:** `src/shared/components/ui/tooltip.tsx:33` → `let tooltipTimer: ReturnType<typeof setTimeout> | null = null;`

**Root Cause:**
- مؤقت واحد مشترك بين **كل** نسخ `TooltipTrigger` في الصفحة: دخول أداة ثم مغادرة أداة أخرى قد يمسح/يلغي مؤقت الأداة الأولى.
- لا يوجد تنظيف للمؤقت عند unmount (خارج `handleMouseLeave`).
- خاصية `asChild` معلنة في `TooltipTriggerProps` (سطر 16) وغير مستخدمة (خاصية ميتة).

**Recommended Fix:** نقل المؤقت إلى `useRef` داخل كل `TooltipTrigger` + تنظيفه عبر `useEffect` return، وإزالة `asChild` الميتة.

---

### M10 — `Alert`: أيقونة يسار + حشوة يمين (عدم اتساق RTL)

**الملف:** `src/shared/components/ui/alert.tsx:7,45`

**Evidence:** `[&>svg]:left-4` (أيقونة يسار فيزيائياً) مع `pr-10` (حشوة يمين فيزيائياً) — في واجهة RTL يظهر التنبيه بأيقونة على اليسار وحشوة فارغة على اليمين، وهو عكس توقّع القراءة العربية (أيقونة يمين).

**Recommended Fix:** استخدام `inset-inline-start` (أو `right-4` مع `pl-10` في RTL) مع `[&>svg]:inset-inline-start`. (يحتاج تأكيد بصري.)

---

### M11 — `Progress`: اتجاه التعبئة لا يعالج RTL

**الملف:** `src/shared/components/ui/progress.tsx:38` → `style={{ transform: translateX(-(100-percent)%) }}`

**Evidence:** الحركة فيزيائية دائماً (يمين→يسار عبر `translateX`)؛ في RTL يُتوقع التعبئة من اليمين لليسار.

**Recommended Fix:** الاعتماد على `dir` (مثل `scaleX` مع `origin-inline-start` أو ضبط الـ transform حسب اتجاه الصفحة). (يحتاج تأكيد بصري.)

---

## 🟡 Low

### L1 — أخطاء صياغة/تنسيق في `crew-roles.ts`
**الملف:** `src/shared/constants/crew-roles.ts`
- `:55` → `Producer: " منتج  "` — مسافات حول النص تظهر بيضاء في الواجهة (`crew-member-card.tsx:16`).
- `:21` مسافة بادئة زائدة قبل `"Director"`، و`:41` مسافة قبل `Screenplay: 4`.
- تعليقات عمل باقية «صعدنا ترتيبه/ترتيبها» (`:23-24`).

### L2 — كود معلّق متفرق في `layout/`
- `listing-page.tsx:71,85,97` — سطر wrapper سابق معلّق 3 مرات.
- `sections-grid.tsx:182-190` — كتلة عنوان سابقة معلّقة.
- `viewer-header.tsx:69-70,72` — هيدر وحاوية سابقة معلّقان.

### L3 — استيرادات `cn` معلّقة في المكونات (نمط متكرر)
- `ui/spinner.tsx:1`، `ui/dropdown-menu.tsx:4`، وملفات features لاحقاً (`unified-media.tsx:13,346`، `section-header.tsx:4,88,190,313`، `media-card.tsx:5`) — أسطر استيراد معلقة مخالفة لقاعدة الكود الميت.

### L4 — `AdminHeader`/`admin-sidebar`: مسارات مكتوبة يدوياً
- `admin-header.tsx:33` → `router.push("/login")` بدل `ROUTES.LOGIN`.
- `admin-sidebar.tsx:139,167,280,307` → `src="/estra7ah.svg"` مباشرة بدل ثابت، مع تفاوت بين `<img>` و`<Image>` في نفس الملف.

### L5 — `Pagination`: `aria-label="pagination"` بالإنجليزية + بلا TSDoc على `getPageNumbers`
**الملف:** `src/shared/components/ui/pagination.tsx:15,42`

### L6 — `Tabs`: `role="tab"` بلا `role="tablist"` ولا `aria-selected` ولا تنقل بلوحة المفاتيح
**الملف:** `src/shared/components/ui/tabs.tsx`

### L7 — نقص TSDoc منتظم في الـ primitives
- `checkbox.tsx`، `input.tsx`، `select.tsx`، `textarea.tsx`، `button.tsx`، `badge.tsx`، `avatar.tsx` (`getInitials`)، `library-filters.tsx`، `navLinks` في `viewer-navigation.tsx`، وكل متغيرات `cva` — بلا TSDoc رغم أن `switch.tsx` و`viewer-navigation.tsx` و`maintenance-screen.tsx` تلتزم بالمعيار (مرجع إيجابي).

### L8 — `media-grid.tsx`: `grid-cols-[repeat(auto-fill,minmax(160px,1fr))]` بلا بديل أصلي
**الملف:** `src/shared/components/ui/media-grid.tsx:13` — قوس تعسفي (يُقبل لغياب بديل أصلي في Tailwind v4، لكن يُلاحظ لتوحيد نمط الشبكات).

### L9 — `admin/layout.tsx`: فراغات زائدة في `className`
**الملف:** `src/app/admin/layout.tsx:145,162` → `"admin-layout bg-background text-foreground flex min-h-screen         "` (نقل `AdminLayout` إلى نطاق الـ shared سيعالج M1 أيضاً).

---

## ✅ ملاحظات إيجابية

- **SSOT محترم في الـ layout**: `ViewerFooter`/`ViewerHeader` تستخدمان `APP_NAME`؛ و`admin-sidebar`/`viewer-navigation` تستخدمان `ROUTES` حصرياً (استثناء: `#` و`/login` أعلاه).
- **`Switch`**: نموذج TSDoc ممتاز + نمط حالة بصرية حتمي من `checked` (وثّق سبب تجنّب `peer`).
- **`ViewerHeader`**: `useSyncExternalStore` لقراءة آمنة من SSR، وسم `inert` لقائمة الموبايل، و`aria-expanded`/`aria-controls` (التزام جيد بإمكانية الوصول).
- **`sections-grid`**: استخدام `inset-s-2`/`inset-e-2` (منطقي RTL) في الشارات.
- **لا `any` صريح ولا `@ts-ignore` في كامل الطبقة.**
- **`getSectionImageUrl`/`buildSectionLink`/`SectionCard`** بتوثيق عربي كامل يشرح «لماذا» وليس فقط «ماذا».

---

## ما يحتاج تأكيداً

| # | الموضوع | أين |
|---|---------|-----|
| 1 | هل يُقصد عرض تواريخ هجرية في واجهة الإدارة؟ (المعيار الحالي `ar-SA` يعرض هجرياً افتراضياً) | `user-detail-modal.tsx:29` + `shared/utils/index.ts:9` |
| 2 | هل تُستخدم `Accordion`/`AlertDialog`/`Drawer`/`Calendar` فعلاً في ميزة قادمة (وإلا حذف)؟ | `shared/components/ui/*` |
| 3 | هل «البث المباشر» في قائمة الإدارة له صفحة مقصودة لم تُبنَ بعد؟ | `admin-sidebar.tsx:56` |
| 4 | `Alert` و`Progress` — تأكيد بصري لتوجه RTL قبل التعديل | `ui/alert.tsx`، `ui/progress.tsx` |
| 5 | نشر LAN فعلي عبر HTTP (غير localhost) — لتأكيد أثر H3 | `device.ts:19` |

---

## مؤشرات خط الأساس (المرحلة 0)

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` | ✅ 0 أخطاء |
| `npm run lint` | ⚠️ 0 أخطاء / 63 تحذيراً (3 منها في shared: `admin-sidebar` ×2 `<img>`، `sections-grid` ×1، `avatar` ×1) |
| `npm test` | ✅ 22 ملف / 128 اختبار ناجحاً |
