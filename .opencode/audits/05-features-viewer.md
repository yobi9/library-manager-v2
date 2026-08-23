# مراجعة المرحلة 5 — `src/features/viewer`

> تقرير المراجعة المرحلية الخامسة من خطة التدقيق الشامل (7 مراحل، 5 مناطق، 5 أبعاد).
> النطاق: `src/features/viewer` (33 ملفاً؛ ≈4811 سطراً TSX + 423 سطراً TS).
> الأبعاد: فحص عام، معمارية/Layering، أمن، TSDoc، أداء. **بدون إصلاحات** — تقرير فقط.

## خط الأساس

- `npm run typecheck` ✅ | `npm run lint` ⚠️ 0 أخطاء / 63 تحذيراً (على مستوى المشروع) | `npm test` ✅ 128/128.
- المقروء في هذه المرحلة: كل ملفات `pages/` (13)، كل مكونات `components/` (بما فيها `home/` و`audio-player/` و`search/`)، وكل `hooks/` (5).

---

## 🔴 عالية الخطورة (High)

### H1 — كتل كود معلّقة ضخمة (~1400 سطر) في المكونات المحورية
مخالفة مباشرة وصريحة لقاعدة **«لا كود ميت»** في AGENTS. الكود المعلّق هو الحجم الأكبر للاكتشافات في هذه المرحلة:

| الملف | الموقع | الحجم |
|---|---|---|
| `components/unified-media/unified-media.tsx` | أسطر 1–689 (تطبيقان كاملان قديمان) قبل الكود النشط | ≈690 سطراً |
| `components/section-header.tsx` | أسطر 1–447 (ثلاث نسخ متداخلة `// // //` متتالية) | ≈447 سطراً |
| `components/media-card/media-card.tsx` | أسطر 1–146 (النسخة القديمة) + كتلة JSX معلّقة 282–295 | ≈162 سطراً |
| `pages/home-page.tsx` | أغلب الملف (~100 من 148) نسختان قديمتان معلّقتان | ≈100 سطراً |

الأثر: صعوبة قراءة الملفات الفعلية، تضخم الـ diff، وإخفاء الكود النشط. هذه الملفات الأربعة هي الأكثر استخداماً في الواجهة (UnifiedMedia يُستهلك من كل مقاطع الصفحة الرئيسية وpinned/favorites؛ SectionHeader وMediaCard من مكتبة العرض). **الإزالة مطلوبة قبل أي عمل مستقبلي على هذه المكونات.**

### H2 — نص وهمي (Placeholder) يظهر فعلياً في الواجهة
- `components/media-card/media-card.tsx:311` — `{year || "[السنة]"}` يعرض **"[السنة]" حرفياً** للمستخدم عند غياب السنة. مخالفة مباشرة لقاعدة **«No placeholder text»**.
- ضمن نفس الملف أسطر 282–295: النسخة المعلّقة القديمة كانت تحوي أيضاً `[السنة]` — دليل أن النص الوهمي نُقل من الكود الميت إلى الكود النشط.

### H3 — ادعاء SSOT للأنواع الصوتية مكسور
- `components/audio-player/types.ts:3-9` يعلن بخط عريض: «المصدر الوحيد للحقيقة ... لا توجد مصفوفة موازية للأنواع الصوتية في أي مكان آخر».
- بينما `pages/album-player-page.tsx:34` يفلتر المقاطع بـ `c.type === "song" || c.type === "track"` — والقيمة **`"track"` غير موجودة في `AUDIO_TYPES`** (المصفوفة: `music, singer, album, song`).
- العاقبة المحتملة: عنصر من نوع `track` يُدرج في قائمة المشغل، لكن `isAudioType("track")` ترجع `false` فيُبنى له مسار غير صوتي عبر `buildMediaUrl` — سلوك غير متسق، وكسر للعقد الذي تعلنه نفس الملفات.
- يرتبط مباشرة باكتشاف المرحلة 2 (تناقض مسار `fetchRecommendations`).

---

## 🟠 متوسطة الخطورة (Medium)

### M1 — خاصية ميتة + ملاحظات تطوير داخل `media-actions.tsx`
- سطر 18: `hasChildren?: boolean; // ← إضافة` — **غير مفكوكة البنية إطلاقاً** (التحقق من كل القاعدة: لا يوجد مستهلك واحد)، أي prop ميتة مع تعليق تطويري.
- سطر 47: `// ✅ تم إضافة الشرط هنا` — تعليق WIP.
- أسطر 39–45: رابط «شاهد الآن» معلّق.
- أسطر 11–15: فراغات/محاذاة غير متسقة.

### M2 — تسجيل (console.log) يفضح مسارات مجلدات المستخدم
- `hooks/use-open-folder.ts:23` يسجل الرابط الكامل مع المسار المُرمّز، وسطر 27 يسجل `status|ok|body`، وسطر 55 يسجل المسار الخام `JSON.stringify(path)`، وسطر 57 `console.warn`. الإفصاح من جهة العميل لكنه يكشف البنية المحلية (أسماء مجلدات، مسارات UNC) في وحدة تحكم المتصفح ويُعدّ بقايا تطوير. الوظيفة نفسها سليمة وبسيطة.

