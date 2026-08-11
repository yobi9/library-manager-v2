# Migration Ledger — Library Manager v1 → v2

> **الغرض**: توثيق حالة الهجرة بين النظام القديم (`library-manager77`) والجديد (`library-manager-v2`).
> يُستخدم هذا الملف كمرجع للفريق والوكيل لتجنب القرارات المتناقضة وتكرار العمل.

> **آخر تدقيق**: 2026-08-08 — إنجاز المرحلة 1 من تحصين الـ Scanner (الفحص الواحد، deadlock، أخطاء 409/202، اختبارات دورة الحياة) وتحديث الحالات مقابل الكود الفعلي.
> **سابقاً**: 2026-08-06 — تدقيق شامل للواجهتين (أدمن + عرض) وتحديث الحالات مقابل الكود الفعلي.

### Current Source of Truth (ترتيب مصادر الحقيقة)

1. **New Backend** — models, DTOs, schemas, enums, validation, business rules, API contracts.
2. **New Frontend** — design system, components, hooks, utilities, constants, types, state, architecture.
3. **Old Project** — behavior description only, when 1 and 2 are insufficient.

> هذا السجل قد يتأخر عن الكود. عند أي تعارض، الكود الفعلي هو الحقيقة (راجع `AGENTS.md` و `ARCHITECTURE_RULES.md`).

---

## التقسيم

| المرحلة   | الوصف                                                     |
| --------- | --------------------------------------------------------- |
| 🔍 تحليل  | دراسة التعليمات البرمجية في النظام القديم لتوثيق السلوك   |
| 📊 مقارنة | مقارنة القديم مع الجديد لتحديد ما نُقل وما لم يُنقل       |
| ⚠️ نقص    | تحديد الفجوات: دوال، مسارات، أحداث، خدمات مفقودة أو معطلة |
| 🔧 تعديل  | تنفيذ الإصلاح أو النقل                                    |
| 🧪 اختبار | التحقق من أن TypeScript يمر وأن السلوك صحيح               |
| ✅ إغلاق  | تأكيد الاكتمال                                            |

---

## 1. Routes (API Endpoints)

### 1.1 Authentication

| القديم                           | الجديد                                                     | الحالة                    |
| -------------------------------- | ---------------------------------------------------------- | ------------------------- |
| `POST /api/auth/login`           | `POST /api/auth` → `auth.login()`                          | ✅ منقول                  |
| `POST /api/auth/logout`          | `DELETE /api/auth` → `auth.logout()`                       | ✅ منقول                  |
| `GET /api/auth/me`               | `GET /api/auth` → `auth.getMe()`                           | ✅ منقول                  |
| `POST /api/auth/change-password` | `POST /api/auth/change-password` → `auth.changePassword()` | ✅ منقول                  |
| —                                | `POST /api/auth/register` → `auth.register()`              | 🟡 غير موجه (قيد التطوير) |
| —                                | `GET /api/auth?check=session` → `auth.hasActiveSession()`  | 🟡 غير موجه               |
| —                                | `GET /api/auth?total=users` → `auth.getTotalUsers()`       | 🟡 غير موجه               |

### 1.2 License

| القديم                            | الجديد                                                       | الحالة                   |
| --------------------------------- | ------------------------------------------------------------ | ------------------------ |
| `GET /api/license/status`         | `GET /api/license/status` → `license.getStatus()`            | ✅ منقول (أُعيدت إضافته) |
| `POST /api/license/activate`      | `POST /api/license/activate` → `license.activate()`          | ✅ منقول (أُعيدت إضافته) |
| `POST /api/license/activate-file` | `POST /api/license/activate-file` → `license.activateFile()` | ✅ منقول (أُعيدت إضافته) |
| `POST /api/license/deactivate`    | `POST /api/license/deactivate` → `license.deactivate()`      | ✅ منقول (أُعيدت إضافته) |
| `POST /api/license/refresh`       | `POST /api/license/refresh` → `license.refresh()`            | ✅ منقول (أُعيدت إضافته) |

> **ملاحظة**: نظام الترخيص كان مقرراً إزالته في v2، لكنه أُعيدت إضافته لاحقاً
> (طبقة كاملة: `license-controller.ts` + `license-service.ts` بتحقق RSA-SHA256،
> والتخزين في `data/licenses/license.lic`، وواجهة أدمن كاملة في `license-page.tsx`).
> السجلات السابقة التي تصفه كـ «أُسقط عمداً» أصبحت متقادمة.

### 1.3 Libraries

| القديم                                   | الجديد                                                                   | الحالة         |
| ---------------------------------------- | ------------------------------------------------------------------------ | -------------- |
| `GET /api/libraries`                     | `GET /api/libraries` → `library.getAll()`                                | ✅ منقول       |
| `POST /api/libraries`                    | `POST /api/libraries` → `library.create()`                               | ✅ منقول       |
| `GET /api/libraries/[id]`                | `GET /api/libraries/[id]` → `library.getById()`                          | ✅ منقول       |
| `PATCH /api/libraries/[id]`              | `PATCH /api/libraries/[id]` → `library.update()`                         | ✅ منقول       |
| `DELETE /api/libraries/[id]`             | `DELETE /api/libraries/[id]` → `library.delete()`                        | ✅ منقول       |
| `GET /api/libraries/[id]/stats`          | `GET /api/libraries/[id]/stats` → `library.getStats()`                   | ✅ منقول       |
| `POST /api/libraries/[id]/watcher`       | `POST /api/libraries/[id]/watcher` → inline                              | ✅ منقول       |
| `POST /api/libraries/[id]/scan`          | `POST /api/libraries/[id]/scan` → `ScanController.startScan()`           | ✅ منقول       |
| `POST /api/libraries/[id]/scan/stop`     | `POST /api/libraries/[id]/scan/stop` → `ScanController.stopScan()`       | ✅ منقول       |
| `POST /api/libraries/[id]/scan/resume`   | `POST /api/libraries/[id]/scan/resume` → `ScanController.resumeScan()`   | ✅ منقول       |
| `POST /api/libraries/[id]/scan/pause`    | `POST /api/libraries/[id]/scan/pause` → `ScanController.pauseScan()`     | ✅ منقول       |
| `GET /api/libraries/[id]/scan/progress`  | `GET /api/libraries/[id]/scan/progress` → `ScanController.getProgress()` | ✅ منقول       |
| `GET /api/libraries/[id]/media`          | `GET /api/libraries/[id]/media` → `media.getLibraryMedia()`              | ✅ منقول       |
| `GET /api/libraries/[id]/genres`         | `GET /api/libraries/[id]/genres` → `library.getGenres()`                 | ✅ منقول       |
| `GET /api/libraries/[id]/age-ratings`    | `GET /api/libraries/[id]/age-ratings` → `library.getAgeRatings()`        | ✅ منقول       |
| `POST /api/libraries/scan-all`           | `POST /api/libraries/scan-all` → `ScanController.scanAll()`              | ✅ منقول       |
| `GET /api/libraries/search`              | —                                                                        | ❌ أُسقط عمداً |
| `GET /api/libraries/containers`          | —                                                                        | ❌ أُسقط عمداً |
| `GET /api/libraries/[id]/image`          | —                                                                        | ❌ أُسقط عمداً |
| `POST /api/libraries/[id]/refresh-count` | —                                                                        | ❌ أُسقط عمداً |

### 1.4 Media

