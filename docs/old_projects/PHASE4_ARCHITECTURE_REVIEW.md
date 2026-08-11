# Phase 4 Architecture Review — Library Manager V2

**Date:** 2026-07-28
**Status:** Review Complete — Ready for Phase 5 Planning
**Reviewer:** Architecture Review Agent
**Scope:** Full backend architecture comparison (old vs new)

> ⚠️ **Historical snapshot (2026-07-28)** — مراجعة معمّمة عند نقطة زمنية محددة. بعض الحالات أصبحت
> غير صحيحة اليوم (مثل «Enrichment/Translation ❌ Missing» — الاثنان موجودان الآن).
> المصدر الحالي للحقيقة هو الكود الفعلي و `docs/migration-ledger.md`.

---

## Executive Summary

The new project has **14 controllers** covering core functionality. The old project has **15 controllers** with significantly more business logic. The gap analysis reveals:

- **5 missing controllers** (Enrichment, Translation, License, AdminContent, System)
- **~15 missing business logic features** in existing controllers
- **15 missing services** (including critical ones like EventBus, CacheService — WebSocketService أُسقط لصالح SSE)
- **10 missing infrastructure components** (middleware, retry, rate limiting)
- **5 missing DTO transformations**
- **3 missing security features**

**Estimated effort to close gaps:** 3-4 weeks of focused development.

---

## 1. Controller Comparison Matrix

### Old Controllers (15 total, ~3,147 lines)

| #   | Controller             | Lines |  Status in V2  | Gap                                              |
| --- | ---------------------- | ----- | :------------: | ------------------------------------------------ |
| 1   | AuthController         | 155   | ✅ Implemented | Minor gaps                                       |
| 2   | UserController         | 406   | ✅ Implemented | Missing avatar upload, type filtering            |
| 3   | MediaController        | 539   | ✅ Implemented | Missing streaming, admin list filters            |
| 4   | LibraryController      | 516   | ✅ Implemented | Missing scanning, watcher, image upload          |
| 5   | DashboardController    | 301   | ✅ Implemented | Minor gaps                                       |
| 6   | SettingsController     | 177   | ✅ Implemented | Missing cache clear, logo upload, network config |
| 7   | SearchController       | 70    | ✅ Implemented | Missing health check                             |
| 8   | EnrichmentController   | 525   | ❌ **Missing** | Entire controller                                |
| 9   | MediaReportController  | 71    | ✅ Implemented | Complete                                         |
| 10  | ImageController        | 149   | ✅ Implemented | Missing SVG fallback, debug endpoint             |
| 11  | DatabaseController     | 84    | ✅ Implemented | Missing restore, factory reset, download         |
| 12  | TranslationController  | 220   | ❌ **Missing** | Entire controller                                |
| 13  | SystemController       | 19    | ❌ **Missing** | Entire controller                                |
| 14  | LicenseController      | 113   | ❌ **Missing** | Entire controller                                |
| 15  | AdminContentController | 79    | ❌ **Missing** | Entire controller                                |

### New Controllers (14 total)

| #   | Controller          | Lines | Notes          |
| --- | ------------------- | ----- | -------------- |
| 1   | AuthController      | 75    | ✅ Complete    |
| 2   | UserController      | 120   | ✅ Complete    |
| 3   | MediaController     | 222   | ✅ Complete    |
| 4   | LibraryController   | 116   | ✅ Complete    |
| 5   | DashboardController | 104   | ✅ Complete    |
| 6   | SettingsController  | 53    | ✅ Complete    |
| 7   | SearchController    | 52    | ✅ Complete    |
| 8   | ProgressController  | 52    | ✅ New feature |
| 9   | FavoritesController | 48    | ✅ New feature |
| 10  | ReportController    | 67    | ✅ Complete    |
| 11  | DatabaseController  | 35    | ✅ Complete    |
| 12  | ImageController     | 22    | ✅ Complete    |
| 13  | VisitorController   | 65    | ✅ New feature |
| 14  | BaseController      | 75    | ✅ Base class  |

---

## 2. Missing Controllers — Priority Order

### Priority 1: EnrichmentController (525 lines)

