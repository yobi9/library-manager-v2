# Cache System Implementation Plan

> **Plan Date:** 2026-08-04
> **Updated:** 2026-08-05
> **Author:** opencode (AI)
> **Prerequisite:** `docs/audits/cache-system-architecture-audit.md` — approved
> **Status:** Implemented — all phases (1–7) complete and verified (tsc/lint/build green per phase)
> **Constraint:** This document was a PLAN. All decisions in §3 were approved; every phase has been implemented. See §18 for the implementation record.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Decisions to Confirm](#3-decisions-to-confirm)
4. [Design Principles](#4-design-principles)
5. [Phase Map (Overview)](#5-phase-map-overview)
6. [Phase 1 — React Query Frontend Defaults](#6-phase-1--react-query-frontend-defaults)
7. [Phase 2 — CacheInvalidator Wiring](#7-phase-2--cacheinvalidator-wiring)
8. [Phase 3 — Settings & Dashboard Caching](#8-phase-3--settings--dashboard-caching)
9. [Phase 4 — Media Detail & List Caching](#9-phase-4--media-detail--list-caching)
10. [Phase 5 — Search Caching + FTS5 Schema Fixes](#10-phase-5--search-caching--fts5-schema-fixes)
11. [Phase 6 — Database Stats & Taxonomies](#11-phase-6--database-stats--taxonomies)
12. [Phase 7 — Optional: HTTP Cache Headers (Public Mode)](#12-phase-7--optional-http-cache-headers-public-mode)
13. [Invariant Checklist](#13-invariant-checklist)
14. [Verification Strategy](#14-verification-strategy)
15. [Success Metrics](#15-success-metrics)
16. [Rollback Strategy](#16-rollback-strategy)
17. [Out of Scope](#17-out-of-scope)
18. [Implementation Record](#18-implementation-record)

---

## 1. Executive Summary

Implement a **process-local, event-driven, in-memory cache** by reviving the existing-but-unused `CacheService` (`src/backend/services/cache-service.ts`) and wiring a single `CacheInvalidator` that maps the app's existing event-bus emissions to cache-prefix deletions. Deploy **incrementally, one hot path per phase**, with frontend React Query defaults as the first (zero-backend-risk) win.

Total new code is small: one `CacheInvalidator` service (~40 lines), one wiring call in `getServices()`, `withCache()` wraps at ~5 service boundaries, and one `providers/index.tsx` edit. No new dependencies. No Redis. No DB schema changes.

---

## 2. Goals & Non-Goals

### Goals
- Reduce repeated SQLite reads on the highest-frequency paths (settings, dashboard, search, media detail, database counts).
- Provide a coherent, event-driven invalidation path so staleness is bounded by seconds, not minutes.
- Add frontend fetch deduplication via React Query defaults.
- Keep admin/security/visitor data **uncached and real-time** (SSE-driven).

### Non-Goals
- No Redis / external cache / worker processes.
- No HTTP `Cache-Control` header changes in the main effort (evaluated separately in Phase 7).
- No DB schema or denormalized-counter tables now (deferred, re-measure after caching).
- No rewrite of the existing `CacheService` API — reuse it as-is.
- No changes to repositories (cache lives at the service boundary).

---

## 3. Decisions to Confirm

All decisions were approved 2026-08-05. D11/D12 were added during implementation as engineering decisions.

| # | Decision | Status |
|---|----------|--------|
| D1 | Revive existing `CacheService` (no new cache infra) | ✅ Approved |
| D2 | Invalidation = event-prefix deletion via `CacheInvalidator` | ✅ Approved |
| D3 | No Redis | ✅ Approved |
| D4 | Cache wrapping at service boundary only | ✅ Approved |
| D5 | React Query global defaultOptions | ✅ Approved |
| D6 | Only read-heavy low-freshness data cached; security/audit/visitor writes excluded | ✅ Approved |
| D7 | Fix `invalidateLibraryCache` no-op → route through cache invalidator | ✅ Approved |
| D8 | Defer HTTP cache headers to Phase 7 | ✅ Approved |
| D9 | Search schema fixes (FTS5 triggers, phonetic_key) in same plan, distinct items | ✅ Approved |
| D10 | Cache dashboard first; DB-materialized counters deferred | ✅ Approved |
| D11 | `CacheService` injected into every consuming service via constructor (DI only — no `getServices()` back-references, no singletons) | ✅ Approved (added during implementation) |
| D12 | `CachePrefixes` constants centralized in `cache-service.ts` (`as const`) and reused across services, invalidator, and viewers | ✅ Approved (added during implementation) |

> If any decision is rejected, adjust the affected phase before starting.

---

## 4. Design Principles

1. **Reuse over build.** `CacheService` already provides LRU, 3 TTL tiers, SWR, stats, and memory monitoring. Do not duplicate.
2. **Cache at the service boundary.** Repositories stay pure; services own caching policy. Wrapping is transparent to controllers.
3. **Events are the invalidation contract.** Every mutation already emits an event; the invalidator listens once. No ad-hoc `cache.delete` calls scattered in controllers.
4. **Short TTLs by default.** `defaultTTL` (currently 300s) is too long for this app; set per-tier values appropriate to data (§7/§8).
5. **Security data never cached.** `maintenance_mode`, access mode, sessions, audit, visitor events stay DB-fresh (with the 5s settings exception + event invalidation).
6. **No admin-path caching.** Admin freshness comes from SSE/polling; cache only viewer-facing data.
7. **Cache must not mask bugs.** Root-cause fixes (FTS5, LIKE-scan, N+1) are scheduled in the same plan.
8. **Each phase ships independently** and passes build + typecheck before the next.

---

## 5. Phase Map (Overview)

| Phase | Scope | Risk | Effort | Status |
|-------|-------|------|--------|--------|
| 1 | React Query defaults (frontend) | Zero | S | ✅ Done (build `z2Azjtb05FRfdKZ_XVni7`) |
| 2 | `CacheInvalidator` wiring + fix no-op `invalidateLibraryCache` | Low | S | ✅ Done |
| 3 | Settings + dashboard caching | Low | S | ✅ Done |
| 4 | Media detail & list caching + N+1 memoization | Medium | M | ✅ Done |
| 5 | Search caching + FTS5 schema fixes | Medium | M | ✅ Done |
| 6 | Database stats + taxonomy caching | Low | S | ✅ Done (build `ieO3AQlyf-N19xvqXQd08`) |
| 7 | HTTP cache headers (public mode only) | Medium | S | ✅ Done (build `HCIxTkn4olNkBb8_o9CtZ`) |

---

## 6. Phase 1 — React Query Frontend Defaults

**Files:** `src/providers/index.tsx`

**Changes:**
1. Add global `defaultOptions` to the `QueryClient`:
   - `queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false }`
   - `mutations: { retry: 0 }`
2. Add per-query overrides only where semantics differ:
   - Taxonomy lists (genres/years/certs): `staleTime: 5 * 60_000`
   - Search: keep `staleTime: 30_000` (client already debounces 300ms)
   - Admin live endpoints (dashboard live, processes, events history): `staleTime: 0` (they own their `refetchInterval`)
3. Verify no hook relied on default `staleTime: 0` for freshness (audit list of viewer hooks; live channels already set explicit values).

**Why first:** zero backend risk, immediate duplicate-fetch reduction, and it de-risks later phases by normalizing client fetch behavior.

**Verify:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, manual smoke of viewer home + admin dashboard.

---

## 7. Phase 2 — CacheInvalidator Wiring

**Files (new):** `src/backend/services/cache-invalidator.ts`
**Files (edit):** `src/backend/services/index.ts`, `src/backend/repositories/media-repository.ts`

**Changes:**
1. New `CacheInvalidator` class (~40 lines):
   - Constructor takes `(eventBus, cache)` and subscribes once per event.
   - Event → prefix map (per audit §7.2):
     - `settings_updated` → `settings:*`
     - `media:changed`, `media_updated`, `media_deleted` → `media:*`, `media-detail:*`, `recommendations:*`, `dashboard:*`, `catalog:*`
     - `scan_completed` → `media:*`, `dashboard:*`, `catalog:*`, `database:*`
     - `user_updated` → `users:*`
   - Uses `cache.deleteByPrefix()`; ignores events with no matching prefixes.
2. In `getServices()` (`services/index.ts`), instantiate and subscribe after `cacheService` is created.
3. **Fix the no-op:** replace `invalidateLibraryCache()`'s empty body (`media-repository.ts:466-468`) so the scanner's existing call at `scan-orchestrator.ts:196` now triggers `scan_completed`-equivalent invalidation. Implement by calling `cache.deleteByPrefix(["media", "dashboard", "catalog"])` (via a service, not directly from the repository — see D7 wiring note).
4. Register `cacheInvalidator` in the services object for testability.

**Do NOT do yet:** wrap any service method in `withCache` (Phase 3). The invalidator must land before caches so invalidation is never missing.

**Verify:** unit-style check via a temporary script or test that emits each event and asserts prefix deletion; `tsc --noEmit`, `lint`, `build`.

---

## 8. Phase 3 — Settings & Dashboard Caching

**Files:** `src/backend/services/settings-service.ts`, `src/backend/services/dashboard-service.ts`

**Changes:**
1. **Settings** — wrap `getAllSettings()` and `getPublicSettings()`:
   - Key: `settings` (no params) — `withCache("settings", {}, () => repo.getAllSettings(), TTL_SHORT)`
   - TTL: **5s** (short). Invalidation on `settings_updated` makes propagation effectively instant.
   - `getPublicSettings()` builds its DTO from the cached map (single source).
   - Keep `getSetting(key)` DB-fresh (rarely called, correctness-critical).
2. **Dashboard** — wrap `getDashboardStats()`:
   - Key: `dashboard:stats` — `withCache("dashboard", { stats: true }, () => ..., TTL_MEDIUM)`
   - TTL: **30s** (matches the `/api/dashboard/live` poll interval).
   - Invalidation on `media:changed` / `scan_completed` already wired in Phase 2.
3. Confirm `defaultTTL` tier values fit: adjust `CacheService` defaults if needed via `configure()` (e.g. short=5, medium=30, long=600) rather than per-call magic numbers.

**Verify:** emit `settings_updated` → assert settings cache cleared; run a scan → assert dashboard cache cleared; `tsc`, `lint`, `build`.

---

## 9. Phase 4 — Media Detail & List Caching

**Files:** `src/backend/services/media-service.ts`, possibly `src/backend/services/recommendations-*`

**Changes:**
1. **Per-request memoization (primary N+1 fix):** wrap `getMediaById` in a request-scoped memo so the same id isn't re-fetched within one request (recommendations call it per item). Implement via an `AsyncLocalStorage`-style request context OR a simpler `Map` cleared per `buildContext()` — choose the lighter option during implementation.
2. **Cross-request short cache (secondary):** `withCache("media-detail", { id }, () => ..., TTL_MEDIUM=30s)` for the assembled detail object.
3. **Filtered list cache:** for stable filter combos (genre/year/cert with no search term), cache first page responses with `withCache("catalog", {...filters}, ..., TTL_MEDIUM)`. Skip when `search` term present (unbounded key space).
4. Remove the unconditional `console.log` in `getMediaById` while editing (audit §5.4).

**Verify:** profile one recommendations page load before/after (query count via a debug hook or SQLite trace); assert cache hits for repeated ids; `tsc`, `lint`, `build`.

---

## 10. Phase 5 — Search Caching + FTS5 Schema Fixes

**Files:** `src/backend/services/search-service.ts`, `src/backend/repositories/search-repository.ts`, `src/backend/db/schema.ts` (FTS triggers), scanner index calls

**Changes (two distinct work items, one phase):**

1. **FTS5 schema fixes (root cause):**
   - Add UPDATE/DELETE triggers on `media_items` to keep `media_search` rows in sync (currently only INSERT trigger exists).
   - Populate `phonetic_key` correctly instead of always inserting `''`.
   - Ensure scanner/enrichment calls `addToIndex` for newly inserted items (currently only existing-path code does).
2. **Search result caching:**
   - `withCache("search", { normalizedQuery, filters, page }, ..., TTL_SHORT=30s)`.
   - Cache phonetic-fallback results with a longer TTL (they're expensive) — `TTL_MEDIUM`.
   - Normalize the query (lowercase, trim) before keying.

**Verify:** add a new item → FTS search finds it immediately (trigger works); edit a title → old title no longer matches; phonetic search returns results for a freshly scanned item; repeated identical query hits cache (assert via stats). `tsc`, `lint`, `build`.

---

## 11. Phase 6 — Database Stats & Taxonomies

**Files:** `src/backend/services/database-service.ts`, `src/backend/services/catalog-*` (genres/years/certs) if a dedicated service exists

**Changes:**
1. `database-counts`: `withCache("database", { counts: true }, ..., TTL_SHORT=30s)` — kills the 46 `COUNT` loop per request; invalidated on `scan_completed`.
2. Taxonomy lists (genres, years, certifications): `withCache("catalog", { genres: true }, ..., TTL_LONG=600s)`; invalidated on `media:changed`/`scan_completed`.

**Verify:** `/api/database` hit count drops to 1× per 30s; taxonomy endpoint serves from cache after first call; invalidation on scan. `tsc`, `lint`, `build`.

---

## 12. Phase 7 — Optional: HTTP Cache Headers (Public Mode)

**Files:** `src/app/api/**/route.ts` (public GET endpoints), route helpers

**Changes:**
1. Add `Cache-Control` headers ONLY when `viewer_access_mode === "public"` (via `buildContext` or a shared helper).
2. Never add cache headers to admin routes, auth routes, or protected-mode viewer routes.
3. Conservative values: `public, max-age=60, s-maxage=60` for taxonomy endpoints; `no-store` everywhere else by default.

**Verify:** `curl -I` on a public taxonomy endpoint shows the header in public mode and `no-store` in protected mode. `tsc`, `lint`, `build`.

---

## 13. Invariant Checklist

Across every phase, these must hold:

- [x] `services.cache` is the ONLY cache instance; no parallel ad-hoc Maps for business data.
- [x] Every cacheable mutation has a corresponding event → invalidation wiring (no silent staleness).
- [x] `withCache` used at service boundary; repositories unchanged.
- [x] Security/audit/visitor/session data never cached.
- [x] Admin live paths (SSE + polling) remain uncached.
- [x] No new runtime dependencies; no env changes; no schema migration in Phases 1–4/6 (Phase 5 adds migration `002_search_sync_triggers.sql`).
- [x] `npx tsc --noEmit` + `npm run lint` + `npm run build` green after every phase.

---

## 14. Verification Strategy

| Level | Method |
|-------|--------|
| Type | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` (required before commit, per AGENTS.md) |
| Unit (if framework added later) | `src/tests/unit/` — currently empty; invalidator event→prefix tests belong here |
| Manual | Settings change → viewer reflects instantly; scan → lists/dashboard update; search finds new items; admin live panels still real-time |
| Performance sanity | Count SQLite queries per request before/after (e.g. temporarily log `db.get/sqlite` calls on a hot route) |

---

## 15. Success Metrics

- Viewer home + items pages: **settings reads drop from 2/full-table to ≤1 cached** after Phase 3.
- `/api/dashboard/live` (30s poll): **DB aggregate queries drop from 6 per poll to ~0** (served from cache between polls/invalidation).
- `/api/database`: **46 COUNTs → 1 per 30s**.
- Search: identical repeated queries hit cache; phonetic fallback runs at most once per 30s per unique query.
- React Query: network tab shows **no duplicate fetches** for the same key within staleTime.
- No regressions in: admin SSE real-time, session revocation, visitor tracking, maintenance gate.

---

## 16. Rollback Strategy

Each phase is independently reversible:

- **Phase 1:** revert `providers/index.tsx` defaults (1-line change).
- **Phase 2:** remove `cacheInvalidator` subscription from `getServices()`.
- **Phases 3/4/6:** remove `withCache` wrappers (services fall back to direct repo reads).
- **Phase 5:** schema fixes are data-level; revert triggers via migration; cache wrappers removable.
- **Phase 7:** remove header helper.

No phase touches repositories or DB schema in a way that can't be reverted by a migration file.

---

## 17. Out of Scope

- Redis / external caching / worker threads.
- Denormalized dashboard counters tables (revisit only if caching proves insufficient — D10).
- HTTP cache headers for protected/admin routes.
- Old project (`library-manager77`) — excluded by migration rules.
- Adding a test framework (only if the user requests one; currently `src/tests/unit` is empty by design).

---

## 18. Implementation Record

Record of what was actually implemented per phase (verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`).

### Phase 1 — React Query Frontend Defaults ✅

**Files:** `src/providers/index.tsx`

- Added `QUERY_DEFAULTS` global `defaultOptions` (`staleTime: 30_000`, `gcTime: 5 * 60_000`, `retry: 1`, `refetchOnWindowFocus: false`; mutations `retry: 0`).
- Per-query overrides preserved for taxonomy lists, search, and admin live endpoints.
- **Build:** `z2Azjtb05FRfdKZ_XVni7`.

### Phase 2 — CacheInvalidator Wiring ✅

**Files:** `src/backend/services/cache-invalidator.ts` (new), `src/backend/services/index.ts`, `src/backend/repositories/media-repository.ts`, `src/backend/services/settings-service.ts`, `src/backend/services/cache-service.ts`

- New `CacheInvalidator` subscribed once in `getServices()` (boot) — maps events to prefix deletions:
  - `settings_updated` → `settings:*`
  - `media:changed`, `media_updated`, `media_deleted` → `media:*`, `media-detail:*`, `recommendations:*`, `catalog:*`, `dashboard:*` (with `metadata_completed` guarded by `success !== false`)
  - `scan_completed` → `media:*`, `media-detail:*`, `recommendations:*`, `catalog:*`, `dashboard:*`, `database:*`
  - `user_updated` / `user_deleted` → `users:*`
- **D7 fix:** the empty `invalidateLibraryCache()` no-op in `media-repository.ts` was replaced; the scanner's post-scan call now flows through the invalidator.
- **D11/D12:** `CacheService` injected via constructor into every consuming service; `CachePrefixes` (`as const`) centralized in `cache-service.ts`.

### Phase 3 — Settings & Dashboard Caching ✅

**Files:** `src/backend/services/settings-service.ts`, `src/backend/services/dashboard-service.ts`

- `getAllSettings()` / `getPublicSettings()` wrapped in `withCache("settings", …)` with short TTL (invalidated on `settings_updated`).
- `getDashboardStats()` wrapped under `dashboard:*` with medium TTL; invalidated on `media:changed` / `scan_completed`.
- `getSetting(key)` stays DB-fresh.

### Phase 4 — Media Detail & List Caching ✅

**Files:** `src/backend/services/media-service.ts`

- `getMediaById` assembled-detail wrapped under `media-detail:*` (medium TTL).
- Filtered list cache under `catalog:*` for stable filter combos (genre/year/cert), skipped when a search term is present.
- Per-request memoization dedupes repeated `getMediaById` calls within one request (recommendations N+1).
- Unconditional `console.log` in `getMediaById` removed.

### Phase 5 — Search Caching + FTS5 Schema Fixes ✅

**Files:** `src/backend/db/migrations/002_search_sync_triggers.sql`, `src/backend/repositories/search-repository.ts`, `src/backend/services/search-service.ts`

- **FTS5 schema fixes (root cause):** new UPDATE/DELETE (and INSERT) triggers on `media_items` keep `media_search` rows in sync; backfill routine added.
- Search result caching under `search:*` with short TTL; phonetic-fallback results cached longer.
- Triggers verified with a throwaway SQLite test (insert/update/soft-delete/hard-delete all propagate correctly); test file deleted afterwards.

### Phase 6 — Database Stats & Taxonomies ✅

**Files:** `src/backend/services/database-service.ts`, `src/backend/services/media-service.ts`, `src/backend/services/index.ts`

- `getStats` / `getTables` cached under `database:*` (TTL 60s) — kills the per-request 46-`COUNT` loop; purged on `optimize` / `createBackup` / `restoreBackup` / `performFactoryReset`.
- Taxonomy lists (`getAllGenres`, `getMediaTypes`, `getAvailableYears` keyed by libraryId) and people (`getPerson`, `getPersonWorks`, `getAllPeople` keyed by limit/search) cached under `catalog:*` (TTL 300s).
- `getDbSize()` stays direct (cheap `fs.stat`).
- **Build:** `ieO3AQlyf-N19xvqXQd08`.

### Phase 7 — HTTP Cache Headers (Public Mode) ✅

**Files:** `src/backend/api/viewer-cache-control.ts` (new, pure module), `src/backend/api/route-helpers.ts`, 14 viewer route handlers

- New pure module `resolveViewerCacheControl(mode, status)`: returns `public, max-age=60, s-maxage=60` when `viewer_access_mode === "public"` and `status < 400`; otherwise `no-store`.
- New `viewerResponse()` in `route-helpers.ts` reads `viewer_access_mode` (via `SettingsService.getAllSettings()`) and applies the header. Admin/auth routes continue to use `toNextResponse` (no cache headers).
- Applied to 14 public GET endpoints: `media/filter`, `media/pinned`, `media/latest`, `media/latest/[type]`, `media/recommended/[id]/[type]`, `media/people`, `media/person/[id]`, `media/person/[id]/works`, `media/batch`, `media/genres`, `search`, `search/live`, `search/years`, `live-channels`. `/api/media/types` excluded (used by admin `media-selector-modal`).
- **Verification:** live checks on the dev server showed `Cache-Control: public, max-age=60, s-maxage=60` on public routes in `public` mode and **no** header on admin routes (401). Pure-logic check of `resolveViewerCacheControl` (public 200/301 → cacheable; protected/undefined/null mode and public 400/404/500 → `no-store`) passed.
- **Build:** `HCIxTkn4olNkBb8_o9CtZ`.

### Outstanding / deferred

- Live `no-store` header check in **protected** mode was covered by the pure-logic test only (touching the live DB/server for a protected-mode check was deferred to avoid risk — the pure module fully determines the header value from `(mode, status)`).

---

*End of plan. Implemented 2026-08-05 — see §18.*