### M3 — نمط هجين متعارض لنفس الخاصية + تنسيق مكسور في `media-card.tsx`
- سطر 299: كلاس `mt-3.75` **و** سطر 302: inline `marginTop: "15px"` — خاصية واحدة من مصدرين (inline يتغلب، والكلاس بلا أثر). مع `textShadow` inline (سطر 301). هذه الثلاثية تشي بأن الكتلة أُعيد لصقها من نسخة قديمة.
- أسطر 297–313: الكتلة النشطة بلا indent صحيح، بينما السطر 281 تعليقان متتاليان أحدهما يصف كتلة محذوفة.

### M4 — مسارات حرفية بدل `ROUTES.*` (مخالفة SSOT للمسارات)
تتكرر نفس مخالفة المرحلة 3 داخل مكونات المشاهد:
- `pages/item-detail-page.tsx` — `/items/${libraryId}` و`/new` و`/certification/...`.
- `pages/person-detail-page.tsx:80-81` — `"/"` و`/person` في الـ breadcrumb.
- `pages/certification-items-page.tsx:24-25` — `"/"` و`/certification` (مع تعليق `// ✅ تم التصحيح`).
- `components/home/hero.tsx:70` — `/itemView/${typeLabel}/${mediaId}`.

### M5 — بناء روابط الصور يدوياً في 3 أماكن
- `components/home/hero.tsx:30` — `/api/images/${id}?type=backdrop&w=1920&h=1080`.
- `components/crew-member-card.tsx` و`pages/people-directory-page.tsx` و`pages/person-detail-page.tsx` — أنماط `/api/images/${personId}?type=person...`.
- بينما `episode-card.tsx` يستخدم `getEpisodeStillUrl` من `image-helpers` (نمط سليم). المسارات اليدوية تُكرّر سلسلة الاستعلام (معاملات العرض) وتخالف «reuse before creating».

### M6 — صياغة Tailwind v3 قديمة داخل `section-header.tsx`
- سطر 486: `bg-gradient-to-r` (مرتان: للنسخة ولـ `before:`) — بينما معيار المشروع (والمستخدم فعلياً في الملفات المجاورة) هو `bg-linear-to-r`.
- سطر 483: `w-[100%]` — يُكتب `w-full`.
- سطر 516: `dir="rtl"` زائدة (الجذر `html` موجّه RTL أصلاً).
- سطر 550: `text-red-500` مقابل سطر 557 `text-destructive` — لنفس عنصر «النقطة» في نفس الملف (تناقض داخل الملف الواحد).

### M7 — تمرير الإعدادات كنوع مفتوح
- `components/home/TypeSectionSlider.tsx:65` — `settings: Record<string, unknown>` مع فهرسة مفاتيح نصية (`settings[section.settingsKey]`) بدل النوع المُهيكل `PublicSettings` — تجاوز لنظام الأنواع، ويفقد التحقق عند تغيير اسم المفتاح. (يندرج ضمنه غياب TSDoc لـ `TypeSectionSlider` و`EnabledTypeSections`.)

### M8 — ألوان حرفية تتسرب إلى عدة مكونات
- `unified-card` (bg-green-600 / bg-yellow-500)، `ratings-page` (`text-yellow-500`)، `hero.tsx:105` (`text-yellow-400`)، `media-card` (bg-black/70 + text-yellow-400/text-red-500)، `crew-member-card` (ألوان أدوار)، `section-header` (أعلاه). نظام التصميم يعتمد على CSS Variables والـ tokens — الألوان الحرفية تنكسر مع الوضع الداكن/المخصص.

### M9 — `role="button"` بلا `onKeyDown` في `unified-card.tsx`
- أسطر 106–111 و156–160: عناصر تفاعلية `role="button"` بلا دعم لوحة المفاتيح — بينما `episode-card.tsx` يطبّق `onKeyDown` (Enter/Space) بشكل صحيح، أي أن الممارسة السليمة معروفة في القاعدة وغير مطبقة هنا.

---

## 🟡 منخفضة الخطورة (Low)

