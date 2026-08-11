# LAYER-SERVICES — طبقة الـ Services (Domain/Business Logic Layer)

> **الغرض:** توثيق طبقة الـ Services — مستودع منطق الأعمال، نمط الـ Singletons عبر
> `getServices()`، أدوار الخدمات الرئيسية (Auth, Settings, Scanner Bridge, EventBus,
> CacheService)، والمشاكل المؤكدة.
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### الموقع والحجم

- المجلد: `src/backend/services/` — **31 ملفاً** (29 خدمة + `index.ts` + `error-handler.ts`).
- القائمة الفعلية: `activity, ads, auth, cache, dashboard, database, image, library,
  media, messages, metadata, news, progress, report, retry-manager, search, security,
  settings, store-products, tmdb-enrichment, translation-cache, translation-provider,
  translation, user, view-publisher, view-service, view-tracker, visitor` +
  `event-bus, error-handler, index`.

### نمط الـ Singleton

- `getServices()` في `src/backend/services/index.ts:194` يعيد خدمة واحدة كاشة
  (`let _services ... = null` في `:55` — lazy singleton).
- `createServices()` يبني الخدمات من Repositories (حقن يدوي بلا DI container):
  - `authService (:79)`، `userService (:85)`، `libraryService (libraryRepo, mediaRepo) (:91)`،
    `mediaService (mediaRepo, libraryRepo) (:92)`، `searchService (:93)`،
    `settingsService (:94)`، `activityService (:95)`، `securityService (:96)`،
    `visitorService (:97)`، `progressService (:98)`، `reportService (:99)`،
    `dashboardService (:100)`، `translationCacheService (:105)`، `databaseService (:108)`،
    `imageService (:109)`، `newsService (:110)`، `messagesService (:111)`،
    `adsService (:112)`، `storeProductsService (:113)`،
    `translationService (mediaRepo, translationCacheRepo) (:114)`،
    `tmdbEnrichmentService (:115)`، `metadataService (mediaRepo, enrichmentMediaRepo) (:122)`،
    `viewTrackerService (:152)` + `viewService (:154)`.

### جسر الـ Scanner ↔ EventBus (Bridge)

- `services/index.ts:138-145`: يربط أحداث الـ Scanner بـ EventBus:
  `scan:started→scan_started`، `scan:completed→scan_completed`، `scan:failed→scan_failed`،
  `scan:paused`، `scan:resumed`، `scan:stopped`، `scan:error`، `scan:item`.
- أي مستمع (مثل `scan-events` SSE) يستهلك أسماء `scan_*` هذه — ليست من Scanner مباشرة.

### خدمات رئيسية — تفاصيل مؤكدة

#### AuthService (`auth-service.ts`)
- `JWT_SECRET` **إلزامي**: يُرمى FATAL عند غيابه (`:9-15`).
- `TOKEN_EXPIRY = 2h` بالثواني (`:16`) — يتوافق مع maxAge كوكي session_token.
- حماية القفل: `MAX_LOGIN_ATTEMPTS=5` و`LOCKOUT_DURATION_MS=15min` (`:18-19`) —
  عداد المحاولات في Map، يُفحص قبل التحقق (`:71-74`) ويحسب `remaining` بالدقائق.
- `verifyToken(token)` (`:237-239`) يعيد `jwt.JwtPayload | null` — يستخدمه Viewer
  Layout في وضع `protected` (راجع LAYER-MIDDLEWARE).
- أحداث: `user_login` (:149)، `user_logout` (:163).
- فشل التحقق ينتج رسائل يترجمها الـ Controller: `"Account locked"` (423) و
  `"Invalid credentials"` (401).

#### SettingsService (`settings-service.ts`)
- يقرأ/يكتب إعدادات في SQLite (مثل `viewer_access_mode`).
- أحداث: `settings_updated` (:145, :167) و`maintenance_toggle` (:147, :169) عند
  تعديل إعداد الصيانة.

#### EventBus (`event-bus.ts`)
- `MAX_LISTENERS_WARN = 30` (`:3`) مع `setMaxListeners(30)` (`:17`).
- `on(event, handler)` يعيد دالة unsubscribe (`:20-26`) — النمط المعتمد لمنع تسريب
  المستمعين؛ يحذّر عند تجاوز الحد (`:23-25`).
- `emit` (:31)، `off` (:36)، `once` (:44-45)، `removeAllListeners` (:50-56)،
  `listenerCount` (:62)، `bridge(source, event, target?)` (:75-77) — يستخدمه
  `services/index.ts:138-145` لربط Scanner.