**Impact:** HIGH — Core feature for metadata management
**Old Routes:** 18 endpoints (`/api/enrich/*`)
**Missing Features:**

- TMDB enrichment (single item, batch, by-filter)
- Session management with SSE progress (`/api/admin/events`)
- SSRF protection for image upload
- API key management
- Manual metadata updates
- Pending approval workflow (approve/reject/approve-all)
- Cancel enrichment
- Stats and health check

**Files Affected:**

- `src/backend/controllers/enrichment-controller.ts` (new)
- `src/backend/services/tmdb-enrichment-service.ts` (new)
- `src/backend/services/metadata-service.ts` (new)
- `src/backend/repositories/enrichment-repository.ts` (exists)
- `src/backend/repositories/pending-approval-repository.ts` (exists)
- `src/app/api/enrich/*/route.ts` (18 new routes)

### Priority 2: TranslationController (220 lines)

**Impact:** HIGH — Core feature for multilingual content
**Old Routes:** 6 endpoints (`/api/translate/*`)
**Missing Features:**

- Batch translation with session management
- Single item translation
- Rate limiting (3 concurrent, 500ms min)
- Cancel translation
- Health check
- Translation status tracking

**Files Affected:**

- `src/backend/controllers/translation-controller.ts` (new)
- `src/backend/services/translation-service.ts` (new)
- `src/backend/repositories/translation-cache-repository.ts` (exists)
- `src/app/api/translate/*/route.ts` (6 new routes)

### Priority 3: LicenseController (113 lines)

**Impact:** MEDIUM — Business requirement
**Old Routes:** 5 endpoints (`/api/license/*`)
**Missing Features:**

- License status check
- Activate (data/file)
- Deactivate
- Refresh
- License guard middleware

**Files Affected:**

- `src/backend/controllers/license-controller.ts` (new)
- `src/backend/services/license-service.ts` (new)
- `src/app/api/license/*/route.ts` (5 new routes)

### Priority 4: AdminContentController (79 lines)

**Impact:** LOW — Generic CRUD
**Old Routes:** 3 endpoints (`/api/admin-content/*`)
**Missing Features:**

- Generic CRUD for admin content blocks
- Stats endpoint

**Files Affected:**

- `src/backend/controllers/admin-content-controller.ts` (new)
- `src/backend/services/admin-content-service.ts` (new)
- `src/app/api/admin-content/*/route.ts` (3 new routes)

### Priority 5: SystemController (19 lines)

**Impact:** LOW — Windows-specific
**Old Routes:** 1 endpoint (`/api/system/start-agent`)
**Missing Features:**

- Start Windows native agent

**Files Affected:**

- `src/backend/controllers/system-controller.ts` (new)
- `src/backend/services/system-service.ts` (new)
- `src/app/api/system/start-agent/route.ts` (1 new route)

---

## 3. Missing Business Logic in Existing Controllers

### LibraryController — Scanning (HIGH)

**Old:** 150+ lines for scan start/stop/pause/resume
**New:** Not implemented
**Impact:** Users cannot scan libraries for new content

### MediaController — Streaming (HIGH)

**Old:** 40+ lines for actual file serving with range requests
**New:** Only returns file info, not actual stream
**Impact:** Users cannot play media files

### SettingsController — Cache Clear (LOW)

**Old:** 10+ lines for clearing in-memory cache
**New:** Not implemented
**Impact:** Minor — cache clears on restart

### DatabaseController — Restore/Download (MEDIUM)

**Old:** 35+ lines for backup restore and download
**New:** Only backup creation
**Impact:** Users cannot restore from backup or download backups

---

## 4. Missing Services — Priority Order

### Priority 1: EventBus (98 lines)

**Impact:** HIGH — Foundation for event-driven architecture
**Missing Features:**

- Centralized event pub/sub
- Event bridging (Scanner, Enrichment)
- SSE event routing (scan/admin)

### Priority 2: CacheService (473 lines)

**Impact:** HIGH — Performance critical
**Missing Features:**

- LRU eviction
- Stale cache for warming
- Memory monitoring (20% eviction at 500MB)
- Tiered TTLs (short/medium/long)

### Priority 3: SSE Endpoints (استبدال WebSocketService — 860 lines)