- **L1 — تعليقات مسار شاردة في أول سطر** بنمط `//src\features\viewer\...`: hero، pinned-slider، favorites-slider، TypeSectionSlider، player-page، album-player-page، video-player، episode-card، people-directory، person-detail، audio-player، section-header. (نمط منهجي يتكرر أيضاً في `app` و`lib`.)
- **L2 — مسافات مكررة داخل `className`**: pinned-slider:16 (`h-5 w-5  `)، TypeSectionSlider:16 (`text-yellow-500   `)، media-card:287، section-header:567. وأسطر بمسافات ختامية: TypeSectionSlider:8,60، crew-member-card:8.
- **L3 — تعليقات WIP/مشاعر/إنجليزية**: `// ✅ تم إضافة الشرط هنا` (media-actions:47)، `// ✅ تم التصحيح` (certification-items:25)، `// ← إضافة` (media-actions:18)، `// بنفسجي` (TypeSectionSlider:14)، `// مستوحى من تصميمك` (section-header:483)، `// تحسين النمط الافتراضي` (473)، و**`// استدعاء الهوك هنا (عدل المسار حسب مشروعك)`** (unified-media:701) — وهذا الأخير النص المحرَّم حرفياً في AGENTS.
- **L4 — نقص TSDoc لمكونات/دوال عامة**: `MediaCard`, `SectionHeader`, `TypeSectionSlider`, `EnabledTypeSections`, `navigateTo`/`handleKeyDown` (search-modal)، `toAudioTracks` (album-player)، `getPosterUrl` (media-card). المخالف لقاعدة «كل دالة منشأة أو معدّلة تحمل TSDoc فوقها».
- **L5 — تحويلات غير آمنة صغيرة**: favorites-slider:32 `.filter(Boolean) as MediaItem[]` (يخفي عناصر فشل تحميلها)؛ use-visitor-request:21 `(await res.json()) as {...}` بلا حماية من رد غير JSON؛ use-visitor-request بلا توجيه `"use client"` (غير متسق مع بقية الـ hooks رغم أنه يُستهلك من Client Components).
- **L6 — محدد هش**: use-slider-scroll يعتمد على `[class*='shrink-0']`.
- **L7 — تعليق زائد في JSX نشط**: media-card:281-282 (تعليقان متتاليان أحدهما يصف كتلة محذوفة).

---

## ✅ إيجابيات (إعادة استخدام SSOT وبنية سليمة)

- **الالتزام بـ Pattern C**: كل الصفحات re-export بسيط من `features` (متوافق مع نتيجة المرحلة 3).
- **استخدام سليم للـ SSOT**: `buildMediaUrl` + `translateMediaType` + `DEFAULT_IMAGES` في unified-card وsearch-modal وpinned/favorites؛ `getEpisodeStillUrl` من image-helpers في episode-card؛ `CREW_ROLE_AR_LABELS` في crew-member-card.
- **Accessibility جيدة حيث طبّقت**: episode-card (onKeyDown Enter/Space)، hero (تنقل بالأسهم + aria-labels لكل أزرار التمرير)، search-modal (حالات empty/loading/error كاملة).
- **hooks نظيفة وموثّقة**: `use-watch-progress` (توثيق ممتاز)، `use-live-channels` (عبر apiClient)، `use-media`/`use-pinned` عبر UnifiedMedia بنمط `mapItemToProps`.
- **تعامل سليم مع `noUncheckedIndexedAccess`**: `results[0]` + `if (!first)` في search-modal.
- **ملفات نظيفة بالكامل**: `live-stream-page.tsx` و`certifications-page.tsx`.
- **التزام بـ Tailwind v4 حيث جُدد**: `aspect-2/3`, `h-112.5`, `min-h-112.5`, `bg-linear-to-t` في hero — مقابل انحدار `bg-gradient-to-r` في section-header.

---

## ❓ بحاجة تأكيد (لم تُحتسم — تفتقر للأدلة)

1. **`"track"` في album-player**: هل نوع `track` موجود فعلياً في بيانات `children` (من الخلفية) أم بقايا؟ إن لم يوجد يُحذف الفلتر؛ وإن وُجد يجب إدراجه في `AUDIO_TYPES`. → تحقق من قيم النوع الفعلية في DB.
2. **`SECTIONS`/`SECTION_ICONS` في TypeSectionSlider**: هل أنواع الوسائط (`movie, series, series_anime...`) ومفاتيح `settingsKey` (`show_movie...`) تطابق أنواع الخلفية ومفاتيح `PublicSettings`؟ (لا يوجد SSOT مركزي لأنواع الوسائط العامة — راجع enums/backend).
3. **MediaCard مقابل UnifiedCard**: تكرار وظيفي شبه كامل (poster + rating + type + title + views) — مقصود لصفحة المكتبة أم توحيد؟
4. **`current.href` في hero**: مصدر `href` في بيانات `exclusive_items` وهل يخضع لنفس قواعد `buildMediaUrl`؟
5. **ألوان التقييم**: `text-yellow-400`/`text-yellow-500` قصد (ذهب/تمييز) أم يجب توحيده كـ token (مثل `text-amber-*` أو `text-destructive`)؟

---

## خلاصة

المرحلة الخامسة تكرّس النمط الذي بدأ في المرحلتين 3 و4 من جهة الكود الميت، لكن بحدة أكبر: **≈1400 سطر معلّق** في أربعة مكونات محورية (H1) ونص Placeholder يظهر للمستخدم (H2) وكسر ادعاء SSOT (H3). الجانب البنيوي الجيد موجود (Pattern C، SSOT للروابط والترجمات، hooks موثّقة، a11y جزئية سليمة). **أولوية الإصلاح المقترحة: إزالة الكتل المعلّقة → إزالة النص الوهمي → إصلاح SSOT الصوتي → تنظيف المسارات والألوان.**

أُنشئ: 2026-08-13 | المرحلة التالية: `06-features-admin.md`.
