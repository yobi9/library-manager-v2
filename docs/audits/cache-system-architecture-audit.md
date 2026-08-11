# Cache System Architecture Audit

> **Audit Date:** 2026-08-04
> **Auditor:** opencode (AI)
> **Scope:** Full-system analysis — DB layer, backend services, repositories, scanner, auth/middleware, frontend data-fetching — to determine whether a unified cache service is needed, what to cache, and how.
> **Status:** Approved — recommendations implemented in full (Phases 1–7, completed 2026-08-05). See `docs/plans/cache-system-implementation-plan.md` §18 for the implementation record.
> **Constraint:** This audit is RESEARCH ONLY. No code was changed. All recommendations are advisory.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope & Methodology](#2-scope--methodology)
3. [Current Architecture & Data Flow](#3-current-architecture--data-flow)
4. [Existing Caching Landscape](#4-existing-caching-landscape)
5. [Measured Hot Paths & Bottlenecks](#5-measured-hot-paths--bottlenecks)
6. [The Right Questions — Is Cache Even Needed?](#6-the-right-questions--is-cache-even-needed)
7. [Consistency & Invalidation Analysis](#7-consistency--invalidation-analysis)
8. [What Must NOT Be Cached](#8-what-must-not-be-cached)
9. [Comparison of Alternatives](#9-comparison-of-alternatives)
10. [Recommended Architecture](#10-recommended-architecture)
11. [Decisions (ADR-style)](#11-decisions-adr-style)
12. [Risks & Mitigations](#12-risks--mitigations)

---

## 1. Executive Summary

The system has **no server-side caching of any kind** for business data, despite containing a **fully-featured but completely unused** `CacheService` (`src/backend/services/cache-service.ts`, 492 lines: LRU + 3 TTL tiers + stale-while-revalidate + cache warming + memory monitoring + prefix/pattern deletion + stats). It is registered as `services.cache` (`src/backend/services/index.ts:189`) with **zero consumers** across the entire codebase.

Two structural realities shape every recommendation:

1. **Single process, single SQLite connection.** The app is a Next.js monolith on `node-sqlite3` with one connection, WAL mode, and busy-retry (up to 3×). Every HTTP request re-reads the DB. There are **no worker threads and no horizontal scaling** — a process-local in-memory cache is architecturally sufficient. **Redis is not warranted.**

2. **Event bus exists and is rich — but almost nobody listens.** `src/backend/services/event-bus.ts` is a full pub/sub with ~30 distinct events emitted across the app (`media:changed`, `media_updated`, `scan_*`, `settings_updated`, `user_*`), yet **only one listener exists in the entire app**: `AutoBackupScheduler` subscribes to `settings_updated`. The invalidation backbone is already built — it just has no consumers.

**Top 5 cacheable hot spots** (details in §5):

| # | Hot path | Cost today | Cache payoff |
|---|----------|-----------|--------------|
| 1 | `getAllSettings()` on every viewer request | Full settings-table read ×2 (`(viewer)/layout.tsx:18` + `getPublicSettings`) | Very high |
| 2 | `getDashboardStats()` | 6 full-table aggregate queries, called from 3 endpoints incl. `/api/dashboard/live` polling every 30s | Very high |
| 3 | `media-repository.ts` list queries | `LIKE %term%` table scan on the filter endpoint | High |
| 4 | Media detail / recommendations | N+1 — `getMediaById` runs 6+ queries and is re-called per item in recommendations | High |
| 5 | `/api/database` stats | 46 `COUNT` queries per call (`database-repository.ts:34-51`) | Medium |

**Critical infrastructure bug:** `invalidateLibraryCache()` (`media-repository.ts:466-468`) is an **empty no-op**, yet is called after every successful scan (`scan-orchestrator.ts:196`). When a cache is introduced, this is the single natural invalidation hook and it currently does nothing.

**Headline conclusion:** A unified in-memory cache layer IS justified, but it must be **revived around the existing event bus** (not built fresh), deployed **incrementally per hot path**, and paired with **frontend React Query defaults** that are currently absent (`src/providers/index.tsx:12` creates a `QueryClient` with no `defaultOptions`).

---

## 2. Scope & Methodology

**Scope examined (60+ files read in full):**

- **DB layer:** `db.ts`, `schema.ts` (23 tables + FTS5 + triggers), all 24 repositories
- **Services layer:** all 20+ services, event bus, cache service, translation cache
- **API layer:** route helpers (`buildContext`, `toNextResponse`), all 19 route groups
- **Auth/Middleware:** `middleware.ts`, `auth-service`, viewer layout security path
- **Scanner/Jobs:** `scan-orchestrator`, `folder-watcher`, deletion detector, auto-backup scheduler, view event publisher
- **Image/Search:** `image-service` (LRU cache), `search-service` + FTS5, TMDB enrichment, translation
- **Frontend:** `providers/index.tsx`, viewer/admin hooks, SSE hooks, React Query usage patterns

**Not examined:** old project `library-manager77` (excluded by migration rules — behavior reference only, last resort).

**Method:** static analysis + query-pattern tracing. No runtime profiling was performed; cost estimates are derived from query shape (full-table scans, aggregation) and call frequency (poll intervals, per-request reads).

---

## 3. Current Architecture & Data Flow

```
Browser (React Query — no defaultOptions)
   │  fetch (no Cache-Control headers anywhere)
   ▼
Next.js Route Handlers (19 groups)
   │  buildContext → getServices()
   ▼
Controllers → Services → Repositories → SQLite (single connection, WAL)
   ▲
   └── EventBus (~30 events emitted; 1 listener total)
```

### 3.1 Key data-flow facts

- **Every HTTP request** → `getServices()` → singleton services → repository → fresh SQLite read. No `unstable_cache`, no `revalidate`, no HTTP caching headers on any route.
- **Viewer request path** (`(viewer)/layout.tsx:16-52`): 2 settings reads + visitor tracking (2-3 more DB ops) + JWT verify — **all per request**, including static-looking pages.
- **Admin request path** (`middleware.ts:64-68`): internal fetch to `/api/auth/verify-admin` for every `/admin/*` request.
- **SSE channels** already push real-time invalidation pulses: `admin/events` (feeds `mediaVersion` counter in `use-admin-realtime.ts`), `scan-events`.
- **Scan cycle**: large batched writes + FTS5 reindex → `scan:completed` event → calls no-op `invalidateLibraryCache()`.

---

## 4. Existing Caching Landscape

| Cache | Location | Design | Used? | Problems |
|-------|----------|--------|-------|----------|
| `CacheService` (generic) | `services/cache-service.ts` | LRU + 3 TTL tiers + SWR + warming + memory monitor | **NO** — 0 consumers | None functional; design predates current needs; `defaultTTL=300s` too long for realtime-ish data |
| Image LRU | `services/image-service.ts` | TTL 60s, maxSize 1000, inflight map | Yes (Phase 4) | No byte cap, no explicit invalidation, TTL mismatch vs HTTP header |
| Translation cache | `services/translation-cache-service.ts` + repo | DB-backed table, key + TTL | Yes | No max-age GC; DB table grows; no TTL cap in queries |
| TMDB search cache | `services/tmdb-*` | 500-entry in-memory | Yes | Full clear every 5 min (coarse) |
| `ViewTrackerService` | `services/view-service.ts` | memory, 10-min cooldown, 50K cap | Yes | Not a data cache — fine as-is |
| React Query | `providers/index.tsx:12` | bare `new QueryClient()` | Yes (frontend) | **No defaultOptions** — no staleTime/gcTime/retry |
| FTS5 index | DB `media_search` | rebuild in batches of 100 | Yes (search) | See §5.5 |

**Key insight:** the generic `CacheService` was built (presumably in an earlier phase) but never wired. Its API (`withCache`, `deleteByPrefix`, `generateKey`) is exactly what the app needs — reviving it is far cheaper than building fresh.

---

## 5. Measured Hot Paths & Bottlenecks

### 5.1 Settings — read on every viewer request (HIGHEST priority)

- `(viewer)/layout.tsx:18` calls `getAllSettings()` → full table scan, on **every** page request.
- `/api/live-channels/route.ts:22` and `settings-controller.ts:29` do the same.
- `getPublicSettings()` (`settings-service.ts:46-49`) reads all rows then filters public keys.
- **Why:** layout needs only 2 keys (`viewer_access_mode`, `maintenance_mode`) but fetches the entire settings table.
- **Cache answer:** YES — cache the settings map server-side, TTL ~5s + event-driven invalidation on `settings_updated`. The event already fires on every update (`settings-service.ts:69`).

### 5.2 Dashboard stats — 6 aggregate queries × 3 endpoints, polled (HIGHEST priority)

- `getDashboardStats()` (`dashboard-service.ts:20-41`): `COUNT(*)`, `SUM(file_size)`, `SUM(views)`, user count, online count, `GROUP BY type` — all **full-table**.
- Consumed by `/api/dashboard`, `/api/dashboard/summary`, and `/api/dashboard/live` which the admin UI polls **every 30s** (`use-admin-dashboard.ts:201`).
- **Cache answer:** YES — cache the stats object, TTL ~15-30s, invalidate on `media:changed` / `media_updated` / `scan_completed`.

### 5.3 Media list / filter queries — `LIKE %term%` scans

- `media-repository.ts:201-217` filter path uses `LIKE '%term%'` over the full `media_items` table (title/original_title) — no index can serve a leading-wildcard LIKE.
- Admin items-control list and public filter endpoint both hit this.
- **Cache answer:** PARTIAL — the FTS5 `search` path already exists for keyword search; the LIKE path should route to FTS5. For stable filter combos (year/genre/cert), a short-TTL keyed cache helps.

### 5.4 N+1 — media detail & recommendations

- `getMediaById` runs **6+ queries** (media + files + cast + genres + images + related) with an unconditional `console.log` per call.
- Recommendations re-call `getMediaById` **per recommended item** (~13 queries per page).
- **Cache answer:** PARTIAL — per-request memoization (dedupe repeated `getMediaById` within one request) is the primary fix; a short-TTL cache (30-60s) on the assembled detail object is secondary.

### 5.5 Search (FTS5) — 4 queries per keystroke

- Each search = FTS5 `MATCH` + join + phonetic fallback (when 0 rows) + count. Live search fires per keystroke (client-debounced 300ms).
- **No server-side search result cache.**
- **Cache answer:** YES for exact-query results with short TTL (~30s), keyed by normalized query + filters. The phonetic fallback is expensive and should be cached more aggressively.
- **Schema note (documented in search audit):** FTS5 has no UPDATE/DELETE triggers; `phonetic_key` is always inserted as `''`; scanner never calls `addToIndex` → new items aren't phonetically searchable. Cache must not mask these bugs — the plan separates cache from schema fixes.

### 5.6 `/api/database` — 46 COUNT queries

- `database-repository.ts:34-51` loops over every table name issuing `SELECT COUNT(*)`. Called per `/api/database` request.
- **Cache answer:** YES — TTL 30-60s + invalidate on schema-touching writes (scan). Low risk.

### 5.7 Admin lists / processes — polling

- `use-admin-processes.ts:71` polls every 10s; `use-admin-events-history.ts:58` every 15s; dashboard live every 30s.
- These are **freshness-sensitive** — do NOT cache server-side; the SSE pulse already covers admin.

---

## 6. The Right Questions — Is Cache Even Needed?

Honest per-case analysis (staff-level scrutiny — cache is not a default answer):

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Is SQLite the bottleneck? | Mostly **read amplification**, not write contention | Single connection + WAL; repeated full-table reads on hot paths amplify each request's cost and busy-retry pressure |
| Is the problem design, not performance? | Mixed | Settings layout read (design), dashboard N+1 aggregates (design), search LIKE-scan (design), 46 COUNTs (design). Cache fixes symptoms; some need **query/design fixes first** |
| Will cache add more complexity than it removes? | No, if built on existing pieces | `CacheService` + event bus already exist; the plan wires them rather than inventing infra |
| Are there correctness hazards? | Yes, but controllable | Freshness-sensitive admin data and visitor/security writes must never be cached; everything else tolerates seconds of staleness |
| Should we build Redis? | **No** | Single process, no workers, no multi-instance; a process-local LRU is sufficient and simpler |

**Conclusion:** A unified cache is justified **for read-heavy, low-freshness data**, not as a blanket. ~70% of the value comes from 3 integrations (settings, dashboard, React Query defaults). The rest is incremental.

---

## 7. Consistency & Invalidation Analysis

### 7.1 The invalidation backbone already exists

- `EventBus` emits (~30 events): `media:changed`, `media_updated`, `media_deleted`, `scan_started/completed/failed`, `settings_updated`, `user_updated`, `cache_*`, etc.
- **Missing:** a listener that maps these events to cache prefix deletions.
- `settings_updated` already fires on every settings change (`settings-service.ts:69`).
- Scan completion already fires `scan:completed` (`services/index.ts:132`) **and** calls `invalidateLibraryCache()` — but that function is a no-op.

### 7.2 Required wiring (event → cache prefix)

| Event | Invalidate prefixes | Freshness impact |
|-------|--------------------|------------------|
| `settings_updated` | `settings:*` | Instant settings propagation |
| `media:changed` / `media_updated` / `media_deleted` | `media:*`, `media-detail:*`, `recommendations:*`, `dashboard:*`, `catalog:*` | Lists, detail, dashboard |
| `scan_completed` | `media:*`, `dashboard:*`, `catalog:*`, `database:*` | After reindex |
| `user_updated` | `users:*` | Admin user lists |
| `translation_cache_cleared` | `translations:*` | Translation refresh |

### 7.3 Version-based vs event-based invalidation

- **Recommended: event-based (prefix deletion).** Deterministic, instant, no epoch bookkeeping.
- **Rejected: global `mediaVersion` epoch** (the counter in `use-admin-realtime.ts:76,95-103`). It exists client-side for SSE-driven refetch; promoting it to a server-side cache epoch adds cross-cutting complexity for no benefit at single-process scale.

### 7.4 TTL strategy (3 tiers, matching existing `CacheService`)

| Tier | TTL | Applies to | Rationale |
|------|-----|-----------|-----------|
| Short | 5-15s | settings, search results, database stats | Near-real-time but too costly to recompute |
| Medium | 30-60s | dashboard, media-detail, filtered lists | User-tolerable staleness; event invalidation tightens it |
| Long | 10-15min | catalog taxonomies (genres/years/certs), public settings envelope | Static data; event invalidation covers changes |

---

## 8. What Must NOT Be Cached

| Data | Why not |
|------|---------|
| `visitor_events` / security writes | Audit integrity; must persist immediately |
| Session termination / `logout` | Security: revocation must be instant |
| JWT verification results | Cheap op; caching it risks stale-auth states. Exception: HMAC key — already in-process, not a cache concern |
| `maintenance_mode` / `viewer_access_mode` | Security gate — but see note: a 5s settings cache is acceptable because `settings_updated` invalidates it; do NOT use a long TTL here |
| View counters / `view_tracker` | Already memory-batched by design; cache would double-count |
| Scan progress / current activity | Live state — pushed via SSE |
| `fs.stat` / file existence | Files change under scanner's watch; cache would go stale silently |
| Video stream ranges / files | Range requests must pass through untouched |
| Approval `details_json` | Written once, read once in admin workflow — caching adds no value |

---

## 9. Comparison of Alternatives

| Alternative | Verdict | Rationale |
|-------------|---------|-----------|
| **Redis / external KV** | ✗ Reject | Single process; adds deployment, ops, serialization cost; no horizontal scaling to justify it |
| **HTTP `Cache-Control` headers on APIs** | △ Conditional | Useful for *public* viewer endpoints in `public` access mode; must be avoided when protected. Browser cache adds a free layer but complicates auth-mode handling. Defer to later phase |
| **React Query defaultOptions** | ✓ Adopt | Zero backend risk; kills duplicate fetches; the missing piece in `providers/index.tsx:12` |
| **`unstable_cache` / Next.js data cache** | △ Review | Next.js version pins behavior; for server components. Current app reads most data client-side via React Query → limited applicability |
| **In-memory singleton `CacheService` (revive)** | ✓ Adopt | Already built, already registered; matches single-process architecture; event bus gives free invalidation |
| **DB materialization (denormalized counters / stats table)** | △ Defer | Better long-term for dashboard, but schema migration + write-path complexity; cache first, revisit if still slow |

---

## 10. Recommended Architecture

```
                 ┌────────────────────────────────────────────┐
                 │            FRONTEND (browser)              │
                 │  React Query defaultOptions (staleTime/     │
                 │    gcTime/retry) — dedupe client fetches    │
                 └──────────────────┬─────────────────────────┘
                                    │ fetch (no cache headers yet)
                 ┌──────────────────▼─────────────────────────┐
                 │            ROUTE HANDLERS (Next.js)        │
                 │  getServices() → buildContext()            │
                 └──────────────────┬─────────────────────────┘
                 ┌──────────────────▼─────────────────────────┐
                 │           SERVICES LAYER                   │
                 │  Hot methods wrapped in cache.withCache(): │
                 │   • getAllSettings()          short TTL    │
                 │   • getDashboardStats()       medium TTL   │
                 │   • getMediaById/detail       medium TTL   │
                 │   • search results            short TTL    │
                 │   • database counts           short TTL    │
                 └──────────────────┬─────────────────────────┘
                 ┌──────────────────▼─────────────────────────┐
                 │   CACHE SERVICE (revived, singleton)       │
                 │   LRU + 3 TTL tiers + SWR + stats          │
                 └───────────────┬─────────────────▲─────────┘
                                 │ reads           │ invalidate (deleteByPrefix)
                 ┌───────────────▼─────────────────┴─────────┐
                 │           EVENT BUS (~30 events)          │
                 │   media:* / settings_updated / scan_* /   │
                 │   user_*  →  CacheInvalidator listener    │
                 └───────────────────────────────────────────┘
```

### 10.1 The `CacheInvalidator` — the one missing piece

A small service (not a new library) that subscribes once at `getServices()` boot (`services/index.ts`) and maps events → `cacheService.deleteByPrefix(...)`. Estimated ~40 lines. This is the keystone that turns the dead `CacheService` into a coherent system.

### 10.2 Wiring rule

Cache wrapping lives at the **service boundary**, not in repositories (repos are the source of truth; services own caching policy). Wrapping points:

```ts
// settings-service.ts — pattern
async getAllSettings(): Promise<Record<string, unknown>> {
  return getServices().cache.withCache("settings", {}, () => this.settingsRepo.getAllSettings(), TTL_SHORT);
}
```

`withCache` already provides stale-while-revalidate fallback when a refresh throws.

---

## 11. Decisions (ADR-style)

All approved 2026-08-05. D11/D12 were added during implementation.

| # | Decision | Status |
|---|----------|--------|
| D1 | Revive existing `CacheService`; do NOT build a new cache | ✅ Approved |
| D2 | Invalidation = event-bus prefix deletion via a new `CacheInvalidator`; reject version-epoch | ✅ Approved |
| D3 | No Redis; process-local in-memory only | ✅ Approved |
| D4 | Cache wrapping at service boundary (never in repositories) | ✅ Approved |
| D5 | React Query global defaultOptions added to `providers/index.tsx` | ✅ Approved |
| D6 | Cache only read-heavy low-freshness data; never audit/security/visitor writes (§8) | ✅ Approved |
| D7 | Fix `invalidateLibraryCache` no-op → emit/delete via cache invalidator (instead of a dead call) | ✅ Approved |
| D8 | Do NOT add HTTP cache headers in the same change; evaluate separately (public mode only) | ✅ Approved — implemented as Phase 7 |
| D9 | Search/schema bugs (FTS5 triggers, phonetic_key) fixed in the same plan as search caching, but as distinct work items | ✅ Approved — implemented as Phase 5 |
| D10 | Dashboard recompute: cache first; DB-materialized counters deferred pending measurement | ✅ Approved |
| D11 | `CacheService` injected via constructor into every consuming service (DI only; no `getServices()` back-references) | ✅ Approved (added during implementation) |
| D12 | `CachePrefixes` constants centralized in `cache-service.ts` (`as const`) and reused app-wide | ✅ Approved (added during implementation) |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Stale settings gate (`maintenance_mode`, access mode) | Short TTL (5s) + immediate `settings_updated` invalidation; never long-TTL security data |
| Cache hides underlying query bugs | Plan fixes root causes (FTS5, LIKE-scan, N+1) in parallel; cache is layered on top, not a substitute |
| Memory growth | `CacheService` already has maxSize LRU (5000) + memory monitor + cleanup interval; lower `defaultTTL` to app-appropriate 15-30s |
| Warm vs cold start | SWR via `withCache`; empty cache on boot = cold reads only, no correctness impact |
| Double-buffering (SSE vs cached REST) | Admin freshness comes from SSE/polling — admin data is NOT server-cached; only public/viewer data is |
| Translation cache table growth | Existing translation service owns its TTL; keep as-is, add max-age GC as separate item |
| Next.js dev/prod behavior | Cache is process-local JS — identical in dev and prod; no build-pipeline coupling |

---

*End of audit. Companion document: `docs/plans/cache-system-implementation-plan.md`.*