| القديم                                     | الجديد                                                                  | الحالة                            |
| ------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------- |
| `GET /api/media/[id]`                      | `GET /api/media/[id]` → `media.getMediaById()`                          | ✅ منقول                          |
| `DELETE /api/media/[id]`                   | `DELETE /api/media/[id]` → `media.deleteItem()`                         | ✅ منقول                          |
| `PATCH /api/media/[id]`                    | `PATCH /api/media/[id]` → `media.updateMedia()`                         | ✅ منقول                          |
| `POST /api/media/[id]/view`                | `POST /api/media/[id]/view` → `media.incrementView()`                   | ✅ منقول                          |
| `POST /api/media/[id]/toggle-pin`          | `POST /api/media/[id]/toggle-pin` → `media.togglePin()`                 | ✅ منقول                          |
| `GET /api/media/[id]/stream`               | `GET /api/media/[id]/stream` → `media.getStreamTarget()`                | ✅ منقول (بثّ Range كامل 206/416) |
| `GET /api/media/[id]/check`                | `GET /api/media/[id]/check` → `media.checkPlayable()`                   | ✅ منقول                          |
| `GET /api/media/types/list`                | `GET /api/media/types` → `media.getMediaTypes()`                        | ✅ منقول (تبسيط المسار)           |
| `GET /api/media/filter`                    | `GET /api/media/filter` → `media.getMediaByFilter()`                    | ✅ منقول                          |
| `GET /api/media/latest`                    | `GET /api/media/latest` → `media.getLatest()`                           | ✅ منقول                          |
| `GET /api/media/latest/[type]`             | `GET /api/media/latest/[type]` → `media.getLatest()`                    | ✅ منقول                          |
| `GET /api/media/home`                      | —                                                                       | ❌ أُسقط عمداً                    |
| `GET /api/media/genres/list`               | `GET /api/media/genres` → `media.getAllGenres()`                        | ✅ منقول                          |
| `GET /api/media/general-stats`             | —                                                                       | ❌ أُسقط عمداً                    |
| `GET /api/media/batch`                     | `GET /api/media/batch` → `media.getMediaBatch()`                        | ✅ منقول                          |
| `GET /api/media/people`                    | `GET /api/media/people` → `media.getAllPeople()`                        | ✅ منقول                          |
| `GET /api/media/pinned/list`               | `GET /api/media/pinned` → `media.getPinnedItems()`                      | ✅ منقول                          |
| `GET /api/media/person/[identifier]`       | `GET /api/media/person/[id]` → `media.getPerson()`                      | ✅ منقول                          |
| `GET /api/media/person/[identifier]/works` | `GET /api/media/person/[id]/works` → `media.getPersonWorks()`           | ✅ منقول                          |
| `GET /api/media/recommended/[id]/[type]`   | `GET /api/media/recommended/[id]/[type]` → `media.getRecommendations()` | ✅ منقول                          |
| `GET /api/media/stats/overview`            | —                                                                       | ❌ أُسقط عمداً                    |
| `GET /api/media/search/all`                | —                                                                       | ❌ أُسقط عمداً                    |
| `GET /api/media/admin/list`                | `GET /api/media?admin=true` → `media.getMediaByFilter()`                | ✅ منقول                          |
| `POST /api/media/enrich/reset/[id]`        | `POST /api/enrich/reset/[id]` → `enrichment.resetItemMetadata()`        | ✅ منقول                          |

### 1.5 Enrichment

| الجديد (`/api/enrich/...`)                                                      | الحالة   |
| ------------------------------------------------------------------------------- | -------- |
| `item/[id]`, `metadata/[id]`, `search`, `batch`, `by-filter`                    | ✅ منقول |
| `needs-enrichment`, `pending-approvals`, `pending-approve-all`                  | ✅ منقول |
| `approve/[approvalId]`, `reject/[approvalId]`                                   | ✅ منقول |
| `session/[sessionId]`, `cancel/[sessionId]`, `stats`                            | ✅ منقول |
| `reset/[id]`, `reset-stats`, `test-connection`, `update-apikey`, `upload-image` | ✅ منقول |
| **المجموع: 18 مساراً**                                                          | ✅ كاملة |

### 1.6 Dashboard

| القديم                                       | الجديد                                                             | الحالة                   |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `GET /api/dashboard/summary`                 | `GET /api/dashboard/summary`                                       | ✅ منقول                 |
| `GET /api/dashboard/live`                    | `GET /api/dashboard/live`                                          | ✅ منقول                 |
| `GET /api/dashboard/recent-activities`       | `GET /api/dashboard/recent-activities`                             | ✅ منقول                 |
| `GET /api/dashboard/general-stats`           | `GET /api/dashboard/general-stats`                                 | ✅ منقول                 |
| `GET /api/dashboard/daily-views`             | `GET /api/dashboard/daily-views`                                   | ✅ منقول                 |
| `GET /api/dashboard/most-watched-libraries`  | `GET /api/dashboard/most-watched/libraries`                        | ✅ منقول                 |
| `GET /api/dashboard/most-watched-items`      | `GET /api/dashboard/most-watched/items`                            | ✅ منقول                 |
| `GET /api/dashboard/least-watched-libraries` | `GET /api/dashboard/least-watched/libraries`                       | ✅ منقول                 |
| `GET /api/dashboard/least-watched-items`     | `GET /api/dashboard/least-watched/items`                           | ✅ منقول                 |
| `GET /api/dashboard/watch-stats`             | —                                                                  | ❌ أُسقط                 |
| `GET /api/dashboard/total-views`             | —                                                                  | ❌ أُسقط                 |
| `GET /api/dashboard/total-media`             | —                                                                  | ❌ أُسقط                 |
| `GET /api/dashboard/storage-usage`           | —                                                                  | ❌ أُسقط                 |
| `GET /api/dashboard/online-visitors`         | —                                                                  | ❌ أُسقط                 |
| `GET /api/dashboard/old-unwatched`           | `GET /api/dashboard/old-unwatched` → `dashboard.getOldUnwatched()` | ✅ منقول (أُعيدت إضافته) |
| `GET /api/dashboard/device-breakdown`        | —                                                                  | ❌ أُسقط                 |
| —                                            | `GET /api/dashboard` → `dashboard.getStats()`                      | 🆕 جديد                  |

### 1.7 Settings

| القديم                           | الجديد                          | الحالة   |
| -------------------------------- | ------------------------------- | -------- |
| `GET /api/settings`              | `GET /api/settings`             | ✅ منقول |
| `POST /api/settings`             | `POST /api/settings`            | ✅ منقول |
| `PUT /api/settings`              | `PUT /api/settings`             | ✅ منقول |
| `GET /api/settings/all`          | `GET /api/settings/all`         | ✅ منقول |
| `POST /api/settings/reset`       | `POST /api/settings/reset`      | ✅ منقول |
| `GET /api/settings/system/info`  | `GET /api/settings/system/info` | ✅ منقول |
| `GET /api/settings/[key]`        | —                               | ❌ أُسقط |
| `GET /api/settings/network`      | —                               | ❌ أُسقط |
| `POST /api/settings/network`     | —                               | ❌ أُسقط |
| `POST /api/settings/logo`        | —                               | ❌ أُسقط |
| `POST /api/settings/cache/clear` | —                               | ❌ أُسقط |

### 1.8 Search

| القديم                           | الجديد                                                | الحالة                                                   |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `GET /api/search/live`           | `GET /api/search/live` → `search.liveSearch()`        | ✅ منقول                                                 |
| `GET /api/search/years`          | `GET /api/search/years` → `media.getAvailableYears()` | ✅ منقول (نقل للـ Media)                                 |
| `GET /api/search/health`         | —                                                     | ❌ أُسقط                                                 |
| `POST /api/search/index/rebuild` | `POST /api/search/rebuild` → `search.rebuildIndex()`  | ✅ منقول (اختلف المسار: `/rebuild` بدل `/index/rebuild`) |
| —                                | `GET /api/search` → `search.search()`                 | 🆕 جديد                                                  |

### 1.9 User

| القديم                               | الجديد                                                               | الحالة                   |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------ |
| `GET /api/user`                      | `GET /api/user` → `user.getAll()`                                    | ✅ منقول                 |
| `POST /api/user`                     | `POST /api/user` → `user.create()`                                   | ✅ منقول                 |
| `GET /api/user/[id]`                 | `GET /api/user/[id]` → `user.getById()`                              | ✅ منقول                 |
| `PUT /api/user/[id]`                 | `PUT /api/user/[id]` → `user.update()`                               | ✅ منقول                 |
| `DELETE /api/user/[id]`              | `DELETE /api/user/[id]` → `user.delete()`                            | ✅ منقول                 |
| `GET /api/user/[id]/stats`           | `GET /api/user/[id]/stats` → `user.getStats()`                       | ✅ منقول                 |
| `GET /api/user/[id]/sessions`        | `GET /api/user/[id]/sessions` → `user.getSessions()`                 | ✅ منقول                 |
| `POST /api/user/[id]/block`          | `POST /api/user/[id]/block` → `user.block()`                         | ✅ منقول                 |
| `POST /api/user/[id]/admin`          | `POST /api/user/[id]/admin` → `user.changeAdminStatus()`             | ✅ منقول                 |
| `GET /api/user/[id]/activity`        | `GET /api/user/[id]/activity` → `user.getActivity()`                 | ✅ منقول                 |
| `GET /api/user/[id]/lists`           | —                                                                    | ❌ أُسقط                 |
| `POST /api/user/[id]/avatar`         | `POST /api/user/[id]/avatar` → `user.uploadAvatar()`                 | ✅ منقول (أُعيدت إضافته) |
| `GET /api/user/[id]/activities`      | —                                                                    | ❌ أُسقط (مكرر)          |
| `GET /api/user/search/[query]`       | `GET /api/user/search/[query]` → `user.search()`                     | ✅ منقول                 |
| `GET /api/user/visitor-logs`         | `GET /api/user/visitor-logs` → `user.getVisitorLogs()`               | ✅ منقول                 |
| `GET /api/user/system/stats`         | `GET /api/user/system/stats` → `user.getSystemStats()`               | ✅ منقول                 |
| `GET /api/user/type/[type]`          | —                                                                    | ❌ أُسقط                 |
| `GET /api/user/admins/all`           | —                                                                    | ❌ أُسقط                 |
| `GET /api/user/requests`             | `GET /api/user/requests` → `visitor.getVisitorRequests()`            | ✅ منقول                 |
| `POST /api/user/requests`            | `POST /api/user/requests` → `visitor.addVisitorRequest()`            | ✅ منقول                 |
| `DELETE /api/user/requests`          | `DELETE /api/user/requests` → `visitor.deleteInactiveVisitors()`     | ✅ منقول                 |
| `POST /api/user/requests/[id]/reply` | `POST /api/user/requests/[id]/reply` → `visitor.addReplyToRequest()` | ✅ منقول                 |
| `PUT /api/user/requests/[id]/status` | —                                                                    | ❌ أُسقط                 |

