# Remediation Plan — Based on Baseline Validation

> **Project:** Library Manager V2
> **Created:** 2026-08-17
> **Source:** `08-baseline-validation.md`
> **Principle:** لا نصلح ما لم نثبت أنه يحتاج إصلاحًا. ولا نعتبر best practice أو architectural preference Bug.

---

## P0 — Dead Code Removal (Safe, No Behavior Change)

> Remove verified dead code. Each removal has zero-caller evidence.
> After each group: `npm run typecheck && npm run lint && npm test`.

### P0-1: BaseRepository Dead Methods

**Files:** `src/backend/repositories/base-repository.ts`

| Item | Line | Action | Risk |
|---|---|---|---|
| `paginateAll()` | 354-374 | Delete method | Zero callers |
| `paginateByField()` | 377-411 | Delete method | Zero callers |
| `beginTransaction()` | 221-227 | Delete method | Zero callers |
| `commit()` | 229-237 | Delete method | Zero callers |
| `rollback()` | 239-253 | Delete method | Zero callers |
| `transactionLevel` | 101 | Delete variable | Only used by deleted methods |

**Verification:** `npm run typecheck && npm run lint && npm test`

### P0-2: MediaRepository Dead Methods

**Files:** `src/backend/repositories/media-repository.ts`

| Item | Line | Action | Risk |
|---|---|---|---|
| `searchMedia()` | 311-327 | Delete method | Zero callers. Search through FTS5 |
| `setGenresForMedia()` | 208-217 | Delete method | Zero callers. Genres via `EnrichmentMediaRepository.saveGenres()` |

**Verification:** `npm run typecheck && npm run lint && npm test`

### P0-3: CacheService Dead Method

**Files:** `src/backend/services/cache-service.ts`

| Item | Line | Action | Risk |
|---|---|---|---|
| `configure()` | 74-100 | Delete method | Zero callers |

**Verification:** `npm run typecheck && npm run lint && npm test`

### P0-4: Dead Environment Variables

**Files:** `src/lib/config/env.ts`, `src/backend/services/auth-service.ts`

| Item | Location | Action | Risk |
|---|---|---|---|
| `JWT_EXPIRES_IN` | `env.ts:7,19` | Remove from schema + parseEnv | Parsed but never consumed. auth-service hardcodes 2h |
| `CORS_ORIGINS` | `env.ts:9,21` | Remove from schema + parseEnv | Defined but `getCorsOrigins()` has zero callers |
| `getCorsOrigins()` | `env.ts:44-49` | Delete function | Zero callers |

**Note:** Removing env vars from the Zod schema means `.env.local` / `.env.production` files that contain them will cause validation errors at startup. The installer template files must also be updated. **Check `.env.example` and installer templates before removing.**

**Verification:** `npm run typecheck && npm run lint && npm test`

### P0-5: Unused Dependencies

**Files:** `package.json`

| Package | Type | Action | Evidence |
|---|---|---|---|
| `sql.js` | dependency | `npm uninstall sql.js` | AGENTS.md: "unused; don't add imports" |
| `zustand` | dependency | `npm uninstall zustand` | Zero imports confirmed |
| `@types/sqlite3` | devDependency | `npm uninstall @types/sqlite3` | Project uses `sqlite` + `sqlite3` |

**Verification:** `npm run typecheck && npm run lint && npm test`

### P0-6: Empty Directory

**Files:** `src/features/viewer/components/home/HomeSliders/`

| Item | Action | Risk |
|---|---|---|
| `HomeSliders/` | `Remove-Item -Recurse` | Empty directory |

**Verification:** `npm run typecheck`

### P0 Group Verification

After all P0 changes:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

---

## P1 — Database Index Cleanup (New Migration)

> Remove verified duplicate/redundant indexes.
> Requires a new migration file: `014_drop_duplicate_indexes.sql`.

### P1-1: Create Migration `014_drop_duplicate_indexes.sql`

