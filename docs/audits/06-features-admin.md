# مراجعة المرحلة 6 — `src/features/admin`

> تقرير المراجعة المرحلية السادسة من خطة التدقيق الشامل (7 مراحل، 5 مناطق، 5 أبعاد).
> النطاق: `src/features/admin` (65 ملفاً؛ ≈13,404 سطراً: 21 صفحة + 22 هوكاً + ~21 مكوّناً + ملف أنواع).
> الأبعاد: فحص عام، معمارية/Layering، أمن، TSDoc، أداء. **بدون إصلاحات** — تقرير فقط.

## خط الأساس

- `npm run typecheck` ✅ | `npm run lint` ⚠️ 0 أخطاء / 63 تحذيراً (على مستوى المشروع) | `npm test` ✅ 128/128.
- المقروء: صفحات dashboard/events/items-control/libraries/users/settings/messages/requests/welcome/help + أكبر مكوّن (ItemManagementDialog 768) + الهوكات المحورية (use-admin-media, use-admin-events-sse, use-admin-realtime, use-admin-license, use-folder-picker) + ملف الأنواع.

**خلاصة مبدئية مهمة**: المنطقة الأعلى نضجاً في المشروع — **صفر كود معلّق، صفر `console.log`، طبقة API موحّدة، TSDoc شامل**. لا توجد ثغرة أمنية جديدة مكتشفة في هذه الطبقة. ما تبقّى متوسط/منخفض وأغلبه عقد SSOT وتكرار أنظمة.

---

## 🔴 عالية الخطورة (High)

لا توجد اكتشافات جديدة بهذا المستوى في `features/admin`. (خلافاً للمراحل 1–5.)

> ✅ راجع: اكتشافات المرحلة 4 المتعلقة بهذه المنطقة باقية على مستواها في الطبقة الخادمية (لم تتغير). ويرد أدناه الربط المتبادل.

---

## 🟠 متوسطة الخطورة (Medium)

### M1 — ربط مباشر باكتشاف IDOR للمرحلة 4 (استهلاك مشروع لنقطة ضعيفة)
- `components/users/user-detail-modal.tsx:38-40` و`hooks/use-admin-users.ts:162-180` يستدعيان `/api/user/${id}/stats` و`/api/user/${id}/activity` و`/api/user/${id}/sessions` — وهي النقاط التي صنّفتها المرحلة 4 🔴 H1 (بلا فحص ملكية/مدير خادمياً، `user-controller.ts:59-67,83` + `user-service.ts:289-314`).
- الاستخدام هنا **مشروع من عميل المدير**، لكن الإصلاح الخادمي (فرض `requireAdmin`/`requireAuth` مع `ctx.isAdmin`) لا يكسر هذه الشاشة طالما المعرّف يأتي من جلسة مدير مُتحقَّق منها. **الربط إلزامي عند الإصلاح.**

### M2 — هجرة نظامَي الـ API المتوازيين إلى الإدارة
- `components/exclusive/media-selector-modal.tsx:6,73,90` يستخدم `apiClient` (النظام الموازي من المرحلة 2 H2) بينما **كل** الهوكات الأخرى تستخدم عائلة `apiFetch/apiPost/apiPut/apiPatch/apiDelete`. نافذة واحدة في المنطقة تكسر نمط الاستدعاء الموحد.

### M3 — تكرار اتصال SSE ونسخ أسماء الأحداث
- `hooks/use-admin-events-sse.ts` (سطر 123) و`use-admin-realtime.ts` (سطر 57) يفتحان **اتصالَي `EventSource` مستقلّين** على `/api/admin/events`، وكلاهما ينسخ قائمة أسماء الأحداث نصياً (SSE_EVENTS في الأول + أحداث مُرمَّزة في الثاني: `enrichment_progress`, `media:changed`, `media_updated`, `translation_progress`, `metadata_completed`). عند تركيب الهوكين على الصفحة نفسها → اتصالان للـ SSE لنفس النقطة. (يرتبط أيضاً بمخرجات المرحلة 4 M1: نقاط SSE خارج DI.)