### 1.10 Database

| القديم                              | الجديد                                                            | الحالة                   |
| ----------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `GET /api/database/stats`           | `GET /api/database/stats` + `GET /api/database`                   | ✅ منقول                 |
| `POST /api/database/backup`         | `POST /api/database/backup`                                       | ✅ منقول                 |
| `POST /api/database/optimize`       | `POST /api/database/optimize`                                     | ✅ منقول                 |
| `GET /api/database/backups`         | `GET /api/database/backups` → `database.getBackups()`             | ✅ منقول (أُعيدت إضافته) |
| `POST /api/database/restore`        | `POST /api/database/restore` → `database.restore()`               | ✅ منقول (أُعيدت إضافته) |
| `POST /api/database/factory-reset`  | `POST /api/database/factory-reset` → `database.factoryReset()`    | ✅ منقول (أُعيدت إضافته) |
| `GET /api/database/download/[name]` | `GET /api/database/download/[name]` → `database.downloadBackup()` | ✅ منقول (أُعيدت إضافته) |

### 1.11 Media Reports

| القديم                               | الجديد                                                         | الحالة   |
| ------------------------------------ | -------------------------------------------------------------- | -------- |
| `GET /api/media-reports`             | `GET /api/media-reports` → `report.getFiltered()`              | ✅ منقول |
| `POST /api/media-reports`            | `POST /api/media-reports` → `report.create()`                  | ✅ منقول |
| `PUT /api/media-reports/[id]/status` | `PUT /api/media-reports/[id]/status` → `report.updateStatus()` | ✅ منقول |
| `GET /api/media-reports/[id]`        | —                                                              | ❌ أُسقط |
| `DELETE /api/media-reports/[id]`     | —                                                              | ❌ أُسقط |
| `GET /api/media-reports/stats`       | —                                                              | ❌ أُسقط |

### 1.12 Images

| القديم                       | الجديد                                      | الحالة   |
| ---------------------------- | ------------------------------------------- | -------- |
| `GET /api/images/[id]`       | `GET /api/images/[id]` → `image.getImage()` | ✅ منقول |
| `GET /api/images/health`     | —                                           | ❌ أُسقط |
| `GET /api/images/debug/[id]` | —                                           | ❌ أُسقط |

### 1.13 Translate

| الجديد (`/api/translate/...`)                                              | الحالة   |
| -------------------------------------------------------------------------- | -------- |
| `item/[id]`, `item/[id]/status`                                            | ✅ منقول |
| `batch`, `by-filter`, `status/[sessionId]`, `cancel/[sessionId]`, `health` | ✅ منقول |
| **المجموع: 7 مسارات**                                                      | ✅ كاملة |

### 1.14 Health

| القديم                     | الجديد                     | الحالة   |
| -------------------------- | -------------------------- | -------- |
| `GET /api/health`          | `GET /api/health` (inline) | ✅ منقول |
| `GET /api/health/detailed` | —                          | ❌ أُسقط |

### 1.15 Dropped Entirely

| القديم                          | Notes    |
| ------------------------------- | -------- |
| `POST /api/system/start-agent`  | ❌ أُسقط |
| `GET /api/metrics`              | ❌ أُسقط |
| `POST /api/chat` (Gemini proxy) | ❌ أُسقط |

### 1.16 Brand-New in v2

| المسار                                                        | الوحدة                          |
| ------------------------------------------------------------- | ------------------------------- |
| `GET/POST /api/messages`, `/api/messages/[id]`                | رسائل النظام (جديد كلياً)       |
| `GET/POST /api/news`, `/api/news/[id]`                        | الأخبار (جديد كلياً)            |
| `GET/PUT /api/progress`, `/api/progress/[mediaId]`            | تقدم المشاهدة (جديد كلياً)      |
| `GET/POST /api/store-products`, `/api/store-products/[id]`    | منتجات المتجر (جديد كلياً)      |
| `GET/POST /api/ads`, `/api/ads/[id]`, `/click`, `/impression` | الإعلانات (جديد كلياً)          |
| `GET /api/admin/events`                                       | بث SSE لأحداث النظام (جديد)     |
| `GET/DELETE /api/admin/events/history`                        | سجل أحداث النظام (جديد)         |
| `GET /api/scan-events`                                        | بث مباشر SSE لتقدم الفحص (جديد) |
| `POST /api/admin/validate-hierarchy`                          | التحقق من التسلسل الهرمي (جديد) |

---

## 2. Controllers

### 2.1 مقارنة الكنترولرات

| القديم                     | الجديد                         | الحالة                   |
| -------------------------- | ------------------------------ | ------------------------ |
| `AuthController.js`        | `auth-controller.ts`           | ✅ منقول                 |
| `UserController.js`        | `user-controller.ts`           | ✅ منقول                 |
| `LibraryController.js`     | `library-controller.ts`        | ✅ منقول                 |
| `MediaController.js`       | `media-controller.ts`          | ✅ منقول                 |
| `EnrichmentController.js`  | `enrichment-controller.ts`     | ✅ منقول                 |
| `SearchController.js`      | `search-controller.ts`         | ✅ منقول                 |
| `SettingsController.js`    | `settings-controller.ts`       | ✅ منقول                 |
| `DashboardController.js`   | `dashboard-controller.ts`      | ✅ منقول                 |
| `DatabaseController.js`    | `database-controller.ts`       | ✅ منقول                 |
| `ImageController.js`       | `image-controller.ts`          | ✅ منقول                 |
| `MediaReportController.js` | `report-controller.ts`         | ✅ منقول (إعادة تسمية)   |
| `TranslationController.js` | `translation-controller.ts`    | ✅ منقول                 |
| `LicenseController.js`     | `license-controller.ts`        | ✅ منقول (أُعيدت إضافته) |
| `SystemController.js`      | —                              | ❌ أُسقط عمداً           |
| —                          | `scan-controller.ts`           | 🆕 جديد                  |
| —                          | `visitor-controller.ts`        | 🆕 جديد                  |
| —                          | `messages-controller.ts`       | 🆕 جديد                  |
| —                          | `news-controller.ts`           | 🆕 جديد                  |
| —                          | `progress-controller.ts`       | 🆕 جديد                  |
| —                          | `store-products-controller.ts` | 🆕 جديد                  |
| —                          | `ads-controller.ts`            | 🆕 جديد                  |

### 2.2 دوال الكنترولرات غير الموجهة (لا يوجد route يستدعيها)

| الكنترولر             | الدالة                | التحليل                                                                |
| --------------------- | --------------------- | ---------------------------------------------------------------------- |
| `auth-controller`     | `register`            | لم تكن موجودة في القديم — قيد التطوير                                  |
| `auth-controller`     | `hasActiveSession`    | لم تكن موجودة في القديم                                                |
| `auth-controller`     | `getTotalUsers`       | لم تكن موجودة في القديم                                                |
| `library-controller`  | `refreshMediaCount`   | ❌ أُسقط مسارها عمداً من v2                                            |
| `library-controller`  | `getContainers`       | ❌ أُسقط مسارها عمداً من v2                                            |
| `library-controller`  | `getByParentId`       | لم تكن موجودة في القديم                                                |
| `media-controller`    | `getMediaChildren`    | لم تكن موجودة في القديم                                                |
| `search-controller`   | `rebuildIndex`        | ✅ موصولة الآن عبر `POST /api/search/rebuild` (المسار اختلف عن القديم) |
| `search-controller`   | `getStats`            | لم تكن موجودة في القديم                                                |
| `progress-controller` | `delete`              | Progress جديد كلياً                                                    |
| `report-controller`   | `getByMediaId`        | ❌ أُسقط مسارها عمداً من v2                                            |
| `report-controller`   | `getStats`            | ❌ أُسقط مسارها عمداً من v2                                            |
| `user-controller`     | `getRecentActivities` | مكرر مع Dashboard                                                      |
| `visitor-controller`  | `getVisitors`         | لم تكن موجودة في القديم                                                |

> **القرار**: لا حاجة لحذف هذه الدوال حالياً. بعضها قد يُستخدم عند إضافة مسارات جديدة.

---

## 3. Services

### 3.1 مقارنة الخدمات