#### CacheService (`cache-service.ts`)
- كامل الوظائف (LRU/TTL/stats/getOrFetch/multi-level) لكنه **بلا مستدع من أي Route أو
  Service آخر** في الوقت الحالي (راجع مشكلة SVC-02).
- أحداث: `cache_item_expired` (:146)، `cache_bulk_delete`، `cache_stale_used` (:327)،
  `cache_eviction` (:354)، `cache_cleanup` (:375)، `system_alert` (:399-417)،
  `cache_cleared` (:440).

#### MediaService (`media-service.ts`)
- يبث `media_updated` و`media:changed` بعد التعديل (`:248-249`) — هذه الأحداث تُحدِّث
  الـ UI والـ Cache عبر أي مستمع.
- `getPerson(personId)` (:286).

#### ViewTracker / ViewPublisher / ViewService (نظام المشاهدات)
- `view-tracker.ts`: يجمع العدّادات بـ Map مع `MAX_EMITTED_VIEWS` وتنظيف دوري (:16-38).
- `view-publisher.ts`: يبث `user_view` / `visitor_view` (:55-79).
- `view-service.ts`: يُحمّل عدّادات الدوريات عبر `viewTracker` + `viewEventPublisher`.

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### SVC-01 — `metadata-service` vs `tmdb-enrichment-service`: مسؤوليتان متداخلتان (Phase 5)

- يوجد `MetadataService` (الحراسة العامة) و`TmdbEnrichmentService` (التحصيل من TMDB)
  وكلاهما يبث `media:changed` (metadata-service.ts:113، tmdb-enrichment-service.ts:456-463).
- **لا خرق وظيفي مؤكد**، لكن التمييز بين «حفظ البيانات اليدوي» و«التعزيز الخارجي»
  غير موثّق — أي كود جديد يجب أن يستخدم MetadataService كـ gateway للـ enrichment
  بدلاً من الاتصال بـ TmdbEnrichmentService مباشرة.
- **المرحلة:** Phase 5 — توثيقي/تنظيمي.

### SVC-02 — CacheService معزول (orphaned) (Phase 4)

- `cache-service.ts` مكتمل البناء لكن **لا يوجد مستهلك** في الـ Routes/Services حالياً —
  تحقق بقراءة الاستيرادات: لا Route يستدعي `cacheService.*`.
- **الأثر:** وسوم `Cache-Control` غير مستغلة؛ كل طلب يضرب الـ DB (الأداء).
- **المرحلة:** Phase 4 — Performance.
- **الاتجاه المقترح:** تفعيله خلف `getMediaByFilter`/`getLatest` مع إبطال عند أحداث
  `media:changed`/`settings_updated`.

### SVC-03 — الإعدادات تُقرأ بلا Cache عبر RequestContext (Phase 4)

- `viewer_access_mode` يُقرأ من SQLite في كل طلب Viewer (من الـ Layout). صحيح سلوكياً
  (السرعة عند التغيير)، لكنه قد يُحمّل DB تحت الضغط.
- **المرحلة:** Phase 4 — اختياري (بحذر: لا تخزين يفكّر فوراً في الـ DB).

---

## 3. العقود المقدمة (Contracts Exposed)

- **الحدود:** الخدمات لا تعرف `NextRequest/NextResponse` ولا `ControllerResult` —
  تعمل على `RequestContext` وأنواع الأعمال.
- **الأحداث (EventBus):** `scan_*` (8 أحداث)، `media_updated`/`media:changed`،
  `settings_updated`/`maintenance_toggle`، `user_login`/`user_logout`/`user_created`/
  `user_updated`، `user_progress_update`، `translation_progress`، `user_view`/`visitor_view`،
  `cache_*`/`system_alert`.
- **قاعدة:`getServices()` عقدة من `index.ts:194`؛ لا تنشئ Service خارج `createServices`**
  إلا في الاستثناءات الموثقة (مثل ScanController الذي يأخذ `scanner` — ليس Service عادياً).

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي Service جديد يُسجّل في `createServices()` ويعود عبر `getServices()`.
2. أي حدث EventBus جديد يُضاف هنا (الاسم + الراسل + المستمعون).
3. عند تغيير عقد AuthService — لا تكسر `JWT_SECRET` الإلزامي ولا رسائل
   `"Account locked"`/`"Invalid credentials"` (يترجمها AuthController).
4. راجع LAYER-DB قبل أي استعلام في Service (العبور عبر Repository إلزامي).