**Impact:** HIGH — Real-time updates عبر SSE فقط
**Missing Features:**

- Client management (EventSource)
- Event routing
- Progress updates for enrichment/translation
- User activity broadcasting

### Priority 4: TmdbEnrichmentService (1429 lines)

**Impact:** HIGH — Core enrichment engine
**Missing Features:**

- TMDB API integration
- Fuzzy matching (Jaccard similarity)
- Multi-provider fallback
- Batch processing
- Session management

### Priority 5: TranslationService (427 lines)

**Impact:** HIGH — Multilingual content
**Missing Features:**

- Google Translate integration
- Rate limiting
- Cooldown on 429
- Batch processing

### Priority 6: RetryManager (181 lines)

**Impact:** MEDIUM — Resilience
**Missing Features:**

- Exponential backoff
- Circuit breaker pattern
- Retryable error detection

### Priority 7: ErrorHandler (107 lines)

**Impact:** MEDIUM — Error handling
**Missing Features:**

- Error classification (Validation, Database, Scanner)
- Severity levels
- Sentry integration

### Priority 8: MetadataService (200 lines)

**Impact:** MEDIUM — Manual metadata editing
**Missing Features:**

- Manual metadata updates
- People processing
- Event emission

### Priority 9: ViewService/ViewTrackerService/ViewEventPublisher (177 lines)

**Impact:** MEDIUM — View tracking
**Missing Features:**

- View deduplication (10-min cooldown)
- Activity logging
- Event publishing

### Priority 10: HealthMonitor (250 lines)

**Impact:** LOW — Monitoring
**Missing Features:**

- Periodic metrics collection
- Memory/CPU/DB monitoring
- Webhook alerts

### Priority 11: AutoBackupScheduler (52 lines)

**Impact:** LOW — Operations
**Missing Features:**

- Periodic backup scheduling
- Event-driven triggers

### Priority 12: AdminContentService (54 lines)

**Impact:** LOW — Generic CRUD
**Missing Features:**

- Generic content block management

### Priority 13: SystemService (63 lines)

**Impact:** LOW — Windows-specific
**Missing Features:**

- Windows native agent management

---

## 5. Missing Infrastructure — Priority Order

### Priority 1: Rate Limiting Middleware (41 lines)

**Impact:** HIGH — Security
**Missing Features:**

- Dynamic rate limits from DB settings
- Auth-specific rate limiter (5/15min)

### Priority 2: Maintenance Mode Middleware (47 lines)

**Impact:** MEDIUM — Operations
**Missing Features:**

- 30s cache for maintenance status
- Admin bypass
- Path exemptions

### Priority 3: Visitor Tracking Middleware (41 lines)

**Impact:** MEDIUM — Analytics
**Missing Features:**

- Cookie-based session
- Device type detection
- Online status tracking

### Priority 4: DB Retry Middleware (50 lines)

**Impact:** MEDIUM — Reliability
**Missing Features:**

- SQLITE_BUSY retry with exponential backoff
- 503 error handler

### Priority 5: File Upload Handlers (92 lines)

**Impact:** MEDIUM — Media management
**Missing Features:**

- Multer configuration for library images
- Avatar upload (2MB limit)
- Logo upload (5MB limit, SVG)

---

## 6. Missing Security Features

### Priority 1: SSRF Protection (HIGH)

**Location:** EnrichmentController.uploadImageFromUrl
**Missing:** Blocks localhost, private IPs, metadata endpoints

### Priority 2: Path Traversal Protection (HIGH)