| القديم                       | الجديد                                           | الحالة                  |
| ---------------------------- | ------------------------------------------------ | ----------------------- |
| `AuthService.js`             | `auth-service.ts`                                | ✅ منقول                |
| `UserService.js`             | `user-service.ts`                                | ✅ منقول                |
| `LibraryService.js`          | `library-service.ts`                             | ✅ منقول                |
| `MediaService.js`            | `media-service.ts`                               | ✅ منقول                |
| `SearchService.js`           | `search-service.ts`                              | ✅ منقول                |
| `SettingsService.js`         | `settings-service.ts`                            | ✅ منقول                |
| `DashboardService.js`        | `dashboard-service.ts`                           | ✅ منقول                |
| `DatabaseService.js`         | `database-service.ts`                            | ✅ منقول                |
| `ImageService.js`            | `image-service.ts`                               | ✅ منقول                |
| `CacheService.js`            | `cache-service.ts`                               | ✅ منقول                |
| `MediaReportService.js`      | `report-service.ts`                              | ✅ منقول (إعادة تسمية)  |
| `MetadataService.js`         | `metadata-service.ts`                            | ✅ منقول                |
| `TmdbEnrichmentService.js`   | `tmdb-enrichment-service.ts`                     | ✅ منقول                |
| `TranslationService.js`      | `translation-service.ts`                         | ✅ منقول                |
| `TranslationProvider.js`     | `translation-provider.ts`                        | ✅ منقول                |
| `ViewService.js`             | `view-service.ts`                                | ⚠️ موجود لكنه غير مربوط |
| `ViewTrackerService.js`      | `view-tracker.ts`                                | ⚠️ موجود لكنه غير مربوط |
| `ViewEventPublisher.js`      | `view-publisher.ts`                              | ⚠️ موجود لكنه غير مربوط |
| `socket.js` (WebSocket)      | — (لم يُنقل؛ البث المباشر عبر SSE `scan-events`) | ❌ أُسقط                |
| `SystemService.js`           | —                                                | ❌ أُسقط                |
| `MediaAggregationService.js` | —                                                | ❌ أُسقط                |
| `MediaTransformer.js`        | —                                                | ❌ أُسقط                |
| `AutoBackupScheduler.js`     | —                                                | ❌ أُسقط                |
| —                            | `activity-service.ts`                            | 🆕 جديد                 |
| —                            | `security-service.ts`                            | 🆕 جديد                 |
| —                            | `visitor-service.ts`                             | 🆕 جديد                 |
| —                            | `progress-service.ts`                            | 🆕 جديد                 |
| —                            | `translation-cache-service.ts`                   | 🆕 جديد                 |
| —                            | `news-service.ts`                                | 🆕 جديد                 |
| —                            | `messages-service.ts`                            | 🆕 جديد                 |
| —                            | `ads-service.ts`                                 | 🆕 جديد                 |
| —                            | `store-products-service.ts`                      | 🆕 جديد                 |
| —                            | `error-handler.ts`                               | 🆕 جديد                 |
| —                            | `retry-manager.ts`                               | 🆕 جديد                 |
| —                            | `event-bus.ts`                                   | 🆕 جديد                 |

### 3.2 خدمات تم ربطها (تمت)

| الخدمة               | الملف               | الحالة                                                   |
| -------------------- | ------------------- | -------------------------------------------------------- |
| `ViewService`        | `view-service.ts`   | ✅ مربوطة في `createServices()`                          |
| `ViewTrackerService` | `view-tracker.ts`   | ✅ مربوطة في `createServices()`                          |
| `ViewEventPublisher` | `view-publisher.ts` | ✅ مربوطة في `createServices()`                          |
| `WebSocketService`   | — (غير منقولة)      | ❌ أُسقط — البث المباشر عبر SSE `scan-events` بدلاً منها |

### 3.3 أخطاء تشغيلية في الخدمات

| #   | الخدمة                       | المشكلة                                                                                                                                                                                           | الحالة                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `view-publisher.ts:90`       | تمرر `visitorId` لكن `activityRepo.logActivity()` تستقبل `deviceId`                                                                                                                               | ✅ تم الإصلاح                         |
| 2   | `tmdb-enrichment-service.ts` | `metadata_started`/`metadata_completed` تُبث على EventEmitter الخاص وليس EventBus العمومي                                                                                                         | ✅ تم الإصلاح                         |
| 3   | `tmdb-enrichment-service.ts` | `media:changed` يُبث على EventEmitter الخاص وليس EventBus العمومي                                                                                                                                 | ✅ تم الإصلاح                         |
| 4   | `services/index.ts:194`      | الجسر `scan:error → scan_error` **فعال** (الباعث في `scan-orchestrator.ts:272,285,443`)، لكن **لا مشترك** على `scan_error` في `scan-events`/`admin/events` — أخطاء العناصر الفردية لا تصل للواجهة | 🔧 يحتاج مشتركاً أو إزالة             |
| 5   | `cache-service.ts`           | 6 أنواع أحداث تُبث على EventBus بلا مستمعين                                                                                                                                                       | ⏳ قيد المراجعة                       |
| 6   | `websocket-service.ts:72`    | 17+ اشتراك لأحداث لا تُبث أبداً على EventBus                                                                                                                                                      | ❌ أُسقط — البث عبر SSE `scan-events` |

---

## 4. Scanner

| المكون                  | القديم | الجديد                       | الحالة                                |
| ----------------------- | ------ | ---------------------------- | ------------------------------------- |
| `ScanOrchestrator`      | موجود  | `scan-orchestrator.ts`       | ✅ منقول                              |
| `ScanState`             | موجود  | `scan-state.ts`              | ✅ منقول                              |
| `DirectoryWalker`       | موجود  | `directory-walker.ts`        | ✅ منقول                              |
| `MediaSyncService`      | موجود  | `media-sync.service.ts`      | ✅ منقول                              |
| `DeletionDetector`      | موجود  | `deletion-detector.ts`       | ✅ منقول + أُعيدت كتابته (2026-08-09) |
| `HierarchyRules`        | موجود  | `hierarchy-rules.ts`         | ✅ منقول                              |
| `HierarchyValidator`    | موجود  | `hierarchy-validator.ts`     | ✅ منقول                              |
| `ImageLinkerService`    | موجود  | `image-linker.service.ts`    | ✅ منقول                              |
| `PathValidationService` | موجود  | `path-validation.service.ts` | ✅ منقول                              |
| `LibraryMonitor`         | موجود  | `folder-watcher.ts`          | ✅ منقول                              |
| `TitleEnhancer`         | موجود  | `title-enhancer.ts`          | ✅ منقول                              |

### 4.1 مشاكل Scanner

| المشكلة                             | الموقع                                           | التفاصيل                                                                                                                                      | الحالة                           |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `p-limit` import ديناميكي داخل حلقة | `scan-orchestrator.ts:698`                       | كل استدعاء لـ `cleanupOrphanedItems()` يعيد استيراد `p-limit` — يجب رفعه لمستوى الوحدة وإضافته لـ `package.json` (اعتماد شبح حالياً)          | ⏳ قيد الإصلاح (المرحلة 2)       |
| حماية المسح المتزامن                | `scan-orchestrator.ts:142-152, 364-374, 469-479` | `_activeScanId` يُحجز بشكل متزامن قبل أي await في `prepareScan`/`prepareContainer`/`prepareScanAll` → `ScanAlreadyRunningError` (TOCTOU-safe) | ✅ تم (2026-08-08)               |
| Temp table منافسة                   | `deletion-detector.ts`                           | `temp_paths` **مُحذف نهائياً** (2026-08-09) — إعادة كتابة الكاشف على العمود المفهرس بلا أي جدول مؤقت (لم تعد مسألة منافسة قائمة أصلها)        | ✅ تم (2026-08-09 — حُذف الجدول) |
| أخطاء فردية غير مبلغ عنها           | `scan-orchestrator.ts:272, 285, 443`             | أخطاء الملفات/المجلدات الفردية تذهب لـ `state.addError()` **وتُبث** `scan:error` (وأخطاء أطفال الحاوية في `runContainer`)                     | ✅ تم (2026-08-08)               |

---

## 5. Event Bus & SSE

### 5.1 تدفق الأحداث

```
TmdbEnrichmentService (EventEmitter الخاص)
  ├── metadata_started      ──→ EventBus  ✅ (تم الإصلاح)
  ├── metadata_completed    ──→ EventBus  ✅ (تم الإصلاح)
  ├── enrichment_progress   ──→ enrichment-controller callback ──→ EventBus  ✅
  └── media:changed         ──→ EventBus  ✅ (تم الإصلاح)

ScanOrchestrator (EventEmitter الخاص)
  ├── scan:started  ──→ EventBus (services/index.ts bridge)  ✅
  ├── scan:completed ──→ EventBus                             ✅
  ├── scan:failed   ──→ EventBus                              ✅
  ├── scan:paused   ──→ EventBus                              ✅
  ├── scan:resumed  ──→ EventBus                              ✅
  ├── scan:stopped  ──→ EventBus                              ✅
  ├── scan:error    ──→ EventBus (`scan_error`) — الباعث يعمل ✅ لكن **لا مشترك** ⚠️ (راجع §3.3#4)
  └── scan:item     ──→ EventBus                              ✅

CacheService (EventBus مباشر)
  ├── cache_item_expired     ──→ لا مستمعين                    ⚠️
  ├── cache_bulk_delete      ──→ لا مستمعين                    ⚠️
  ├── cache_stale_used       ──→ لا مستمعين                    ⚠️
  ├── cache_eviction         ──→ لا مستمعين                    ⚠️
  ├── cache_cleanup          ──→ لا مستمعين                    ⚠️
  └── cache_cleared          ──→ لا مستمعين                    ⚠️
```

