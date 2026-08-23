# Comprehensive Project Audit — Library Manager V2

> **Audit Date:** 2026-08-17
> **Auditor:** opencode (AI)
> **Scope:** Full-stack architecture, security, database performance, test coverage, code quality, and dependency hygiene — every verified finding is traced to specific file and line number.
> **Status:** Complete — all findings verified against source code. **No code was changed.**
> **Baseline:** `typecheck` ✅ | `lint` ✅ | `test` ✅ 128/128 (26 files) | `build` ✅ (last known)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Metrics (Verified)](#2-project-metrics-verified)
3. [Architecture Assessment](#3-architecture-assessment)
4. [Security Audit](#4-security-audit)
5. [Database & Performance](#5-database--performance)
6. [Test Coverage](#6-test-coverage)
7. [Code Quality & Dead Code](#7-code-quality--dead-code)
8. [Dependency Hygiene](#8-dependency-hygiene)
9. [Consolidated Findings Table](#9-consolidated-findings-table)
10. [Prioritized Remediation Plan](#10-prioritized-remediation-plan)

---

## 1. Executive Summary

Library Manager V2 is a **well-architected monolithic Next.js 16.2 application** with a sophisticated SQLite dual-connection model, comprehensive security headers, and a mature DI pattern. The architecture is fundamentally sound — there are no high-severity vulnerabilities or catastrophic design flaws.

The issues found are predominantly **medium-to-low severity**: dead code accumulation, missing test coverage, latent SQL injection risks (currently unreachable), N+1 query patterns, and configuration mismatches. The codebase would benefit most from a systematic cleanup pass and targeted test additions rather than architectural changes.

### Key Statistics

| Category | Finding |
|---|---|
| **Critical vulnerabilities** | 0 |
| **High severity** | 2 (CSP header absent, N+1 in genre updates during scans) |
| **Medium severity** | 8 |
| **Low severity** | 12+ |
| **Dead code methods** | 6 (paginateAll, paginateByField, beginTransaction, commit, rollback, MediaRepository.searchMedia) |
| **Dead code config** | CacheService.configure() — defined, never called |
| **Test coverage** | ~13% services, ~4% controllers, 0% frontend |

---

## 2. Project Metrics (Verified)

| Metric | Count | Verification Method |
|---|---|---|
| TypeScript files (.ts) | 329 | PowerShell `Get-ChildItem -Recurse -Filter *.ts` |
| TSX component files (.tsx) | 177 | PowerShell `Get-ChildItem -Recurse -Filter *.tsx` |
| **Total source files** | **506** | — |
| API route handlers | ~130 | `src/app/api/` tree |
| Page routes | 42 | `src/app/` tree (viewer + admin + auth) |
| Database tables | 24 | 23 in migration 001 + 1 in migration 011 |
| Database indexes | 86 | 84 in migration 001 + 1 in 009 + 1 in 013 |
| Backend controllers | 24 | `src/backend/controllers/` |
| Backend services | 38 | `src/backend/services/` |
| Backend repositories | 24 | `src/backend/repositories/` |
| Shared UI components (shadcn) | 33 | `src/shared/components/ui/` |
| Admin pages | 21 | `src/features/admin/pages/` |
| Viewer pages | 14 | `src/features/viewer/pages/` |
| Admin hooks | 21 | `src/features/admin/hooks/` |
| Unit test files | 26 | `src/tests/unit/` |
| Frontend test files | 0 | Grep confirmed |

---

## 3. Architecture Assessment

### 3.1 Backend Layering — Excellent

The 4-layer architecture (Route Handlers → Controllers → Services → Repositories → SQLite) is strictly enforced:

- **No SQL in services** — verified across all 38 service files.
- **No repository calls from route handlers** — all 130 route handlers delegate to controllers.
- **DI via `globalThis` singletons** — HMR-safe, properly wired through `getServices()` and `getControllers()`.
- **Per-handler auth** — `parseAuthFromRequest` / `requireAuth` / `requireAdmin` in every route handler.

**Verdict: Strong architecture. No changes needed.**

### 3.2 Database Layer — Sophisticated & Well-Designed

The dual-connection model with `AsyncLocalStorage` writer context is a standout feature:

| Feature | Implementation | Assessment |
|---|---|---|
| WAL mode | `journal_mode=WAL`, `synchronous=NORMAL` | Correct for concurrent read/write |
| Writer separation | `runInWriterContext()` via `AsyncLocalStorage` | Elegant, prevents reader starvation |
| SQLITE_BUSY retry | 3 attempts, exponential backoff (100ms → 400ms) | Production-grade |
| Savepoint serialization | `withExclusiveTransaction()` FIFO queue | Prevents savepoint stack corruption |
| Client write fail-fast | `withClientWriteFailFast()` reduces timeout to 200ms during scan | Prevents HTTP hangs |
| Diagnostic tracking | `inflightStatements` + `openTransactions` maps | Excellent observability |

**Verdict: Production-grade database layer. No architectural changes needed.**

### 3.3 Proxy & Auth — Solid

- **Proxy** (`src/proxy.ts`): Protects `/admin/*` via fetch to `/api/auth/verify-admin`. Deny-on-failure. Never touches DB.
- **Viewer layout**: Server Component reads `viewer_access_mode` from DB, redirects if protected.
- **JWT**: 2-hour expiry, bcrypt cost 10, lockout after 5 failures.

**Minor issues** documented in §4 (Security Audit).

### 3.4 Scanner — Well-Engineered

The `ScanOrchestrator` (1194 lines) implements:
- Pause/resume with state machine
- `ScanSession` isolation (no shared mutable state)
- Scan-aware background jobs that skip during active scans
- Multi-phase: directory walk → media sync → deletion detection → image linking → FTS backfill

**Verdict: Mature and robust.**

---

## 4. Security Audit

### 4.1 Strengths

| # | Feature | Evidence |
|---|---|---|
| S1 | `JWT_SECRET` enforced at module load (FATAL if missing) | `auth-service.ts:11-17` |
| S2 | bcrypt cost factor 10 + minimum 6 chars | `auth-service.ts:210,198` |
| S3 | Account lockout (5 attempts / 15 min) | `auth-service.ts:61-75` |
| S4 | `httpOnly: true` on `session_token` cookie | `app/api/auth/route.ts:51-59` |
| S5 | `sanitizeUser()` strips password hash from all responses | `auth-service.ts:334` |
| S6 | Parameterized SQL queries throughout | `base-repository.ts` — all methods use `?` placeholders |
| S7 | ORDER BY column sanitization via allowlist | `base-repository.ts:255-259` — `_sanitizeOrderBy()` |
| S8 | SSRF blocklist for TMDB enrichment (RFC1918 ranges) | `tmdb-enrichment-service.ts:24-35` |
| S9 | Security headers: HSTS (2y preload), nosniff, DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy | `next.config.ts:4-33` |
| S10 | Proxy denies on failure (catch block defaults to redirect) | `proxy.ts:88-91` |
| S11 | Legacy password rehash on login | `auth-service.ts:114-117` |
| S12 | Session table enables server-side revocation | `auth-service.ts:137` |
| S13 | DB backup file validates `.db` extension + non-empty | `database-service.ts:217-218` |

### 4.2 Findings

| # | Severity | Finding | Location | Notes |
|---|---|---|---|---|
| **SEC-1** | **Medium-High** | **No `Content-Security-Policy` header** — XSS mitigation gap. The admin layout uses `dangerouslySetInnerHTML` for theme flash-prevention script. | `next.config.ts:4-33` | 7 headers present, CSP absent |
| **SEC-2** | **Medium** | **`ORDER BY` direction (`order` parameter) not validated** — interpolated as `ORDER BY ${col} ${order}`. Column is validated against allowlist, but direction (ASC/DESC) is not. | `base-repository.ts:354-359, 377-389` | Currently safe: `paginateAll`/`paginateByField` are **dead code** (zero callers). Latent risk if reactivated. |
| **SEC-3** | **Medium** | **`.env.production` contains `CHANGE_ME_IN_PRODUCTION`** as JWT_SECRET — deployment risk if installer doesn't replace it. | `.env.production:5` | Template file, but dangerous if deployed as-is |
| **SEC-4** | **Medium** | **Backup download path traversal** — validation blocks `..`, `/`, `\` but doesn't use `path.resolve()` to confirm resolved path is within backup directory. | `database-controller.ts:68-71` | On Windows, alternate data streams or UNC paths could bypass |
| **SEC-5** | **Low-Medium** | **Password minimum 6 chars, no complexity** requirements (uppercase, digits, special). | `auth-service.ts:198` | Modern best practice: 8+ with complexity |
| **SEC-6** | **Low** | **`visitor_session_id` cookie `httpOnly: false`** — JS-accessible, XSS amplifier. | `proxy.ts:40` | Only needed server-side for tracking |
| **SEC-7** | **Low** | **No CSRF token mechanism** — relies on `sameSite: "lax"` only. | `app/api/auth/route.ts:53` | Adequate for same-origin SPA, but not defense-in-depth |
| **SEC-8** | **Low** | **`parseBody()` has no input size limits** — potential memory exhaustion. | `route-helpers.ts:95-124` | Next.js has its own limits, but app-level defense is absent |
| **SEC-9** | **Low** | **`getByField()` interpolates `field` parameter** as SQL string. | `base-repository.ts:282-284` | Currently safe: all 4 callers use hardcoded strings (`"username"`, `"email"`, `"name"`) — verified |
| **SEC-10** | **Low** | **License JSON loaded without Zod validation** — `loadFromData()` parses JSON and casts without schema validation. | `license-service.ts:159` | Malicious JSON could cause unexpected behavior |
| **SEC-11** | **Info** | **`JWT_EXPIRES_IN` env var is dead** — defined with default `"7d"` in `env.ts:7`, but `auth-service.ts:18` hardcodes `TOKEN_EXPIRY = 2 * 60 * 60` (2 hours). Operators who set `JWT_EXPIRES_IN=7d` are silently ignored. | `env.ts:7` vs `auth-service.ts:18` | Functional bug, not security hole |
| **SEC-12** | **Info** | **`X-XSS-Protection: 1; mode=block` is deprecated** — modern browsers have removed it; CSP is the replacement. | `next.config.ts:19` | Not harmful, should be replaced with CSP |

### 4.3 Not Vulnerable (Verified Safe)

Despite surface-level concerns, the following patterns are **safe in current usage**:

| Pattern | Why Safe |
|---|---|
| `getByField()` field interpolation | All 4 callers pass hardcoded strings |
| `paginateAll`/`paginateByField` ORDER direction | Zero callers — dead code |
| `MediaRepository.searchMedia` LIKE '%query%' | Zero callers — dead code |
| No auth on viewer API endpoints | Architectural decision — protected at layout level, not API level |
| `/api/settings` GET returns config without auth | By design — public settings only |

---

## 5. Database & Performance

### 5.1 Index Analysis

**86 indexes** across 24 tables. The `media_items` table (the hot path) has 13 indexes, which is appropriate given diverse query patterns.

#### Duplicate/Redundant Indexes (6 confirmed)

| # | Index A | Index B | Issue |
|---|---|---|---|
| IDX-1 | `idx_user_sessions_user_id (user_id, is_active)` | `idx_user_sessions_user_active (user_id, is_active)` | **Identical** — one should be removed |
| IDX-2 | `idx_activities_user_created (user_id, created_at DESC)` | `idx_activities_user_date (user_id, created_at DESC)` | **Identical** |
| IDX-3 | `idx_security_events_user (user_id, resolved, created_at DESC)` | `idx_security_events_user_resolved (user_id, resolved)` | **Superset** — second is prefix of first |
| IDX-4 | `idx_security_events_user (user_id, resolved, created_at DESC)` | `idx_security_user_date (user_id, created_at DESC)` | **Superset** — first covers second |
| IDX-5 | `idx_user_progress_user_media (UNIQUE, user_id, media_id)` | `idx_user_progress_unique (UNIQUE, user_id, media_id)` | **Identical** UNIQUE constraints |
| IDX-6 | `idx_media_people_media (media_id)` | `idx_media_people_media_id (media_id, role)` | **Prefix redundant** — composite PK covers single-column lookup |

**Impact:** Write amplification during scans (the highest-throughput operation). Each unnecessary index adds overhead to every INSERT/UPDATE on affected tables.

**All defined in:** `src/backend/db/migrations/001_initial_schema.sql`

### 5.2 Missing Index

| # | Gap | Recommendation |
|---|---|---|
| IDX-MISS-1 | `getMediaByFilter` (the primary list endpoint) filters on `is_available, parent_media_id, type` and sorts by `created_at DESC` — no single index covers this pattern. | `CREATE INDEX idx_media_items_filter_root ON media_items(is_available, parent_media_id, type, created_at DESC)` |

### 5.3 N+1 Query Patterns

| # | Severity | Pattern | Location | Impact |
|---|---|---|---|---|
| SQL-1 | **Medium** | `setGenresForMedia` — DELETE + loop INSERT (N+1 round-trips) | `media-repository.ts:208-217` | Every genre update during scan fires N+1 queries |
| SQL-2 | **Low-Medium** | `batchUpdatePersonNames` — loop UPDATE | `media-repository.ts:906-912` | 20 cast members = 20 round-trips per translation batch |
| SQL-3 | **Low-Medium** | `batchUpdatePersonCharacters` — loop UPDATE | `media-repository.ts:914-920` | Same pattern |
| SQL-4 | **Low** | `createFile` — INSERT + GET by ID + GET by path fallback (triple query) | `media-repository.ts:111-155` | 3 queries per file creation |
| SQL-5 | **Low** | `BaseRepository.create` / `update` — extra SELECT after INSERT/UPDATE | `base-repository.ts:294-319` | Doubles query count during scan item creation |
| SQL-6 | **Low** | `MediaService.deleteItem` — sequential file deletion | `media-service.ts:513-523` | Could use `Promise.allSettled` for parallel unlink |

### 5.4 Cache Layer Issues

| # | Severity | Finding | Location |
|---|---|---|---|
| CACHE-1 | **Medium** | **Default `staleTTL` = 86400 (24h) exceeds `configure()` upper bound of 7200 (2h)** — `configure()` is dead code (never called), so defaults apply. Stale data can be served for up to 24 hours. | `cache-service.ts:47` (default) vs `cache-service.ts:85` (configure bound) |
| CACHE-2 | **Low** | `deleteByPrefix` iterates ALL cache keys — O(N) scan on every invalidation event. | `cache-service.ts:211-227` |
| CACHE-3 | **Low** | `invalidateLibraryCache()` is an empty no-op — called after every scan but does nothing. | `media-repository.ts:466-468` |
| CACHE-4 | **Info** | Cache hit/miss stats reset on `clear()` — no persistent metrics. | `cache-service.ts:446` |

### 5.5 FTS5 Search

| # | Finding | Assessment |
|---|---|---|
| FTS-1 | `unicode61 remove_diacritics 1` tokenizer — strips Arabic tashkeel at tokenization time | Excellent for Arabic search |
| FTS-2 | INSERT trigger stores `phonetic_key = ''` — items not phonetically searchable until `backfillMissing()` runs after scan | Documented, intentional, mitigated |
| FTS-3 | `searchMediaWithCount` fires up to 4 DB queries when phonetic fallback triggers (primary COUNT + fallback results + fallback COUNT) | Could defer primary COUNT when fallback is likely |
| FTS-4 | `MediaRepository.searchMedia` uses `LIKE '%query%'` — full table scan bypassing FTS5 | **Dead code** — zero callers confirmed. Safe to remove. |

### 5.6 `SELECT *` Anti-Pattern

Nearly all queries against `media_items` (55+ columns in `DbMediaItem`, actually 65 fields per `schema.ts`) use `SELECT *`. For list endpoints returning 30-50 items, this fetches 65 columns per row when most consumers need 5-10. Impact: memory, page cache pressure, network overhead.

---

## 6. Test Coverage

### 6.1 Current State

| Layer | Total Files | Tested (directly) | Coverage |
|---|---|---|---|
| Services | 38 | 4-5 (partial) | ~13% |
| Controllers | 24 | 1 (partial) | ~4% |
| Repositories | 24 | 3-4 | ~14% |
| Scanner modules | 15 | 6 | ~40% |
| DB modules | 4 | 3 | ~75% |
| Route handlers | ~130 | 1 route | ~1% |
| Frontend components | 177 .tsx | 0 | 0% |
| **Total test files** | **26** | | |

### 6.2 What IS Tested (26 files)

Strong coverage on: scanner lifecycle, FTS5 backfill, enrichment transactional safety, SSRF blocklist, proxy admin protection, DB migration, scan-active guards, savepoint concurrency, hierarchy rules, path utilities, auth lockout, media genres in lists, media merge dedup, search normalization, visitor repository race conditions.

### 6.3 Critical Gaps

| # | Gap | Risk | Files |
|---|---|---|---|
| TEST-1 | **No `route-helpers` tests** — `parseAuthFromRequest`, `requireAuth`, `requireAdmin` are the auth gatekeepers for ALL 130 route handlers | A bug bypasses admin protection | `route-helpers.ts` |
| TEST-2 | **No `auth-service` token/password tests** — only `login`+lockout is tested; `verifyToken`, `changePassword`, `refreshToken` are untested | Security-critical | `auth-service.ts` |
| TEST-3 | **No `settings-service` tests** — settings drive entire app behavior (`viewer_access_mode`, `image_storage_root`, etc.) | Configuration corruption | `settings-service.ts` |
| TEST-4 | **No `database-service` tests** (beyond scan-active guard) — backup/restore/factory-reset internals untested | Destructive operations | `database-service.ts` |
| TEST-5 | **No `media-service` tests** — the largest business-logic service | Core feature regression | `media-service.ts` |
| TEST-6 | **No `cache-service` tests** — LRU, TTL, invalidation, memory monitoring untested | Stale data bugs | `cache-service.ts` |
| TEST-7 | **No frontend tests** — zero `.test.tsx` files, no jsdom configured | UI regressions invisible | All `src/features/` |

---

## 7. Code Quality & Dead Code

### 7.1 Confirmed Dead Code

| # | Item | Location | Evidence |
|---|---|---|---|
| DEAD-1 | `paginateAll()` method | `base-repository.ts:354` | **Zero callers** across entire codebase (grep confirmed) |
| DEAD-2 | `paginateByField()` method | `base-repository.ts:377` | **Zero callers** (grep confirmed) |
| DEAD-3 | `beginTransaction()` method | `base-repository.ts:221` | **Zero callers** — all transaction code uses `withTransaction()` via SAVEPOINTs instead |
| DEAD-4 | `commit()` method | `base-repository.ts:229` | **Zero callers** |
| DEAD-5 | `rollback()` method | `base-repository.ts:239` | **Zero callers** |
| DEAD-6 | `MediaRepository.searchMedia()` (LIKE '%query%') | `media-repository.ts:311` | **Zero callers** — all search flows through `SearchRepository` FTS5 (verified: `SearchService.liveSearch` → `SearchRepository.searchMedia`, `SearchService.searchMedia` → `SearchRepository.searchMediaWithCount`) |
| DEAD-7 | `CacheService.configure()` method | `cache-service.ts:74` | **Zero callers** — never invoked; cache always uses hardcoded defaults |
| DEAD-8 | `invalidateLibraryCache()` — empty no-op | `media-repository.ts:466-468` | Called after every scan but body is empty |
| DEAD-9 | `module-level transactionLevel` variable | `base-repository.ts:101` | Used only by dead methods (DEAD-3/4/5) |
| DEAD-10 | `JWT_EXPIRES_IN` env variable | `env.ts:7` | Parsed but never consumed by auth-service |
| DEAD-11 | `CORS_ORIGINS` env variable | `env.ts` | Defined but never used (no `Access-Control-Allow-Origin` anywhere — confirmed by architecture audit) |
| DEAD-12 | `HomeSliders/` directory | `features/viewer/components/home/HomeSliders/` | Empty directory |

### 7.2 Unused Dependencies (package.json)

| Package | Type | Evidence |
|---|---|---|
| `sql.js` | dependency | AGENTS.md: "unused; don't add imports" |
| `zustand` | dependency | Not imported in any frontend file (grep confirmed) |
| `@types/sqlite3` | devDependency | Project uses `sqlite` + `sqlite3`, not better-sqlite3 |

### 7.3 Schema Inconsistencies

| # | Finding | Details |
|---|---|---|
| SCHEMA-1 | `favorites` table in `PRIMARY_KEY_MAP` but **not created** in any migration file | `base-repository.ts:32` — may be dead reference |
| SCHEMA-2 | `schema.ts` has 25 interfaces (numbered 1-25 with #18 missing) but comment says "23 tables" | `schema.ts:1` vs actual count |
| SCHEMA-3 | `DbMediaItem` has **65 fields** | `schema.ts:71-135` — very wide table |

### 7.4 `SELECT *` on Wide Tables

`media_items` has 65 fields. Most list queries use `SELECT *`. Explicit column lists would reduce memory, page cache pressure, and network overhead for the highest-traffic endpoints.

---

## 8. Dependency Hygiene

### 8.1 Runtime Dependencies (22 total)

| Category | Packages | Assessment |
|---|---|---|
| Framework | `next@16.2.12`, `react@19.2.4`, `react-dom@19.2.4` | Current |
| UI | `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `next-themes`, `chart.js`, `react-chartjs-2` | Appropriate |
| State | `zustand` | **Unused** |
| Database | `sqlite3`, `sqlite`, `sql.js` | `sql.js` **unused** |
| Auth | `bcryptjs`, `jsonwebtoken` | Appropriate |
| Media | `sharp`, `google-translate-api-x`, `chokidar`, `p-limit`, `ws` | Appropriate |
| Packaging | `adm-zip` | Appropriate |

### 8.2 Dev Dependencies (15 total)

| Package | Assessment |
|---|---|
| `typescript@5` | Current |
| `eslint@9` + plugins | Current |
| `prettier@3` + tailwind plugin | Current |
| `vitest@4` | Current |
| `@tailwindcss/postcss` | Tailwind v4 — correct |
| `@types/sqlite3` | **Unused** — project uses `sqlite` + `sqlite3` |

### 8.3 Recommendations

1. Remove `sql.js` from dependencies
2. Remove `zustand` from dependencies (or use it for state management)
3. Remove `@types/sqlite3` from devDependencies
4. Remove empty `HomeSliders/` directory

---

## 9. Consolidated Findings Table

Sorted by severity, then by domain.

| # | Severity | Domain | Finding | Location | Action Required |
|---|---|---|---|---|---|
| SEC-1 | **Med-High** | Security | No CSP header | `next.config.ts` | Add `Content-Security-Policy` |
| SQL-1 | **Medium** | Performance | `setGenresForMedia` N+1 loop | `media-repository.ts:208-217` | Batch INSERT |
| IDX-MISS-1 | **Medium** | Performance | Missing composite index for `getMediaByFilter` | `media-repository.ts` | Add migration |
| CACHE-1 | **Medium** | Performance | `staleTTL` default 24h, `configure()` dead | `cache-service.ts:47,74` | Lower default + wire configure or remove |
| SEC-2 | **Medium** | Security | ORDER direction not validated (dead code) | `base-repository.ts:354-359` | Remove dead methods or add validation |
| SEC-3 | **Medium** | Security | `.env.production` CHANGE_ME secret | `.env.production:5` | Installer must replace |
| SEC-4 | **Medium** | Security | Backup path traversal incomplete | `database-controller.ts:68-71` | Add `path.resolve()` check |
| IDX-1..6 | **Low-Med** | Performance | 6 duplicate/redundant indexes | `001_initial_schema.sql` | New migration to DROP |
| SQL-2 | **Low-Med** | Performance | `batchUpdatePersonNames` N+1 | `media-repository.ts:906-912` | Batch with CASE |
| SQL-3 | **Low-Med** | Performance | `batchUpdatePersonCharacters` N+1 | `media-repository.ts:914-920` | Batch with CASE |
| SEC-5 | **Low-Med** | Security | Password min 6 chars, no complexity | `auth-service.ts:198` | Increase minimum |
| CACHE-2 | **Low** | Performance | O(N) prefix scan in cache invalidation | `cache-service.ts:211-227` | Add prefix index |
| CACHE-3 | **Low** | Performance | `invalidateLibraryCache` no-op | `media-repository.ts:466-468` | Implement or remove |
| SEC-6 | **Low** | Security | `visitor_session_id` not httpOnly | `proxy.ts:40` | Set `httpOnly: true` |
| SEC-7 | **Low** | Security | No CSRF tokens | Global | Add tokens if cross-origin |
| SEC-8 | **Low** | Security | No input size limits in `parseBody()` | `route-helpers.ts:95-124` | Add size check |
| SEC-10 | **Low** | Security | License JSON no Zod validation | `license-service.ts:159` | Add schema |
| SQL-4 | **Low** | Performance | `createFile` triple query | `media-repository.ts:111-155` | Remove redundant fallback |
| SQL-5 | **Low** | Performance | Extra SELECT after INSERT/UPDATE | `base-repository.ts:294-319` | Skip read-back in scan path |
| SQL-6 | **Low** | Performance | Sequential file deletion in deleteItem | `media-service.ts:513-523` | Parallelize with `Promise.allSettled` |
| DEAD-1..12 | **Low** | Quality | 12 dead code items | Various (§7.1) | Remove |
| DEP-1..3 | **Low** | Quality | 3 unused dependencies | `package.json` | Remove |
| TEST-1..7 | **Info** | Quality | 7 critical test gaps | Various (§6.3) | Add tests |
| SEC-11 | **Info** | Config | `JWT_EXPIRES_IN` env dead | `env.ts:7` | Wire or remove |
| FTS-3 | **Info** | Performance | Up to 4 queries per search on fallback | `search-repository.ts:357` | Optimize deferred COUNT |

---

## 10. Prioritized Remediation Plan

### P0 — Security (Immediate)

| # | Task | Effort | Impact |
|---|---|---|---|
| P0-1 | Add `Content-Security-Policy` header to `next.config.ts` | Small | Mitigates XSS |
| P0-2 | Harden backup download path with `path.resolve()` check | Small | Prevents file read outside backup dir |
| P0-3 | Wire `JWT_EXPIRES_IN` into auth-service or remove from env.ts | Small | Eliminates config confusion |

### P1 — Performance (High Impact)

| # | Task | Effort | Impact |
|---|---|---|---|
| P1-1 | Add composite index `idx_media_items_filter_root` via new migration | Small | Faster list page loads |
| P1-2 | Batch `setGenresForMedia` into single INSERT | Small | Eliminates N+1 on every genre update |
| P1-3 | Drop 6 duplicate indexes via new migration | Small | Reduces write amplification during scans |
| P1-4 | Lower default `staleTTL` from 86400 to 3600 | Trivial | Prevents stale data served for 24h |

### P2 — Dead Code Removal (Cleanup)

| # | Task | Files |
|---|---|---|
| P2-1 | Remove `paginateAll`, `paginateByField`, `beginTransaction`, `commit`, `rollback` from BaseRepository | `base-repository.ts` |
| P2-2 | Remove `MediaRepository.searchMedia` (LIKE-based, zero callers) | `media-repository.ts` |
| P2-3 | Remove `CacheService.configure()` or wire it up | `cache-service.ts` |
| P2-4 | Remove or implement `invalidateLibraryCache()` | `media-repository.ts` |
| P2-5 | Remove `module-level transactionLevel` variable | `base-repository.ts` |
| P2-6 | Remove unused dependencies (`sql.js`, `zustand`, `@types/sqlite3`) | `package.json` |
| P2-7 | Remove empty `HomeSliders/` directory | `features/viewer/components/home/` |
| P2-8 | Remove or wire `JWT_EXPIRES_IN` and `CORS_ORIGINS` env vars | `env.ts` |

### P3 — Test Coverage (Stability)

| # | Task | Priority |
|---|---|---|
| P3-1 | `route-helpers.test.ts` — auth gatekeepers for all 130 routes | Critical |
| P3-2 | `auth-service.test.ts` — expand to verifyToken, changePassword | Critical |
| P3-3 | `settings-service.test.ts` — settings drive entire app behavior | High |
| P3-4 | `media-service.test.ts` — largest business-logic service | High |
| P3-5 | `cache-service.test.ts` — LRU, TTL, invalidation, memory monitoring | Medium |
| P3-6 | `database-service.test.ts` — backup/restore/factory-reset internals | Medium |

### P4 — Medium-Term Improvements

| # | Task | Effort |
|---|---|---|
| P4-1 | Add `path.resolve()` check in `getBackupPath()` at service layer | Small |
| P4-2 | Increase password minimum to 8 chars with complexity | Trivial |
| P4-3 | Make `visitor_session_id` cookie `httpOnly: true` | Trivial |
| P4-4 | Add Zod validation for license JSON in `loadFromData()` | Small |
| P4-5 | Replace `SELECT *` with explicit columns for high-traffic list queries | Medium |
| P4-6 | Batch `batchUpdatePersonNames` with CASE-based update | Medium |
| P4-7 | Add prefix→Set<key> secondary index in CacheService for O(1) invalidation | Medium |

---

## Appendix A: Verified Call Chains

### Search (Confirmed: FTS5 only)

```
/api/search        → SearchController.search()
                      → SearchService.searchMedia()
                        → SearchRepository.searchMediaWithCount()  ← FTS5 MATCH

/api/search/live   → SearchController.liveSearch()
                      → SearchService.liveSearch()
                        → SearchRepository.searchMedia()           ← FTS5 MATCH

MediaRepository.searchMedia()                                     ← LIKE '%query%'
                      → ZERO CALLERS. Dead code.
```

### CacheService.configure() (Confirmed: Dead Code)

```
getCacheService(activityRepo)  → new CacheService(activityRepo)
  └─ settings hardcoded at lines 42-53
  └─ configure() defined at line 74
  └─ configure() called from: NOWHERE
```

### BaseRepository Transaction Methods (Confirmed: Dead Code)

```
beginTransaction() / commit() / rollback()
  └─ Module-level `transactionLevel` counter (line 101)
  └─ Called from: NOWHERE

All real transaction code uses:
  withTransaction(fn)  → withExclusiveTransaction(fn)  → SAVEPOINT (correct pattern)
```

---

*End of audit. All findings verified against source code as of 2026-08-17.*
