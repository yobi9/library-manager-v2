# تقرير فجوات Library Manager V2 — النواقص والأخطاء

> **التاريخ**: 2026-08-10
> **النطاق**: فحص شامل للواجهة الأمامية + تحليل مبدأ المصدر الوحيد للحقيقة (Single Source of Truth)
> **المراجع**: `AGENTS.md`, `ARCHITECTURE_RULES.md`, `docs/migration-ledger.md`

---

## 1. ملخص تنفيذي

الفحص اعتمد على **الدليل المادي من الكود الفعلي** (قراءة الملفات سطراً سطراً) لا على ملفات التوثيق فقط،
مع دمج نتائج توثيق الهجرة الرسمي (`docs/migration-ledger.md`) وقواعد المشروع (`AGENTS.md`).

النتيجة العامة: البنية سليمة — كل الصفحات موصولة فعلياً بالـ hooks والـ API، وطبقة الاستعلام موحّدة.
لكن توجد **3 صفحات غير مكتملة**، **كمية كود معطّل كتعليقات**، **انتهاكات عديدة لمبدأ المصدر الوحيد للحقيقة**
(نسخ مكررة حرفياً، ثوابت مهجورة، خرائط مكررة)، وانحرافان سلوكيان حقيقيان قد يكسران وظائف المستخدم.

---

## 2. منهجية الفحص

1. تعداد جميع ملفات `src/app/**` (65 ملف `.tsx` + 139 ملف API `route.ts`).
2. قراءة كل صفحات الواجهة: المشاهد (~18 صفحة) والأدمن (21 صفحة) ومكوّناتها.
3. تعداد طبقة الواجهة: `src/shared` (34 مكوّن UI + مكوّنات التخطيط + أنواع + ثوابت)،
   `src/lib` و`src/lib/frontend`، 22 hook إداري + 5 hooks مشاهد.
4. جرد طبقة الواجهة الخلفية: 21 controller، ~37 ملف service، 23 repository، 15 ملف scanner، 11 ملف هجرة.
5. تحليل المصدر الوحيد للحقيقة بثلاث فرق فحص متوازية عبر `src/shared | src/lib | src/lib/frontend | src/features | src/app`.
6. مقارنة النتائج مع `AGENTS.md` و`migration-ledger.md`.

---

## 3. فجوات الكود

### 3.1 صفحات غير مكتملة (نصف فارغة)
| الصفحة | الملف | الوضع |
|---|---|---|
| رفع الملفات | `src/features/admin/pages/upload-page.tsx` | تعرض "قريباً" فقط (21 سطراً) |
| الاشتراك | `src/features/admin/pages/subscription-page.tsx` | تعرض "قريباً" فقط (21 سطراً) |

### 3.2 كود معطّل كتعليقات (بقايا ترحيل يجب تنظيفها)
| الملف | الموضع | الوصف |
|---|---|---|
| `src/features/viewer/pages/home-page.tsx` | الأسطر 1–101 | الصفحة كلها معطّلة كتعليقات → الرئيسية شبه فارغة |
| `src/features/viewer/pages/item-detail-page.tsx` | الأسطر ~467–543 | أقسام طاقم العمل معطّلة كتعليقات |
| `src/shared/utils/crew-helpers.ts` | الأسطر 14–37 | دالة `getUniqueCrewByRole` قديمة فوق نسختها الجديدة |
| `src/shared/components/layout/viewer-footer.tsx` | السطر 4 | `className` قديم معطّل |
| `src/shared/components/layout/viewer-navigation.tsx` | الأسطر 40–46 | `nav` قديم معطّل + استبداله بصيغة `cn` مكتوبة يدوياً بدل الاستيراد |
| `src/features/viewer/pages/watch-later-page.tsx` | الأسطر 19/30 | تنسيقات قديمة معطّلة |
| `src/features/viewer/pages/people-directory-page.tsx` | الأسطر 29/49 | تنسيقات قديمة معطّلة |

### 3.3 أخطاء هوية واتساق
| الملف | الموضع | المشكلة |
|---|---|---|
| `src/features/admin/pages/terms-page.tsx` | السطر 14 | الاسم الإنجليزي "Library Manager" بدل "استراحة" |
| `src/app/layout.tsx` | الأسطر 109–112 | اسم ثالث "Estra7ahyobi" في الـ metadata (الاسم الفعلي "استراحة") |
| `src/features/admin/pages/welcome-page.tsx` | الأسطر 13/24/32 | إيموجي (ممنوعة حسب قواعد AGENTS) + تعليق تنموي |
| `src/shared/components/layout/admin-header.tsx` | السطر 78 | تسمية "المدير" ثابتة بدل اسم المستخدم الفعلي |
| `src/features/admin/pages/database-page.tsx` | الأسطر 141/150/175/193/199–200/227 | نصوص عربية مكسورة الهمزة ("انشاء نسخه"، "لايوجد"...) |
| `src/features/admin/pages/requests-page.tsx` | الأسطر 155–177 | زرا "عرض" و"رد" يفتحان نفس النافذة (تكرار) |