### 5.2 أحداث EventBus التي كانت مشتركة عبر WebSocket القديم (أُسقط)

> **قرار معتمد:** النظام الجديد يستخدم **SSE فقط** — لا WebSocket ولا Long Polling.
> الجدول أدناه مرجع تاريخي لأحداث كان القديم يبثها عبر WebSocket؛ في الجديد تُبث
> مباشرة عبر SSE (`/api/scan-events`، `/api/admin/events`) أو لم تُنقل بعد.

| الحدث                     | المصدر في القديم      | المصدر في الجديد                  |
| ------------------------- | --------------------- | --------------------------------- |
| `user_created`            | UserService           | ✅ يبث + مشترك `CacheInvalidator` |
| `user_updated`            | UserService           | ✅ يبث + مشترك `CacheInvalidator` |
| `user_deleted`            | UserService           | ✅ يبث + مشترك `CacheInvalidator` |
| `user_login`              | AuthService           | ❌ غير موجود                      |
| `user_logout`             | AuthService           | ❌ غير موجود                      |
| `settings_updated`        | SettingsService       | ✅ يبث + مشترك `CacheInvalidator` |
| `media_updated`           | MediaService          | ✅ يبث + مشترك `CacheInvalidator` |
| `system_alert`            | SystemService (محذوف) | ❌ غير موجود                      |
| `system_warning`          | SystemService (محذوف) | ❌ غير موجود                      |
| `maintenance_toggle`      | SettingsService       | ❌ غير موجود                      |
| `user_progress_update`    | ProgressService?      | ❌ غير موجود                      |
| `visitor_progress_update` | ProgressService?      | ❌ غير موجود                      |

> **ملاحظة**: أحداث `user_created/updated/deleted` و`settings_updated` و`media_updated`
> تُبث الآن على EventBus (باعثوها موجودون) ويستهلكها `CacheInvalidator`.
> المتبقي غير المبث بعد: `user_login`, `user_logout`, `maintenance_toggle`,
> `user_progress_update`, `visitor_progress_update`.

---

## 6. Repositories

| القديم | الجديد                            | الحالة          |
| ------ | --------------------------------- | --------------- |
| —      | `base-repository.ts`              | 🆕 قاعدة مشتركة |
| —      | `database-repository.ts`          | 🆕 جديد         |
| —      | `snapshot-repository.ts`          | 🆕 جديد         |
| —      | `enrichment-media-repository.ts`  | 🆕 جديد         |
| —      | `enrichment-repository.ts`        | 🆕 جديد         |
| —      | `translation-cache-repository.ts` | 🆕 جديد         |
| —      | `visitor-repository.ts`           | 🆕 جديد         |
| —      | `progress-repository.ts`          | 🆕 جديد         |
| —      | `report-repository.ts`            | 🆕 جديد         |
| —      | `news-repository.ts`              | 🆕 جديد         |
| —      | `messages-repository.ts`          | 🆕 جديد         |
| —      | `ads-repository.ts`               | 🆕 جديد         |
| —      | `store-products-repository.ts`    | 🆕 جديد         |
| —      | `security-repository.ts`          | 🆕 جديد         |

### 6.1 ملاحظات Repositories

| المشكلة                                                                                                      | الموقع                | الحالة         |
| ------------------------------------------------------------------------------------------------------------ | --------------------- | -------------- |
| `MediaRepository` كانت تنقصها دوال (`getByPath`, `findExisting`, `getImageFields`, `invalidateLibraryCache`) | `media-repository.ts` | ✅ تمت الإضافة |

> **ملاحظة**: النظام القديم لم يكن لديه `repositories/` مجلد منفصل — كانت استعلامات SQL مدمجة في الخدمات مباشرة.
> v2 فصل طبقة البيانات بشكل أفضل في Repositories. المقارنة المباشرة صعبة.

---

## 7. Middleware

| القديم                        | الجديد                                       | الحالة   |
| ----------------------------- | -------------------------------------------- | -------- |
| مدمج في `middleware.ts` الجذر | `middleware.ts` (جذر src)                    | ✅ منقول |
| —                             | `src/backend/middleware/rate-limiter.ts`     | 🆕 جديد  |
| —                             | `src/backend/middleware/visitor-tracking.ts` | 🆕 جديد  |
| —                             | `src/backend/middleware/maintenance.ts`      | 🆕 جديد  |

---

## 8. قاعدة البيانات (Schema)

| القديم (`lib/backend/db.js`) | الجديد (`src/backend/db/`)                              | الحالة               |
| ---------------------------- | ------------------------------------------------------- | -------------------- |
| اتصال SQLite مدمج            | `db.ts` أساسي + `index.ts` و `migrate.ts` و `schema.ts` | ✅ إعادة هيكلة كاملة |

---

## 9. Frontend

> ✅ تحليل شامل للواجهتين (عرض + أدمن) أُنجز بتاريخ 2026-08-06 — انظر سجل التعديلات أدناه.

| القديم (`src/components/`, `src/features/`, `src/hooks/`) | الجديد (`src/app/`, `src/features/`, `src/shared/`) | الحالة         |
| --------------------------------------------------------- | --------------------------------------------------- | -------------- |
| هيكل Next.js مع Pages Router                              | هيكل Next.js مع App Router                          | 🔄 إعادة هيكلة |
| —                                                         | 20 صفحة أدمن + 15 صفحة عرض + صفحة تسجيل دخول        | ✅ محللة       |

### 9.1 خلاصة تدقيق الواجهات (2026-08-06)

- **أدمن**: 15 من 20 صفحة مربوطة فعلياً؛ `upload-page` و`subscription-page` عناصر نائبة «قريباً» بلا أي backend؛
  `messages-page` زر «إرسال رسالة للعملاء» كان وهمياً (رُبط لاحقاً بـ `useCreateMessage` — انظر سجل التعديلات).
- **العرض**: صفحة `/genre` كانت مكسورة (مسار `/media/genres/list` خاطئ — أُصلح)؛ القوائم الرقيقة كانت بلا
  pagination (أُضيف تمرير لانهائي)؛ مدة الحلقة في `episode-card` كانت تُعرض بالثواني (أُصلحت للدقائق)؛
  خطأ فحص الفيديو في الـ player كان يُخلط مع «غير متاح» (فُصل مع زر إعادة محاولة).
- الـ player والبث المباشر والأقسام والأشخاص والرئيسية كلها مربوطة فعلياً بواجهات API موجودة.
- لا توجد بيانات placeholder/mock في الواجهتين.

---

## 10. الثوابت والتكوين

| القديم                       | الجديد                                                                  | الحالة          |
| ---------------------------- | ----------------------------------------------------------------------- | --------------- |
| `src/lib/backend/constants/` | `src/shared/`                                                           | ✅ منقول        |
| `src/types.d.ts`             | — (لا يوجد `src/types/` في v2؛ الأنواع المشتركة في `src/shared/types/`) | ✅ أُعيد تنظيمه |
| —                            | `src/lib/config/env.ts`                                                 | 🆕 جديد         |

---

## 11. الاختبارات

| القديم                   | الجديد       | الحالة                                              |
| ------------------------ | ------------ | --------------------------------------------------- |
| `tests/` (Playwright)    | `src/tests/` | 🟡 موجود لكنه فارغ (لا يوجد إطار اختبارات مهيأ بعد) |
| `jest.backend.config.js` | —            | يمكن إعادة استخدامه مستقبلاً                        |
| `coverage-backend/`      | —            | —                                                   |

---

## 12. أخطاء TypeScript التي تم إصلاحها

| #   | الملف                     | المشكلة                                                                               | الحالة |
| --- | ------------------------- | ------------------------------------------------------------------------------------- | ------ |
| 1   | `media-repository.ts`     | دوال مفقودة (`getByPath`, `findExisting`, `getImageFields`, `invalidateLibraryCache`) | ✅     |
| 2   | `directory-walker.ts`     | استيراد `EventEmitter` خاطئ                                                           | ✅     |
| 3   | `folder-watcher.ts`       | override مفقود، استيراد `chokidar`                                                    | ✅     |
| 4   | `scan-orchestrator.ts`    | override مفقود، فحص null                                                              | ✅     |
| 5   | `media-sync.service.ts`   | `mime_type` اختصار، `createMedia` إرجاع                                               | ✅     |
| 6   | `image-linker.service.ts` | `getImageFields` غير معروف، undefined checks                                          | ✅     |
| 7   | `hierarchy-rules.ts`      | `ValidationParams` كاست                                                               | ✅     |
| 8   | `scan-controller.ts`      | `LibraryType` كاست                                                                    | ✅     |
| 9   | `title-enhancer.ts`       | undefined index                                                                       | ✅     |
| 10  | route files               | نوع `unknown`، الوصول لـ `LibraryMonitor`                                              | ✅     |