```sql
-- Migration 014: Drop duplicate/redundant indexes
-- Based on baseline validation (08-baseline-validation.md, Section E)
-- All drops verified safe: covered by identical or superset index.

-- IDX-1: Identical (user_id, is_active) — keep idx_user_sessions_user_id
DROP INDEX IF EXISTS idx_user_sessions_user_active;

-- IDX-2: Identical (user_id, created_at DESC) — keep idx_activities_user_created
DROP INDEX IF EXISTS idx_activities_user_date;

-- IDX-3: Superset — idx_security_events_user (user_id, resolved, created_at DESC)
-- covers idx_security_events_user_resolved (user_id, resolved)
DROP INDEX IF EXISTS idx_security_events_user_resolved;

-- IDX-5: Identical UNIQUE (user_id, media_id) — keep idx_user_progress_user_media
DROP INDEX IF EXISTS idx_user_progress_unique;

-- IDX-6: Prefix — idx_media_people_media_id (media_id, role) covers
-- idx_media_people_media (media_id) via leftmost prefix
DROP INDEX IF EXISTS idx_media_people_media;
```

### P1-2: Verify Migration Applied

After migration runs:

```bash
# Verify indexes are dropped
sqlite3 data/media_library.db "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_user_sessions_user_active', 'idx_activities_user_date', 'idx_security_events_user_resolved', 'idx_user_progress_unique', 'idx_media_people_media');"
# Expected: empty result
```

### P1-3: Verify Existing Queries Still Work

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

### P1 Migration Safety Notes

| Index | DROP Safe? | Reason |
|---|---|---|
| `idx_user_sessions_user_active` | Yes | `idx_user_sessions_user_id` identical |
| `idx_activities_user_date` | Yes | `idx_activities_user_created` identical |
| `idx_security_events_user_resolved` | Yes | `idx_security_events_user` is superset |
| `idx_user_progress_unique` | Yes | `idx_user_progress_user_media` identical UNIQUE |
| `idx_media_people_media` | Yes | `idx_media_people_media_id` covers via prefix |

---

## P2 — Runtime Evidence Collection (Before Performance Changes)

> Collect EXPLAIN QUERY PLAN and benchmarks before proposing performance fixes.
> No code changes in this phase — observation only.

### P2-1: `getMediaByFilter` Query Plan

```sql
EXPLAIN QUERY PLAN
SELECT m.* FROM media_items m
WHERE m.library_id = 1 AND m.is_available = 1
  AND m.parent_media_id IS NULL
  AND m.type = 'movie'
ORDER BY m.created_at DESC
LIMIT 50 OFFSET 0;
```

Record:
- Current index used
- Estimated rows
- Actual execution time (100 iterations average)
- Then simulate adding `idx_media_items_filter_root` and compare

### P2-2: `BaseRepository.create()` Query Count

During a scan of ~1000 items, count total queries:
- INSERT queries: N (one per item)
- SELECT queries from `getById`: N (one per item)
- Total: 2N

Record actual N and wall-clock time.

### P2-3: `batchUpdatePersonNames` Batch Size

Trigger a translation batch and record:
- Number of persons updated
- Wall-clock time
- Number of UPDATE queries fired

---

## P3 — Hardening Recommendations (User-Approved)

> These require explicit approval before execution.
> Each is trivial-to-small effort.

### H-3: Make `visitor_session_id` httpOnly

**File:** `src/proxy.ts:37-40`

```typescript
// Before
response.cookies.set("visitor_session_id", visitorId, {
  path: "/",
  sameSite: "lax",
  httpOnly: false,  // ← change to true
  maxAge: 60 * 60 * 24 * 365,
});

// After
response.cookies.set("visitor_session_id", visitorId, {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
});
```

**Impact:** No code reads this cookie client-side. Zero functional change.

### H-6: Remove `JWT_EXPIRES_IN` Dead Env Var

**File:** `src/lib/config/env.ts:7,19`

Remove from schema and parseEnv. Also update `.env.example` and installer templates.

**Impact:** Operators who set this var will get a startup validation error (correct behavior — it was being silently ignored).

---

## Execution Order

| Phase | Items | Effort | Behavior Change | Risk |
|---|---|---|---|---|
| P0 | Dead code removal | ~1 hour | None (dead code) | Very Low |
| P1 | Index cleanup migration | ~30 min | None (redundant indexes) | Low |
| P2 | Runtime evidence | ~1 hour | None (observation) | None |
| P3 | Hardening | ~30 min | Minimal | Low |

**Total estimated effort:** ~2.5 hours

**Prerequisites before P0:**
- Run `npm run typecheck && npm run lint && npm test` to establish current baseline
- Ensure clean working tree (no uncommitted changes)

**Prerequisites before P1:**
- P0 completed and verified
- Review installer template files for env var references (P0-4)

**Prerequisites before P3:**
- P0 and P1 completed
- User approval for each H-item

---

*Plan created from baseline validation (08-baseline-validation.md). All items are verified findings, not hypothetical improvements.*