### 3.4 مشاكل بنية وأسلوب
| الملف | المشكلة |
|---|---|
| `src/shared/components/layout/admin-sidebar.tsx` | يستورد `useAdminSidebar` من `@/app/admin/layout` (اقتران شريط جانبي ↔ تخطيط) + ~130 سطر مكرر بين الشريط وسحبه المحمول |
|   / `news-page.tsx` /   | ثلاث صفحات CRUD متطابقة تقريباً (يمكن توحيدها في مكوّن واحد) |
| `src/features/admin/pages/messages-page.tsx` | جدول يدوي + صيغ Tailwind قديمة (`text-[10px]`, `bg-bg-hover`) |
| عدة أماكن | استخدام `<img>` خام بدل `next/image` (على الرغم من أن بعضها مبرر لمصادر بعيدة) |
| `database-page.tsx` / `use-season-episodes.ts` | أنواع مفروضة عبر `as` casts بدل أنواع صريحة |
| `use-admin-license.ts` | `fetch` خام بدل أدوات API الموحدة |

### 3.5 مشاكل الترحيل والتوثيق
| المشكلة | التفاصيل |
|---|---|
| ترقيم الهجرة | `002_normalize_settings_boolean_types.sql` + `002_search_sync_triggers.sql` (رقم 002 مكرر) والرقم 005 ناقص (001,002,002,003,004,006–011) |
| انحراف AGENTS.md | يصف `src/backend/middleware/` (rate-limiter/maintenance/visitor-tracking) وهو **غير موجود**؛ المنطق داخل `(viewer)/layout.tsx` و`translation-service.ts` |
| انحراف عدّادات AGENTS.md | "20 controllers / 20+ services / 24 repos / scanner 13" بينما الواقع: 21 / ~37 / 23 / 15 |
| توثيق قديم | ملفات `docs/LAYER-*.md`, `docs/PHASE4_ARCHITECTURE_REVIEW.md`, `docs/BACKEND_MIGRATION_ANALYSIS.md` — تحتاج مراجعة مقابل الكود الحالي |

---

## 4. تحليل المصدر الوحيد للحقيقة (SSOT)

### 4.1 نسخ حرفية متطابقة (أسوأ المخالفات)
| المفهوم | النسخ | الحالة |
|---|---|---|
| `translate.ts` (196 سطراً: ترجمة الأنواع، MEDIA_TYPES، LIBRARY_TYPES...) | `src/lib/frontend/translate.ts` (المستخدمة) + `src/shared/utils/translate.ts` + `src/shared/types/translate.ts` | **ثلاث نسخ متطابقة**، اثنتان ميتتان، وواحدة داخل مجلد `types` رغم أنها كود تشغيلي |
| `cn()` (دمج كلاسات) | `src/lib/utils.ts` (المصدر الفعلي، ~40 مستورداً) + `src/shared/utils/index.ts` | نسخة ميتة |
| `formatDate` / `formatDateTime` | `src/shared/utils/index.ts` | **ميتة** — و11+ مكاناً يعيد كتابتها يدوياً بثلاث صيغ مختلفة (ar-SA / ar-EG / ar) |
| قوالب الاستجابة `{rows,total}` | 8 نسخ محلية (UsersResponse, AdsResponse, StoreProductsResponse...) | بينما `ApiResponse`/`PaginatedResponse` في `api.ts` موجودة لكن **لا أحد يستوردها** |
| أحداث SSE (17 اسماً) | `api/admin/events/route.ts` + `use-admin-events-sse.ts` + مجموعات فرعية في 3 ملفات أخرى | بلا ثابت مشترك |

### 4.2 مساعدا fetch متعارضان
| المساعد | المستخدمون | السلوك |
|---|---|---|
| `src/lib/frontend/api.ts` (`apiFetch`/`apiGet`...) | ~18 hook إداري | بلا `credentials: "include"`، يرمي `ApiError` |
| `src/lib/frontend/api-client.ts` (`apiClient`) | كل media/search + live-channels | يرسل الكوكيز، يغلف النتائج إلى `data`، يرمي `Error` |