**Location:** DatabaseController.downloadBackup
**Missing:** Checks for `..`, `/`, `\` in file paths

### Priority 3: Dynamic Rate Limiting (HIGH)

**Location:** Rate limiter middleware
**Missing:** Reads rate limits from DB settings

---

## 7. Missing DTO Transformations

### Priority 1: MediaTransformer (115 lines)

**Impact:** HIGH — Media data normalization
**Missing Features:**

- Genre string → array splitting
- Boolean field normalization
- Computed fields (has_children, is_root, display_type)
- Year extraction from title
- Cast/crew/writers mapping

### Priority 2: LibraryService.toPublicLibrary() (50 lines)

**Impact:** MEDIUM — Library data normalization
**Missing Features:**

- Paths string → array splitting
- Boolean normalization
- Both snake_case and camelCase output

### Priority 3: SearchService.toPublicSearchResult() (30 lines)

**Impact:** MEDIUM — Search result normalization
**Missing Features:**

- Genre splitting
- Library info enrichment
- Custom metadata removal

### Priority 4: AuthService._sanitizeUser() (20 lines)

**Impact:** HIGH — User data sanitization
**Missing Features:**

- Password stripping
- Boolean normalization for is_admin

### Priority 5: SettingsService.getPublicSettings() (40 lines)

**Impact:** MEDIUM — Settings whitelist
**Missing Features:**

- Whitelist-based filtering
- Default values

---

## 8. Missing Audit Logging

### Priority 1: Activity Logging (HIGH)

**Status:** Partially implemented
**Missing:** User action tracking for all CRUD operations

### Priority 2: Security Event Logging (HIGH)

**Status:** Partially implemented
**Missing:** Login success/failure tracking, password changes

### Priority 3: Login Attempt Tracking (HIGH)

**Status:** Implemented in auth-service.ts
**Note:** Already complete with lockout mechanism

---

## 9. Migration Plan — Phase 5

### Phase 5A: Infrastructure Foundation (Week 1)

1. **EventBus** — Foundation for all event-driven features
2. **CacheService** — Performance critical
3. **RetryManager** — Resilience
4. **ErrorHandler** — Error handling

### Phase 5B: Security Middleware (Week 1)

1. **Rate limiting middleware**
2. **Maintenance mode middleware**
3. **Visitor tracking middleware**

### Phase 5C: Enrichment System (Week 2)

1. **EnrichmentController** (18 routes)
2. **TmdbEnrichmentService** (1429 lines)
3. **MetadataService** (200 lines)
4. **SSRF protection**

### Phase 5D: Translation System (Week 2)

1. **TranslationController** (6 routes)
2. **TranslationService** (427 lines)

### Phase 5E: Real-time Updates (Week 3)

1. **SSE endpoints** (`scan-events`/`admin-events`) — ❌ WebSocket أُسقط
2. **View tracking system** (177 lines)

### Phase 5F: License & Admin Content (Week 3)

1. **LicenseController** (5 routes)
2. **AdminContentController** (3 routes)
3. **SystemController** (1 route)

### Phase 5G: DTO Transformations (Week 4)

1. **MediaTransformer** (115 lines)
2. **Library DTO normalization**
3. **Search DTO normalization**
4. **User sanitization**

### Phase 5H: Database Operations (Week 4)

1. **Backup restore**
2. **Factory reset**
3. **Download backup**

---

## 10. Estimated Impact

| Category                    | Files   | Lines      | Effort      |
| --------------------------- | ------- | ---------- | ----------- |
| Missing Controllers         | 5       | ~950       | 1 week      |
| Missing Services            | 13      | ~3,500     | 2 weeks     |
| Missing Infrastructure      | 5       | ~370       | 1 week      |
| Missing DTO Transformations | 5       | ~250       | 0.5 weeks   |
| Missing Security Features   | 3       | ~100       | 0.5 weeks   |
| Missing Routes              | ~33     | ~500       | 0.5 weeks   |
| **Total**                   | **~64** | **~5,670** | **4 weeks** |

---

## 11. Recommendation

**Do NOT proceed to Phase 5 until:**

1. ✅ This review is complete
2. ✅ Priority order is approved
3. ✅ Resource allocation is confirmed
4. ✅ Phase 5A (Infrastructure) is planned in detail

**Phase 5 should focus on:**

1. Infrastructure first (EventBus, CacheService, RetryManager)
2. Security middleware (rate limiting, maintenance mode)
3. Enrichment system (highest business value)
4. Translation system (high business value)
5. Real-time updates (SSE)
6. License & admin content (lower priority)
7. DTO transformations (data quality)
8. Database operations (backup/restore)

---

## 12. Files to Update

- [ ] `BACKEND_MIGRATION_ANALYSIS.md` — Add Phase 5A-5H details
- [ ] `ARCHITECTURE_RULES.md` — Add controller patterns section
- [ ] `project-tree.md` — Update with new files