### M4 — ألوان حرفية دلالية تتسرب خارج الـ tokens (18 موضعاً)
- أمثلة: users-page:239,357 (`text-green-500`)، messages-page:186-187/312-313 (أخضر/كهرماني)، events-page:232-245 (`bg-emerald-600`, `bg-red-700`, `bg-amber-600`) و:488-489، requests-page:210 (`text-green-700`)، items-control:79/210/152، background-job-banner:89 (`text-green-600`)، admin-stats-cards:36، license-page:135/188، exclusive-form/manager:192/201 (`fill-yellow-400`).
- التكرار **متسق الدلالة** (أخضر=نجاح، كهرماني=معلق، أحمر=خطأ) لكنه يتجاوز CSS Variables؛ مع أن نطاق `.admin-layout` يُفرض عليه قيم خاصة، أي تغيير سمة يتطلب لمس 18 موضعاً.

### M5 — مسارات حرفية بدل `ROUTES.*`
- `pages/welcome-page.tsx:24,32` — `/admin/dashboard` و`/admin/settings` مكتوبتان نصاً (نفس مخالفة المرحلة 3 M1).
- `components/exclusive/exclusive-form-modal.tsx:171` — نص تلميح `placeholder="/itemView/movie/123"` يرمز المسار بشكل حرفي (تلميح فقط، لكن يُفضل بناؤه من `ROUTES`).

### M6 — بناء روابط الصور يدوياً
- `components/items-control/ItemManagementDialog.tsx:366` — `/api/images/${item.media_id}?type=${type}&w=800&h=1200` (نفس النمط المكرر من viewer؛ يُفضل image-helpers).

### M7 — قائمة أنواع مستثناة مضمّنة
- `hooks/use-admin-media.ts:114` — `excludeTypes: "season,episode,series_sports,series_deen"` كنص مفصول بفواصل داخل البناء. هذه تصنيف أنواع (taxonomy) يُحتاج فيها إلى مصدر واحد (تأكيد: هل توجد قائمة أنواع معتمدة مركزيّة؟).

### M8 — `process.env` مباشر مع fallback حرفي
- `hooks/use-folder-picker.ts:6` — `process.env.NEXT_PUBLIC_FOLDER_PICKER_URL || "http://localhost:5199"` (مطابق تماماً لما في viewer `use-open-folder.ts:10` — النسختان يجب توحيدهما في ثابت واحد). `NEXT_PUBLIC_*` معفاة من `getEnv()` لأنها تُحقن وقت البناء، لكن fallback المنفذ يجب أن يكون معرفاً مركزياً.

### M9 — عرض `error.message` الخام (سلسلة المرحلة 4 H3)
- `pages/events-page.tsx:522-524` — بانر فشل يعرض `error.message` مباشرة، ومعها 30+ موضعاً من نمط `toast.error(error instanceof Error ? error.message : ...)`. هذا يمرر للواجهة نص الخطأ كما يصل من الخادم — وبما أن `handleRouteError:92` يصدّر الرسالة الخام عند 500، فالسلوك النهائي يعتمد على الخادم. يستحق توحيد التعريب في `apiFetch`/`handleRouteError`.

---

## 🟡 منخفضة الخطورة (Low)

- **L1 — إملاء عربي غير موحّد**: «احداث» بلا همزة (events-page:475,478,515,534,548,563) و«الامان» (563) بدل «أحداث»/«الأمان» — مخالفة قاعدة «No broken Arabic» داخل ملف واحد.
- **L2 — تعليقا مسار شاردان**: `pages/libraries-page.tsx:1` (`//src\features\admin\pages\libraries-page.tsx اداره المكتبات (ترتيب الاقسام)`) و`hooks/use-admin-messages.ts:1`.
- **L3 — غياب "use client" في 18 ملف هوك**: الإدارة عكس viewer (حيث معظمها موجودة). ليست عيباً وظيفياً (الهوكات تُستهلك من Client Components) لكنها تباين غير متسق بين المنطقةين.
- **L4 — مسمّى دلالي ملتبس**: `ItemManagementDialog.tsx:195` يملأ `tags` من `details.genres` — نفس البيانات لكن المسمّيان مختلفان؛ يحتاج توضيح نية.
- **L5 — fetch خام مبرَّر بلا تجميع**: `use-admin-database.ts:69` (استعادة نسخة احتياطية FormData) و`use-admin-users.ts:153` (رفع صورة رمزية FormData) و`use-admin-license.ts:55` (مضغوط + يحتاج message/error معاً — موثّق). كلها استثناءات معقولة، لكنها نمط يصلح للتجميع في مساعد ملفات موحد.
- **L6 — `key={idx|i}`**: 14 موضعاً — كلها داخل Skeleton/مصفوفات ثابتة (مقبولة).
- **L7 — TSDoc باللغة الإنجليزية**: `admin-stats-cards.tsx:14-18` بينما معيار المشروع عربي.
- **L8 — `max-h-80vh`/`max-h-[70vh]`**: قيم viewport حرفية — مقبولة (خارج شبكة 4px).