نفس الوظيفة (عنوان أساسي + JSON + معالجة أخطاء + مصادقة) بعقدين مختلفين، و`index.ts` يصدّر واحداً فقط.
بالإضافة إلى 4 مواضع `fetch` خام يتجاوزها: `use-admin-license`, `use-admin-users` (رفع صورة)،
`use-admin-database` (استعادة)، `use-visitor-request`.

### 4.3 ثوابت موجودة لكن مهجورة (BYPASS)
| الثابت | الموقع الصحيح | الحالة |
|---|---|---|
| `APP_NAME="استراحة"` | `src/shared/constants/index.ts` | **صفر استيرادات**؛ 10+ مكاناً يكتب النص يدوياً (واسم خاطئ "Library Manager" واسم ثالث "Estra7ahyobi") |
| `ROUTES` | `src/shared/constants/index.ts` | **40+ مساراً مكتوباً يدوياً**؛ 12 مفتاحاً يتيماً بلا استخدام (ADMIN_DASHBOARD, GENRE, PERSON, YEAR, RATING, CERTIFICATION, WATCH_LATER, LIVE_STREAM, ITEMS, AUDIO_PLAYER, ADMIN_LIVE_STREAM, ADMIN_EVENTS) |
| `API_ROUTES` | `src/shared/constants/index.ts` | **صفر استيرادات**؛ كل `/api/...` مكتوب يدوياً |
| `USER_ROLES` | `src/shared/constants/index.ts` | **صفر استيرادات**؛ القيم اليدوية في 3 ملفات على الأقل |

### 4.4 خرائط تسميات مكررة (لا يوجد بيت مركزي)
| الخريطة | النسخ |
|---|---|
| أدوار "مدير/مشاهد" | `users-page.tsx`, `user-form-modal.tsx`, `user-detail-modal.tsx` |
| حالات (قيد الانتظار/محلول/مرفوض، خامل/جارٍ المسح...) | `reports-page`, `processes-page`, `events-page` (ACTION_LABELS بلا 60 اسماً) |
| مواقع الإعلانات | داخل صفحة `ads-page` نفسها مرتين |
| أنواع المكتبات (24) | `translate.ts` + `library-form.tsx` + `section-card.tsx` (features/viewer/components/sections/) + `library-card.tsx` = 4 نسخ — وواحدة فيها خطأ `"  audio_deen"` بمسافات |

### 4.5 انحرافات سلوكية حقيقية (الأعلى خطورة)
| الانحراف | التفاصيل |
|---|---|
| توجيه الصوتيات | `buildMediaUrl` (`media-helpers.ts:42`) يقرأ 5 أنواع صوتية `["music","singer","album","song","audio_deen"]` بينما `AUDIO_TYPES` في `audio-player/types.ts` يقرأ 6 (يضيف `"track"`) → عنصر `track` يذهب إلى `/itemView` بدل `/audio` |
| مواقع الإعلانات | الواجهة `header/sidebar/footer/between` (`ads-page.tsx:28-33`) ≠ قاعدة البيانات `banner/sidebar/popup/inline` (`db/schema.ts:372`) — مجموعتان لا تتقاطعان سوى في `sidebar` |
| ترجمة الأنواع | `hero.tsx:87` يعرض نوع المحتوى الإنجليزي خاماً بدون `translateMediaType` |

### 4.6 أنواع معرّفة مرتين بمسميات مختلفة
| المفهوم | التعريفان |
|---|---|
| المستخدم | `User {id,username,role}` (`auth-context.tsx`) مقابل `AdminUser {user_id,...,is_admin}` (`use-admin-users.ts`) |
| العنصر الحصري | `ExclusiveItem` (`features/admin/types/exclusive.ts`) مقابل `ExclusiveSettingItem` (`shared/types/settings.ts`) — ويتم التحويل بينهما بـ cast |
| قناة البث | `LiveChannel` (`use-live-channels.ts`) مقابل `Channel` (`api-media.ts:206`) |
| تقدم المسح | `ScanProcess` (`use-admin-processes.ts`) مقابل `ScanProgress` (`use-admin-libraries.ts`) |
| الإعدادات النموذجية | `SettingsFormState` (`settings-page.tsx`) يعيد كتابة ~18 مفتاحاً من `AdminSettings` يدوياً بدل `Pick` |
| إعدادات المكتبة | `LibraryFormValues` (`library-form.tsx`) يعيد تعريف حقول camelCase |
| أدوات/أنواع أخرى | `CrewMember` معرّف مرتين؛ `VideoPlayerProps` مقابل `AudioPlayerProps` (نفس الشكل)؛ `BreadcrumbItem` مرتين؛ `AdminEvent` مقابل `HistoryEvent` |