---

## 13. سجل التعديلات

| التاريخ    | التغيير                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | المسؤول |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 2026-07-28 | إنشاء سجل الترحيل                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent   |
| 2026-07-28 | إصلاح `visitorId→deviceId` في `view-publisher.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent   |
| 2026-07-28 | إضافة بث `metadata_started`/`metadata_completed`/`media:changed` على EventBus في `tmdb-enrichment-service.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-07-28 | إصلاح 10 أخطاء TypeScript (دوال مفقودة، imports، types)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Agent   |
| 2026-07-28 | تثبيت `chokidar` مع التعريفات                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-07-28 | إضافة `ScanController` إلى الـ controllers route                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Agent   |
| 2026-07-28 | تحليل كامل لجميع مسارات API بين القديم والجديد                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Agent   |
| 2026-08-01 | تدقيق شامل للحالات مقابل الكود الفعلي (enrich/translate/scan/dashboard، ربط خدمات الـ View، إسقاط WebSocket، تصحيح أقسام الثوابت والاختبارات)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-06 | نقل التخزين الافتراضي لصور الإثراء خارج جذر المشروع إلى `D:\assets\images\enriched` (هجرة `004_external_image_storage.sql` + افتراضي `settings-registry`) مع إبقاء المسارات المخزَّنة web-relative وربطها بالجذر الخارجي في `resolveImagePath`، وتصحيح كشف المسارات المطلقة على ويندوز (`isAbsoluteDiskPath`) حيث كان `path.isAbsolute("/assets/...")` يعيد true فيعطل القراءة من التخزين الخارجي                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent   |
| 2026-08-06 | توحيد مسارات صور الأشخاص في `media_people` عبر `scripts/normalize-person-images.mjs` (الجاف افتراضياً، `--apply` مع نسخة احتياطية إلى `data/backups`): إزالة 570 تضارباً (2+ قيمة/شخص) و778 مساراً مكسوراً، وتوحيد كل صفوف كل شخص — 761 شخصاً بلا ملف قابل للعرض أصبحوا `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Agent   |
| 2026-08-06 | تدقيق شامل للواجهتين (أدمن + عرض) والـ backend: 15/20 صفحة أدمن حقيقية، `upload`/`subscription` عنصران نائبان، صفحة `/genre` كانت مكسورة، 13 دالة كنترولر بلا route، 5 خدمات منشأة وغير مستهلكة، وledger متقادم في 10+ مسار (ترخيص، stream، database، old-unwatched، rebuild، avatar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Agent   |
| 2026-08-06 | إصلاح مسارات `api-media.ts` (`/media/genres/list`→`/media/genres`، `/media/types/list`→`/media/types`، `/channels`→`/live-channels`) — يعيد عمل صفحة `/genre`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-06 | ربط «إرسال رسالة للعملاء» في `messages-page.tsx` بـ `useCreateMessage` (كان `console.log` فقط) مع تحقق من الإدخال وحالات تحميل/فشل                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Agent   |
| 2026-08-06 | إضافة تمرير لانهائي للقوائم الرقيقة: هوك `useInfiniteMediaByFilter` + دعم `hasMore/onLoadMore` في `ListingPage`، وتطبيقه على `genre/[slug]` و`year/[year]` و`rating/[value]` و`certification/[cert]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent   |
| 2026-08-06 | إصلاح مدة الحلقة في `episode-card.tsx` (دقائق بدل عرض ثوانٍ) وفصل خطأ فحص الفيديو في الـ player عن «غير متاح» مع زر إعادة محاولة                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Agent   |
| 2026-08-06 | هجرة `005_rename_media_people_character.sql`: إصلاح انحراف schema — عمود `media_people.character_name` الموروث من القديم يُعاد تسميته `character` (كان كل قراءة/كتابة تفشل بـ «no such column: character»)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Agent   |
| 2026-08-06 | مسار جديد `src/app/api/images/[id]/route.ts` يخدم صور الإثراء الخارجية مع ETag قوي + `304 Not Modified` + `Cache-Control: max-age=300` (يحل محل 404 بعد تجاوز max-age)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Agent   |
| 2026-08-06 | إعادة تصميم صفحة تفاصيل العنصر وقسم طاقم التمثيل (مهارة frontend-design): إصلاح تشوه التخطيط، إزالة شريط التمرير، تصحيح تضاعف الحشو/التباعد، وحل تناقض صور الأشخاص بين `/person/[id]` وصفحات العرض (الخيار A)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-06 | تبسيط نموذج طاقم العمل: `crew-roles.ts` + `crew-helpers.ts` (جديدان) — `media.cast` للممثلين فقط (`role=Actor`، 6 ظاهرون + «عرض الكل») و`media.crew` للأدوار الأساسية فقط (مخرج/كاتب/سيناريو/قصة/منتج/مساعد مخرج، 4 ظاهرون + «عرض الكل»)، الفلترة في `media-service`/`tmdb-enrichment-service` قبل الوصول للواجهة، و`media_people` تبقى المصدر الكامل دون حذف                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-06 | صفحات الشهادات والتقييمات مبنيّة على الباك إند: `getAllCertifications` + `getRatingBuckets` في `media-controller`/`media-service`/`media-repository` + مسارا API `api/media/certifications` و`api/media/ratings` + نقل الصفحات إلى `features/viewer/pages` (Pattern C): `certifications`/`certification-items`/`ratings`/`rating-items` + إعادة كتابة صفحات App Router `certification/{page,[cert]}` و`rating/{page,[value]}`                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-06 | إعادة تصميم `viewer-header` و`viewer-navigation` بموبايل-فيرست وإصلاح الأزرار/الروابط المعطّلة في `item-detail-page` (سببها كلاسات الحاوية المنكمشة)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent   |
| 2026-08-06 | مراجعة تحليلية شاملة لملفات `"use client"` (قراءة فقط): 137 ملفاً (تصحيح 128 القديم)، 131 مبرراً و6 مرشحين للتنظيف — قرار المستخدم: لا تنظيف كود؛ وتصحيح نمط القوائم في `AGENTS.md` + `LAYER-FRONTEND.md` (Pattern A/C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Agent   |
| 2026-08-06 | إنشاء `docs/session-logs/2026-08-06.md`: سجل جلسات اليوم الكامل (جلسة صباح 03:26–12:10 + جلسة مساء 13:18–16:29 + 4 subagents للتدقيق) مستخرج من مخزن جلسات opencode `opencode.db`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent   |
| 2026-08-06 | التحقق من سجل اليوم مقابل الكود الفعلي: كل البنود الوظيفية مثبّتة في الكود (cast/crew، صور الأشخاص، الشهادات/التقييمات، التمرير اللانهائي، الموبايل-فيرست، إصلاح الأزرار) — مع توثيق ملاحظات: كود معلّق في `item-detail-page`/`viewer-header`/`viewer-navigation`، فراغات في `crew-roles.ts`، و`CAST_DEFAULT_COUNT=6` مقابل طلب 7 — وتثبيت حالة خطة الأدمن «معلّقة»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent   |
| 2026-08-07 | **المرحلة 1 — حماية المسح المتزامن في `scan-orchestrator.ts`**: حقل `_activeScanId` يُحجز متزامناً في `prepareScan`/`prepareContainer`/`prepareScanAll` قبل أي await → `ScanAlreadyRunningError` عند أي تعارض (TOCTOU-safe)؛ أعلام `_aborted/_paused` تُصفَّر على كل حجز جديد                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Agent   |
| 2026-08-07 | **المرحلة 1 — فصل prepare/run في `scan-controller.ts`**: `startScan`/`scanAll` تنتظران الـ prepare فتعودان **409** على تعارض الفحص بدل 202 الكاذب، والـ walk نفسه يعمل في الخلفية (fire-and-forget) مع الإبلاغ عبر SSE؛ `scanAll` تحجز فتحة `batch` فورياً وترجع **202** `{total}` دون حجز الطلب                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Agent   |
| 2026-08-07 | **المرحلة 1 — إصلاح deadlock (pause→stop)**: `stopScan` يضبط `_aborted=true` + `_paused=false` + `releasePauseWaiters()` قبل إنهاء الحالات؛ والـ walker يتحقق `_aborted` قبل وبعد `waitForResume` فلا يعلق أبداً — الفحص الموقوف يُعلَّم snapshot كـ `interruptScan`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent   |
| 2026-08-07 | **المرحلة 1 — دفاع عميق + ربط المقاطعة**: `AND library_id = ?` في كل UPDATE/بالدفعات بـ `completeScan`/`updateLibraryStats`/`cleanupOrphanedItems`؛ `interruptScan` مربوط في فشل الـ prepare ومسار الإيقاف وفشل `runScan`؛ إضافة `terminateChildSessions()` لإنهاء جلسات الأطفال اليتيمة (`ownsSlot=false`) عند إيقاف/إنهاء الفحص الأعلى                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Agent   |
| 2026-08-07 | **المرحلة 1 — اختبارات دورة الحياة** في `src/tests/unit/scan-orchestrator.test.ts` (6 اختبارات): رفض مسح ثانٍ، إكمال فحص طفل، حجز فتحة `scanAll`، stop أثناء pause بلا تعليق (snapshot ← interrupted)، resume بعد pause يكمل دون interrupt، و`isScanning` يعيد false عند paused — **6/6 ناجحة، والمجموعة كلها 52/52 عبر 19 suite، و`tsc --noEmit` نظيف**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Agent   |
| 2026-08-08 | إصلاح اختبار `scan-orchestrator.test.ts` الفاشل (جلسة فحص طفل تالفة عند إيقاف الأب): `terminateChildSessions()` تُستدعى في `runScan` (finally) و`stopScan` — جلسة الطفل المعلّقة بـ `ownsSlot=false` لا تسمم مسحاً لاحقاً لنفس المكتبة                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Agent   |
| 2026-08-08 | إصلاح فساد `.next/dev/types` (مراجع `./routes.js` قديمة) بحذف المجلد المعطوب — `tsc --noEmit` نظيف مجدداً (الخادم يعيد توليدها عند أول compile لمسار)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Agent   |
| 2026-08-08 | تدقيق تطابق الوثائق مع الواقع بعد المرحلة 1: تحديث `migration-ledger.md` (§4.1/§5.1/§13/§14) و`LAYER-SCANNER.md` (التدفق + مراجع الأسطر + RC-8) وإنشاء `docs/session-logs/2026-08-08.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Agent   |
| 2026-08-09 | إعادة كتابة كاشف الحذف على العمود المفهرس في `deletion-detector.ts` (إعادة بناء كاملة): `LIKE ? ESCAPE '\'` + `escapeLikePattern` + `buildPathPrefixConditions` (De Morgan) + `normalizeDeletionRoots` + حارس `directory_path IS NOT NULL`؛ حذف نهائي لجدول `temp_paths` وتعبير `LOWER/REPLACE` المعطّل للفهارس                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Agent   |
| 2026-08-09 | إصلاح خطأ حقيقي في `media-sync.service.ts:217-245`: فرع «الملف موجود مسبقاً» يضيف الآن عنصر الوسائط المالك إلى `visitedMediaIds` (سطر 221) — يبقى عنصر الحلقة `is_available=1` عبر `completeScan` بدل بقائه «غير متاح» رغم وجود ملفه                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent   |
| 2026-08-09 | تجارب مسح حقيقية عبر `scripts/scan-real-library.js` (+`.ts`): #15 (quick، 4.4ث، أضاف 129 عنصراً) و#31 (quick، `items_avail` 564→8266، `items_unavail` 7750→48، `files_avail` 0→7748)؛ الـ48 المتبقية حذف حقيقي («أهل الغرام»)؛ التشخيص أثبت أن الـ7750 تعليم خاطئ من الكاشف القديم؛ نسخة احتياطية `data/media_library.db.bak-before-scan`؛ التحقق: **66/66** اختبار + typecheck + prettier نظيفة                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Agent   |
| 2026-08-09 | قرار watcher موثّق: لا `ACTION_LABELS` في الكود و`fs:event` غير موصول بـ EventBus — لا ربط يُضاف؛ فك false-positives (`patchDynamicQuery`/`EventsController.eventMap` سليمان، SSE 16/16)؛ توثيق الجلسة كاملة في `docs/session-logs/2026-08-09.md` + تحديث `LAYER-SCANNER.md` و`migration-ledger.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent   |
| 2026-08-09 | تفعيل ديباج الماسح (SCANNER_DEBUG): وحدة جديدة `src/backend/scanner/scan-debug.ts` (`isScanDebugEnabled`/`isScanDebugVerbose`/`scanDebug`/`scanDebugVerbose`، مقيدة بـ `NODE_ENV!=production`، تقرأ من `process.env` مباشرة لا من مخطط Zod)؛ قرار التسمية: محدد للماسح بدل `DEBUG` العام؛ ربط السجلات في `scan-orchestrator.ts` (أطوار+تقدم كل 100+ملخصات) و`deletion-detector.ts` (جذور+أعداد) و`media-sync.service.ts`/`directory-walker.ts` (verbose عبر SCANNER_DEBUG_VERBOSE)؛ تفعيل `SCANNER_DEBUG=1` في `.env.local` + توثيقها في `.env.example`؛ التحقق: typecheck + 66/66 اختبار + prettier + فحوصات تشغيلية (on/off + بوابة الإنتاج)                                                                                                                                                                                                                   | Agent   |
| 2026-08-09 | إصلاح سباق المعاملات في فهرس البحث: مسح حقيقي (#33) كشف `cannot start a transaction within a transaction` — `rebuildIndex()`/`backfillMissing()` في `search-repository.ts` كانتا تستخدمان `db.exec("BEGIN")` خاماً فتصطدمان بـ `SAVEPOINT` الذي يفتحه `cleanupOrphanedItems` بعد `scan:completed` (backfill fire-and-forget في services/index.ts:199)؛ الاستبدال بـ `this.withTransaction` (SAVEPOINT قابل للتطعيس)؛ اختبار تراجعي جديد `src/tests/unit/search-repository.test.ts` (3 اختبارات)؛ التحقق: **69/69** اختبار + typecheck نظيف                                                                                                                                                                                                                                                                                                                       | Agent   |
| 2026-08-09 | **P1 — تخفيف زمن الاستجابة** (شكاوى تأخير 15.5s/2.2min أثناء المسح): `busy_timeout` 15000→**3000** (db.ts)؛ **تثخين بث `scan_item`** إلى بث واحد كل **500ms** في `scan-events/route.ts` (أحداث lifecycle فورية)؛ **`pollingInterval` شرطي** في `use-admin-events-history`/`use-admin-security-events` و`events-page.tsx` يستخدم `connected ? false : 15_000` — لا استطلاع خلفية أثناء اتصال SSE فعّال                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Agent   |
| 2026-08-09 | **P2 — فصل اتصال الكتابة للماسح**: اتصال SQLite ثانٍ لنفس الملف (`initializeWriterDatabase`/`getWriterDatabase`) + `runInWriterContext` (AsyncLocalStorage) يغلّف `prepareScan`/`runScan` وbackfill الفهرس (`services/index.ts:201-205`) — قراءات بقية التطبيق لم تعد تنتظر في قائمة عبارات الماسح على الاتصال الواحد. إصلاح 4 اختبارات كشفها التنفيذ: مسار متزامن في `runInWriterContext` (سباق بوابة الـ walker)، ذاكرة مشتركة للاختبارات عبر URI `cache=shared` (عزل `:memory:`)، وكسر تعادل `getActiveProgress` — **74/74 اختبار + typecheck + prettier نظيفة** (تفاصيل: `docs/session-logs/2026-08-09.md` الجلسة السادسة)                                                                                                                                                                                                                                   | Agent   |
| 2026-08-09 | **P3 — "معاملة لكل دفعة" في `media-sync.service.ts`**: `runBatched` (تحفظة دفعة خارجية تُمسك بقفل `withExclusiveTransaction`؛ كل عنصر يُلتزم داخل SAVEPOINT متداخل؛ الالتزام كل `batchSize` مع سقف لحجم المعاملة) + تغليف المشي كله في `scan-orchestrator.ts:265` + اختبار `src/tests/unit/media-sync-batch.test.ts` (3 اختبارات: التزام جماعي بحدود الدفعة، عزل فشل العنصر بلا كسر مراجع الأب/الطفل، ذيل الدفعة عند فشل المشي — **3/3 ناجحة**). **اكتشاف تراجع**: 4 اختبارات دورة حياة في `scan-orchestrator.test.ts` (stop/pause، resume، getActiveProgress، isScanning) تعلّقت بمهلة 5000ms — المشي الملفوف بالقفل يصل إلى تسجيل بوابة `ControlledWalker` متأخراً (hops غير متزامنة مضافة: getDatabase → قفل withExclusiveTransaction → SAVEPOINT) فتفوته `releaseGate` المتزامنة (سباق البوابة) ويعلق القفل — **الإصلاح معلّق** (تفاصيل: سجل الجلسة السابعة) | Agent   |

---

## 14. الأولويات المتبقية

| الأولوية  | المهمة                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | القسم       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| ✅ تم     | ربط `ViewService` + `ViewTrackerService` + `ViewEventPublisher` في `createServices()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Services    |
| ❌ مقرر   | `WebSocketService` غير منقولة — البث المباشر عبر SSE `scan-events`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Services    |
| ✅ تم     | إضافة مشترك على `scan_error` في `scan-events`/`admin/events` + `use-admin-events-sse.ts` (بث أخطاء المسح الميداني للواجهة) (2026-08-09)                                                                                                                                                                                                                                                                                                                                                                                                                                       | Scanner     |
| ✅ تم     | رفع استيراد `p-limit` لمستوى الوحدة في `scan-orchestrator.ts` **وإضافته إلى `package.json`** (`^3.1.0`) — زوال الاعتماد الشبح (2026-08-09)                                                                                                                                                                                                                                                                                                                                                                                                                                    | Scanner     |
| ✅ تم     | المرحلة 1 — حماية المسح المتزامن + فصل prepare/run (409 بدل 202) + scanAll فوري + إصلاح deadlock + `AND library_id` + `interruptScan` + `terminateChildSessions` + 6 اختبارات دورة الحياة (2026-08-07/08)                                                                                                                                                                                                                                                                                                                                                                     | Scanner     |
| ✅ تم     | **المرحلة 2 — الأداء (نطاق الماسح)**: تصفير `batchDelayMs` (services/index.ts:147)، معاملة SAVEPOINT لكل عنصر في `media-sync.service.ts` (بذل "لكل دفعة" — تفصيل أدناه)، عدّ الأطفال بالذاكرة (`markParentCountDirty`/`flushParentCounts`) بدل `updateParentChildrenCount` لكل صف، keyset بدل `OFFSET` + فحص المجلد الأب في `cleanupOrphanedItems` + اختبار تراجعي (2026-08-09)                                                                                                                                                                                               | Scanner     |
| ✅ تم     | **P1 — تخفيف زمن الاستجابة (نطاق الأداء)**: `busy_timeout` 15000→3000 (db.ts)؛ تثخين بث `scan_item` إلى 500ms في `scan-events/route.ts` (أحداث lifecycle فورية)؛ `pollingInterval` شرطي `connected ? false : 15_000` في هوكَي أحداث الأدمن — لا استطلاع خلفية أثناء SSE فعّال (2026-08-09)                                                                                                                                                                                                                                                                                    | Scanner/DB  |
| ✅ تم     | **P2 — فصل اتصال الكتابة للماسح**: اتصال SQLite ثانٍ لنفس الملف (`initializeWriterDatabase`/`getWriterDatabase`) + `runInWriterContext` (AsyncLocalStorage) يغلّف `prepareScan`/`runScan`/backfill الفهرس — قراءات بقية التطبيق لم تعد تنتظر في قائمة عبارات الماسح على الاتصال الواحد؛ **74/74 اختبار + typecheck + prettier نظيفة** (2026-08-09)                                                                                                                                                                                                                            | Scanner/DB  |
| 🟡 مؤجل   | **المرحلة 2 — المتبقي**: "backfill مرة واحدة لكل عملية كاملة" (يلمس `searchService` → مؤجل بقرار: لا نلمس البحث قبل ثبات الماسح)؛ **P3 — "معاملة لكل دفعة"**: التنفيذ في الشجرة (`runBatched` في `media-sync.service.ts` + تغليف المشي في `scan-orchestrator.ts:265` + `media-sync-batch.test.ts` 3/3) لكنه **كشف 4 تراجعات** في `scan-orchestrator.test.ts` (مهلة 5000ms): قفل `withExclusiveTransaction` الممسوك لكامل المشي يؤخر وصول المشي إلى بوابة `ControlledWalker` فيفوتها `releaseGate` (سباق البوابة) ويعلق القفل — الإصلاح معلّق (2026-08-09، سجل الجلسة السابعة) | Scanner     |
| 🟡 مهم    | **FW-1 — فهرس FTS5 الفريد**: `media_search` بلا UNIQUE INDEX على `media_id` فـ`INSERT OR REPLACE` يُلحق صفاً بدل الاستبدال (ازدواجية فهرس) — هجرة `UNIQUE INDEX` + تعديل `backfillMissing`/`rebuildIndex` لـ`INSERT ... ON CONFLICT DO UPDATE` أو إزالة `REPLACE` + فك التكرارات (مكتشف 2026-08-09، تفاصيل في session log FW-1)                                                                                                                                                                                                                                               | Search/DB   |
| 🟡 جزئي   | **FW-2 — أداء المسح على الشبكات البطيئة**: تم: إعادة هيكلة `cleanupOrphanedItems` (keyset + فحص المجلد الأب بدل كل مجلد فرعي) — ذيل لمسح #33 (حوالي 29.6 دقيقة لـ 6200 عنصر) (مكتشف 2026-08-09، تفاصيل session log FW-2)؛ **تم بديل أفضل (2026-08-09): تثخين بث `scan:item` إلى بث واحد كل 500ms بدل تعطيله** — يُبقي التقدم حياً بلا إغراق (أحداث lifecycle فورية)؛ لم يعد هناك حاجة لخيار `--no-events` في الوقت الحالي                                                                                                                                                     | Scanner     |
| ✅ تم     | **إصلاح سباق SAVEPOINT** (`no such savepoint` بعد مسح حقيقي #33): بث `scan:completed` كان يُطلق `backfillMissing` (fire-and-forget) بينما `cleanupOrphanedItems` لا يزال ممسكاً بـ`SAVEPOINT` على الاتصال المشترك — `RELEASE` للمعاملة الخارجية يُدمّر الحفظات الداخلية المتداخلة. الحل: قفل FIFO (`withExclusiveTransaction` في db.ts) يغلّف مستخدمي الـ SAVEPOINT الثلاثة (`withItemTransaction`/`withTransaction`/`cleanupOrphanedItems`) + نقل `cleanupOrphanedItems` قبل بث `scan:completed` + اختبار تراجعي يعيد إنتاج الخطأ حرفياً (2026-08-09)                        | Scanner     |
| ✅ تم     | إعادة كتابة كاشف الحذف على العمود المفهرس (`directory_path LIKE 'prefix%'` + `ESCAPE` بدل `LOWER/REPLACE` المعطّل للفهارس) + حذف `temp_paths` + حارس `IS NOT NULL` + إصلاح تفعيل عنصر الحلقة في `media-sync.service.ts:221` — مثبّت بمسح حقيقي (#15/#31) (2026-08-09)                                                                                                                                                                                                                                                                                                         | Scanner     |
| 🟡 مهم    | **إزالة `LibraryMonitor`** (قرار المستخدم: مُهجَر) — فك ربط `services/index.ts:52,156,252` و`scanner/index.ts:10` وحذف `chokidar`/`@types/chokidar` من `package.json`                                                                                                                                                                                                                                                                                                                                                                                                          | Scanner     |
| 🟡 مهم    | بث الأحداث المتبقية (`user_login`, `user_logout`, `maintenance_toggle`, `user_progress_update`, `visitor_progress_update`) على EventBus                                                                                                                                                                                                                                                                                                                                                                                                                                       | Events      |
| 🟡 مهم    | خدمات منشأة وغير مستهلكة: `SecurityService`, `TranslationCacheService`, `ViewService`, `ViewTrackerService`, `ViewEventPublisher` — إما ربطها أو حذفها (أحداث `user_view`/`visitor_view` لا تعمل أبداً)                                                                                                                                                                                                                                                                                                                                                                       | Services    |
| 🟡 مهم    | 13 دالة كنترولر بلا route (منها `progress.delete` — لا يوجد `DELETE` على `/api/progress/[mediaId]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Controllers |
| 🟡 مهم    | صفحتا `upload` و`subscription` عنصران نائبان بلا backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Frontend    |
| 🟢 normal | رابط «البث المباشر» في `admin-sidebar.tsx:55` ميت (`href="#"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Frontend    |
| 🟢 normal | دوال/هوكات ميتة: `fetchMediaTypes`/`useMediaTypes`, `fetchChannels`/`useChannels` (أُصلحت مساراتها لكن لا مستخدم لها)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Frontend    |
| 🟢 normal | مراجعة أحداث Cache — إزالة البث أو إضافة مستمعين                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Cache       |
| 🟢 normal | توثيق JSDoc لجميع دوال Backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Docs        |
| 🟢 normal | تمرير `tsc --noEmit` بعد جميع التغييرات                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Build       |
| 🟡 مهم    | تنفيذ خطة الأدمن المعتمدة (2026-08-06): `--muted-foreground` في `.admin-layout` إلى `#9aa3b5`، حذف `opacity-70` في `admin-sidebar.tsx:185`، توحيد أسطح البطاقات `border border-border bg-card` في `dashboard-page`/`settings-page`/`messages-page` — التفاصيل في `docs/session-logs/2026-08-06.md`                                                                                                                                                                                                                                                                            | Frontend    |
| 🟢 normal | تنظيف الكود المعلّق في `item-detail-page.tsx` (3 كتل قسم طاقم العمل)، `viewer-header.tsx`، `viewer-navigation.tsx` (ثبّته تحقق 2026-08-06)                                                                                                                                                                                                                                                                                                                                                                                                                                    | Frontend    |
| 🟢 normal | تجميل `crew-roles.ts` (فراغات في تسمية `Producer` وتباعد غير منتظم) ومراجعة `CAST_DEFAULT_COUNT=6` مقابل طلب «7 ممثلين»                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Frontend    |