---

## ✅ إيجابيات (معيار المنطقة — الأفضل في المشروع)

- **صفر كود معلّق** في 13,404 سطر (مقابل ≈1400 سطر في viewer) و**صفر `console.log`** (مقابل 4 في viewer) — التباين قاطع بين المنطقتين.
- **طبقة API موحّدة فعلياً**: كل الهوكات تعبر `@/lib/frontend/api` (apiFetch/Post/Put/Patch/Delete) مع فحص `res.success` قبل `throw` — عقد متسق مع المرحلة 4 (الاستثناء M2 أعلاه).
- **TSDoc شامل ومستوفي**: هوكات الإدارة موثّقة `@param/@returns` بالعربية، مع إشارات مصدر الحقيقة (مثل `types/exclusive.ts` — يوثّق السورس والنطاق والقيود).
- **فصل سمة الإدارة**: كلاسات `.admin-layout` / `.admin-raised` / `.admin-sunken` / `.admin-scroll` النطاقية موثّقة في events-page:16-17 — تجسيد فعلي لقاعدة «Admin Theme Separation».
- **استخدام SSOT**: `MEDIA_TYPE_OPTIONS` من translate.ts في ItemManagementDialog:29,586.
- **إدارة حالة متقدمة**: queryKey factories (`adminMediaKeys`, `licenseKeys`) + إبطال مفتوح عند النجاح + عدّاد `mediaVersion` عبر SSE لتحديث القوائم دون Polling (use-admin-realtime).
- **SSE نظيف**: إغلاق في `useEffect` cleanup، `JSON.parse` محمي، حالة `connected/error`، وفصل الأحداث المحفوظة عن الحية (PERSISTED_SSE_EVENTS).
- **نماذج معقدة محكمة**: ItemManagementDialog يحافظ على أدوار الطاقم غير المعروضة (buildPeople + otherCrewCount) ويلغي المطلوب غير المركّب عند الفك، وChipInputField مع إزالة تكرار.
- **أمان تحسيني**: `window.open(..., "noopener,noreferrer")`، سلسلة `?` في الموافقات، مفاتيح React Query مفتوحة.
- **دوال تحويل صحيحة**: formatDetails/formatSecurityDetails/getRelativeTime تعالج صيغ التاريخ المختلطة (UTC vs SQLite) بتوثيق دقيق (events-page:209-224).

---

## ❓ بحاجة تأكيد (لم تُحتسم)

1. **`excludeTypes` في use-admin-media:114**: هل `season,episode,series_sports,series_deen` قائمة مستقرة معتمدة من الخلفية (مثل `CONTENT_TYPES`) أم يجب أن تُقرأ من مصدر واحد؟ تحقق من backend types/enums.
2. **الهوكان SSE**: هل يُركّبان على نفس الشاشة معاً؟ إن لم يكونا كذلك فـ M3 مجرد تكرار اسمي؛ وإن اجتمعا فهي اتصالات مكررة فعلية.
3. **`tags` من `genres`**: نفس الشيء أم حقلان مختلفان في DB؟
4. **استخدام `apiClient` في media-selector-modal**: مقصود (لأن apiClient يوفر `get<MediaTypeRow[]>`) أم بقايا من النظم الموازية؟ (يرتبط بمرحلة 2 H2.)

---

## خلاصة

المرحلة السادسة تثبت أن منطقة الإدارة **معيار الجودة للمشروع**: لا كود ميت، لا تسجيل زائد، طبقة API واحدة، توثيق شامل، وفصل سمة فعال. اكتشافاتها المتوسطة تدور حول عقد SSOT المهجور (مسارات، ألوان، قائمة أنواع، روابط صور) وربط مباشر بثغرة المرحلة 4 (IDOR) التي تبقى على المستوى الخادمي. **أولوية الإصلاح: توحيد نظامَي الـ API → ربط M1 → توحيد ثابت FOLDER_PICKER_URL → الألوان/المسارات.**

أُنشئ: 2026-08-13 | المرحلة التالية: `00-overview.md` (التوحيد النهائي).