### 4.7 أدوات معطّلة أو مكررة
| الأداة | الحالة |
|---|---|
| `image-helpers.ts` (5 دوال) | مستوردة في 3 ملفات فقط؛ دالتان بلا مستخدمين؛ 8+ مكونات تعيد بناء نفس روابط `/api/images/{id}?type=...&w=...&h=...` يدوياً |
| `src/shared/hooks/useLocalStorage.ts` | **ملف فارغ (0 بايت)** |
| `src/shared/hooks/useDebounce.ts`, `use-infinite-scroll.ts`, `use-media-filters.ts` | **فارغة (0 بايت)**؛ الـ debounce معاد يدوياً مرتين |
| `watch-later-storage.ts` مقابل `favorites-storage.ts` | نفس الشكل (5 دوال) — يمكن تصنيعهما بمصانع `createIdListStorage(key)` |
| `media-selector-modal.tsx` | يعيد تنفيذ `useMediaTypes` + قائمة وسائط الأدمن (ذاكرة تخزين مؤقت مكررة) |
| `use-live-channels.ts` | يعيد تنفيذ `fetchChannels` في `api-media.ts` |

---

## 5. البيوت الصحيحة المقترحة (أين يجب أن يعيش كل شيء)

| المفهوم | البيت الصحيح |
|---|---|
| الأنواع (MediaItem, Library, User, Settings, Envelope...) | `src/shared/types` |
| الثوابت (APP_NAME, ROUTES, USER_ROLES, أدوار، أنواع الوسائط، أحداث SSE) | `src/shared/constants` |
| الأدوات (cn, formatDate, الصور، التخزين) | `src/shared/utils` |
| طبقة API (مساعد واحد) | `src/lib/frontend/api.ts` |
| الاستعلامات | `src/lib/frontend/media-queries.ts` (موحّدة حالياً ✅) |

---

## 6. المطابق والجيد (لا يحتاج تغيير)

- **طبقة الاستعلام موحّدة**: `media-queries.ts` هو سطح الاستعلام الوحيد للمشاهد، بلا `useMedia`/`useMediaItems` مكررة.
- **hooks الأدمن متسقة**: جميعها تتبع نمط `apiFetch` + قوالب استجابة + مصانع مفاتيح، بلا تكرار بينها.
- **أحداث SSE**: قائمة الـ17 اسماً متطابقة بين `route.ts` والـ hook (المشكلة الوحيدة أنها مكررة بلا ثابت مشترك).
- **بنية الصفحات المسطحة** متطابقة مع `AGENTS.md` (3 أنماط، صفحة واحدة لكل مسار).
- **مفاتيح التخزين المحلي** كلها مركزية في وحداتها (watch_later, favorites, lm_device_id...).
- **`src/app` نظيف**: 44 صفحة رقيقة بلا fetch/useQuery داخلها.
- جميع صفحات الأدمن (21) حقيقية وموصولة فعلاً، عدا `upload` و`subscription`.

---

## 7. خطة الإصلاح حسب الأولوية

| الأولوية | البند | الخطورة |
|---|---|---|
| P1 | إصلاح الانحرافات السلوكية: توجيه `track` الصوتي، موافقة مواقع الإعلانات مع قاعدة البيانات، إصلاح `"  audio_deen"` | مرتفع |
| P2 | حذف النسخ الميتة: `translate.ts` ×2، `cn` الميتة، تفعيل `formatDate` أو إزالتها | متوسط |
| P3 | توحيد الثوابت: استيراد `APP_NAME`/`ROUTES`/`USER_ROLES` في كل المواقع | متوسط |
| P4 | توحيد طبقة API: دمج `api.ts`/`api-client.ts` (مع إرسال الكوكيز) وإزالة الـ fetch الخام | مرتفع (يتطلب اختباراً) |
| P5 | توحيد الأنواع: `User`/`AdminUser`، قالب استجابة واحد، `ExclusiveItem`... | متوسط |
| P6 | إزالة تكرار الخرائط والأدوات: خرائط التسميات، `image-helpers`، مصنع التخزين، hooks الفارغة | متوسط |
| P7 | الصفحات الناقصة: بناء `upload-page` و`subscription-page` | متوسط |
| P8 | إعادة بناء `home-page` | كبير |

---

## 8. سجل التغيير (يُحدَّث مع كل إصلاح)
<!-- سيُضاف سجل الإصلاحات المنفذة هنا أثناء التنفيذ -->
