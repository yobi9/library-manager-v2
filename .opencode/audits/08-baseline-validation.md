# Baseline Validation — Final Verified Audit

> **Project:** Library Manager V2
> **Baseline Date:** 2026-08-17
> **Method:** Manual source code verification against `07-comprehensive-project-audit.md`
> **Scope:** Full audit report (SEC-1..12, IDX-1..6, IDX-MISS-1, SQL-1..6, CACHE-1..4, DEAD-1..12)
> **Status:** Complete — all findings re-verified against actual source code
> **No code was changed. No remediation plan produced.**

---

## A. Verified Findings

### SEC-1: No Content-Security-Policy Header

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Exploit path** | None demonstrated. No user-controlled input enters the `dangerouslySetInnerHTML` string. |
| **Attacker-controlled input** | None. The script is: `(function(){var t=localStorage.getItem("admin_dashboard_theme")\|\|"dark";document.body.classList.add("admin-layout");document.body.dataset.theme=t})()` — reads only from `localStorage("admin_dashboard_theme")` which is a static string literal. |
| **Affected asset** | Admin dashboard theme persistence (cosmetic only). |
| **Evidence** | `next.config.ts:4-33` — 7 headers present, CSP absent. `admin/layout.tsx:184-188` — single `dangerouslySetInnerHTML` with hardcoded IIFE. Zero other instances across codebase. |
| **Notes** | A CSP with `script-src 'self'` would be a defense-in-depth improvement. Next.js inline scripts require `'unsafe-inline'` for styles. Actual XSS surface is minimal. |

### SEC-2: ORDER Direction Not Validated

| Field | Value |
|---|---|
| **Status** | Dead Code |
| **Severity** | N/A (0 risk) |
| **Confidence** | High |
| **Evidence** | `paginateAll` at `base-repository.ts:354` — zero callers. `paginateByField` at `base-repository.ts:377` — zero callers. |
| **Notes** | Latent risk if someone reactivates these methods. Not a current vulnerability. |

### SEC-3: `.env.production` Contains CHANGE_ME_IN_PRODUCTION

| Field | Value |
|---|---|
| **Status** | Deployment Risk |
| **Severity** | Low |
| **Confidence** | High |
| **Exploit path** | Requires deploying without the installer AND without changing the env file. |
| **Affected asset** | JWT authentication — known secret allows forging session tokens. |
| **Evidence** | `.env.production:5`. AGENTS.md: "installer generates real per-machine values." |

### SEC-4: Backup Download Path Traversal

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Exploit path** | None demonstrated. `database-controller.ts:67-71` blocks `..`, `/`, `\`. On Windows, `path.join(backupDir, filename)` where filename passes these checks cannot escape the backup directory. |
| **Evidence** | `database-controller.ts:67-74` — validation. `database-service.ts:217` — `getBackupPath` calls `path.join(backupDir, filename)`. |
| **Notes** | `path.resolve()` check may still be considered defense-in-depth. No exploit demonstrated. |

### SEC-5: Password Minimum 6 Characters

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Exploit path** | Brute-force requires online attack against lockout (5/15), bcrypt cost 10, no exposed registration. |
| **Evidence** | `auth-service.ts:198,210,20-21,137`. Modern NIST 800-63B removed complexity requirements. |

### SEC-6: `visitor_session_id` Cookie Not httpOnly

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Exploit path** | XSS amplifier only if XSS exists first. No XSS established. |
| **Evidence** | `proxy.ts:37-40`. Zero `document.cookie` references. All 23 references server-side. |
| **Notes** | Cookie purpose: anonymous visitor tracking. No authenticated data. Header `x-visitor-session-id` is primary read path. |

### SEC-7: No CSRF Token Mechanism

| Field | Value |
|---|---|
| **Status** | Not Vulnerable |
| **Severity** | N/A |
| **Confidence** | High |
| **Exploit path** | None. SameSite: lax + same-origin SPA. |
| **Evidence** | `app/api/auth/route.ts:53`. All API calls same-origin fetch. |

### SEC-8: `parseBody()` Has No Input Size Limits

| Field | Value |
|---|---|
| **Status** | Not Vulnerable |
| **Severity** | N/A |
| **Confidence** | High |
| **Exploit path** | None. Next.js has built-in body size limits. |
| **Evidence** | `route-helpers.ts:95-124`. |

### SEC-9: `getByField()` Field Interpolation

| Field | Value |
|---|---|
| **Status** | Not Vulnerable |
| **Severity** | N/A |
| **Confidence** | High |
| **Exploit path** | None. All 4 callers pass hardcoded strings. |
| **Evidence** | `base-repository.ts:282-284`. Callers: `user-repository.ts:10`, `library-repository.ts:41`, `user-service.ts:73,133`. |

### SEC-10: License JSON Loaded Without Zod Validation

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Evidence** | `license-service.ts:159-179`. RSA verification is the actual security mechanism. |

### SEC-11: `JWT_EXPIRES_IN` Dead Environment Variable

| Field | Value |
|---|---|
| **Status** | Dead Code |
| **Severity** | N/A |
| **Confidence** | High |
| **Evidence** | `env.ts:7` — parsed but never consumed. `auth-service.ts:18` — hardcoded `TOKEN_EXPIRY = 2 * 60 * 60`. |

### SEC-12: Deprecated `X-XSS-Protection` Header

| Field | Value |
|---|---|
| **Status** | Hardening Recommendation |
| **Severity** | Info |
| **Confidence** | High |
| **Evidence** | `next.config.ts:22-24`. |

---

## B. Observations

### FTS-1: `unicode61 remove_diacritics 1` Tokenizer
Excellent for Arabic search. Diacritics stripped at tokenization time.

### FTS-2: INSERT Trigger Stores Empty Phonetic Key
Items not phonetically searchable until `backfillMissing()` runs after scan. Documented, intentional.

### FTS-3: Up to 3 Queries Per Search on Fallback
Could defer primary COUNT when fallback is likely. Low priority.

### Cache Stats Reset on `clear()`
By design, not a bug. `cache-service.ts:442-449`.

### Test File Coverage by Module

| Layer | Test Files | Source Files | Coverage | Rating |
|---|---|---|---|---|
| Controllers | 0 | 23 | 0% | **Missing** |
| Services (non-scanner) | 0 | 37 | 0% | **Missing** |
| Scanner | 5 | 14 | 36% | **Partial** |
| Enrichment | 4 | ~5 | 80% | **Strong** |
| Repositories | 2 | 23 | 9% | **Missing** |
| Infrastructure | 5 | 6 | 83% | **Strong** |
| Domain logic | 4 | ~10 | 40% | **Partial** |
| Auth | 1 | ~3 | 33% | **Partial** |
| Frontend | 0 | 98 | 0% | **Missing** |
| API routes | 0 | 130 | 0% | **Missing** |

No Vitest coverage report available. Numbers represent test file coverage by module (NOT code coverage).

### Architecture Observations
- Strong backend layering observed (Route Handlers → Controllers → Services → Repositories).
- No SQL in services, no repository calls from route handlers.
- Dual-connection model with `AsyncLocalStorage` writer context is well-designed.
- No critical issue established in audited scope.
- Further runtime/load/failure testing required.

---

## C. Hardening Recommendations

| ID | Recommendation | Evidence | Effort |
|---|---|---|---|
| H-1 | Add CSP header | `next.config.ts:4-33` | Small |
| H-2 | Add `path.resolve()` check in `getBackupPath()` | `database-controller.ts:67-74` | Trivial |
| H-3 | Make `visitor_session_id` cookie `httpOnly: true` | `proxy.ts:37-40` | Trivial |
| H-4 | Add Zod validation for license JSON | `license-service.ts:159` | Small |
| H-5 | Replace deprecated `X-XSS-Protection` with CSP | `next.config.ts:22-24` | Small |
| H-6 | Wire or remove `JWT_EXPIRES_IN` env var | `env.ts:7` vs `auth-service.ts:18` | Trivial |

---

## D. Dead Code

| ID | Item | Location | Evidence | Classification |
|---|---|---|---|---|
| DEAD-1 | `paginateAll()` | `base-repository.ts:354` | 1 match (definition only) | Confirmed Dead Code |
| DEAD-2 | `paginateByField()` | `base-repository.ts:377` | 1 match (definition only) | Confirmed Dead Code |
| DEAD-3 | `beginTransaction()` | `base-repository.ts:221` | 1 match (definition only) | Confirmed Dead Code |
| DEAD-4 | `commit()` | `base-repository.ts:229` | Only definition. References in comments only | Confirmed Dead Code |
| DEAD-5 | `rollback()` | `base-repository.ts:239` | Only definition | Confirmed Dead Code |
| DEAD-6 | `MediaRepository.searchMedia()` | `media-repository.ts:311` | LIKE-based. Zero callers. Search through FTS5 | Confirmed Dead Code |
| DEAD-7 | `CacheService.configure()` | `cache-service.ts:74` | 1 match (definition only) | Confirmed Dead Code |
| DEAD-8 | `module-level transactionLevel` | `base-repository.ts:101` | Only used by DEAD-3/4/5 | Confirmed Dead Code |
| DEAD-9 | `JWT_EXPIRES_IN` env var | `env.ts:7` | Parsed but never consumed | Confirmed Dead Code |
| DEAD-10 | `CORS_ORIGINS` env var | `env.ts:9` | Defined + re-exported, `getCorsOrigins()` zero callers | Confirmed Dead Code |
| DEAD-11 | `setGenresForMedia()` | `media-repository.ts:208` | 1 match (definition only) | Confirmed Dead Code |
| DEAD-12 | `sql.js` dependency | `package.json` | AGENTS.md: "unused" | Confirmed Dead Code |
| DEAD-13 | `zustand` dependency | `package.json` | Not imported anywhere | Confirmed Dead Code |
| DEAD-14 | `@types/sqlite3` devDependency | `package.json` | Project uses `sqlite` + `sqlite3` | Confirmed Dead Code |

---

## E. Performance Candidates

### SQL-5: Extra SELECT After INSERT in `BaseRepository.create()`

| Field | Value |
|---|---|
| **Call chain** | `media-sync.service.ts:633` → `mediaRepo.createMedia(leafData)` → `media-repository.ts:103` → `this.create(mediaData)` → `base-repository.ts:294-306`: INSERT at line 301, `if (newId)` → `this.getById(newId)` at line 304 |
| **getById complexity** | Single-table PK lookup, no joins |
| **Typical items** | Hundreds to thousands per scan |
| **Runtime impact** | Not benchmarked. 2 queries per new item. |

### SQL-2/3: `batchUpdatePersonNames`/`batchUpdatePersonCharacters` N+1

| Field | Value |
|---|---|
| **Call chain** | `translation-service.ts:347,355` → sequential UPDATE per row |
| **Triggered by** | Admin-initiated batch translation only |
| **Impact** | Needs runtime measurement |

### IDX-MISS-1: Missing Composite Index for `getMediaByFilter`

| Field | Value |
|---|---|
| **Status** | Needs Runtime Evidence |
| **Query** | `media-repository.ts:460-543` — dynamic WHERE with ORDER BY `created_at DESC` |
| **Best existing index** | `idx_media_items_lib_created (library_id, created_at DESC)` |
| **Next step** | `EXPLAIN QUERY PLAN` with real parameters |

### IDX Duplicate/Redundant Indexes

| ID | Index A | Index B | Relationship | Drop Candidate |
|---|---|---|---|---|
| IDX-1 | `idx_user_sessions_user_id (user_id, is_active)` | `idx_user_sessions_user_active (user_id, is_active)` | Identical | Either |
| IDX-2 | `idx_activities_user_created (user_id, created_at DESC)` | `idx_activities_user_date (user_id, created_at DESC)` | Identical | Either |
| IDX-3 | `idx_security_events_user (user_id, resolved, created_at DESC)` | `idx_security_events_user_resolved (user_id, resolved)` | A ⊃ B | `idx_security_events_user_resolved` |
| IDX-5 | `idx_user_progress_user_media (UNIQUE, user_id, media_id)` | `idx_user_progress_unique (UNIQUE, user_id, media_id)` | Identical UNIQUE | Either |
| IDX-6 | `idx_media_people_media (media_id)` | `idx_media_people_media_id (media_id, role)` | A ⊂ B | `idx_media_people_media` |

### CACHE-1: Default `staleTTL` = 86400 (24h)
Error fallback only. Low impact for LAN deployment.

### CACHE-2: O(N) Prefix Scan in `deleteByPrefix`
Iterates max 5000 keys. Trivial cost.

---

## F. Unknowns / Evidence Gaps

1. **IDX-MISS-1**: Needs `EXPLAIN QUERY PLAN` with real query parameters and data volume.
2. **SQL-2/3 Impact**: Actual translation batch sizes and runtime cost.
3. **SQL-5 Impact**: Actual number of items per scan and cumulative cost.
4. **Test Coverage**: No Vitest coverage report. File-ratio only.
5. **Production Readiness**: Static analysis alone cannot establish this.

---

## G. Audit Corrections

| Original Claim | Correction | Classification |
|---|---|---|
| `invalidateLibraryCache()` exists as no-op | **Function does not exist.** | Phantom Finding |
| SQL-1 `setGenresForMedia` N+1 is active | **Zero callers.** Dead code. | Dead Code |
| SEC-8 `parseBody()` has no size limits | **Invalidated.** Next.js built-in limits. | Invalidated |
| `DbMediaItem` has 65 fields | **62 fields.** | Metric correction |
| Total indexes = 86 | **87.** 84+1+1+1. | Metric correction |
| IDX-4 `idx_security_events_user` covers `idx_security_user_date` | **Incorrect.** `resolved` column prevents optimization. | Audit Correction |
| "0 vulnerabilities" | **Replaced with scope-limited statement.** | Scope limitation |
| "Production-grade" / "Excellent" / "Mature" | **Replaced with measured observations.** | Scope limitation |
| Test coverage "~13% services" | **Corrected to:** "Test file coverage by module". | Metric correction |

---

## Final Findings Table

| ID | Domain | Status | Severity | Confidence | Evidence | Runtime Evidence Needed |
|---|---|---|---|---|---|---|
| SEC-1 | Security | Hardening Recommendation | Info | High | `next.config.ts`, `admin/layout.tsx:184-188` | No |
| SEC-2 | Security | Dead Code | N/A | High | `base-repository.ts:354,377` | No |
| SEC-3 | Security | Deployment Risk | Low | High | `.env.production:5` | No |
| SEC-4 | Security | Hardening Recommendation | Info | High | `database-controller.ts:67-74` | No |
| SEC-5 | Security | Hardening Recommendation | Info | High | `auth-service.ts:198,210,20-21` | No |
| SEC-6 | Security | Hardening Recommendation | Info | High | `proxy.ts:37-40` | No |
| SEC-7 | Security | Not Vulnerable | N/A | High | SameSite: lax, same-origin SPA | No |
| SEC-8 | Security | Not Vulnerable | N/A | High | Next.js built-in limits | No |
| SEC-9 | Security | Not Vulnerable | N/A | High | 4 callers, hardcoded strings | No |
| SEC-10 | Security | Hardening Recommendation | Info | High | `license-service.ts:159-179` | No |
| SEC-11 | Security | Dead Code | N/A | High | `env.ts:7` vs `auth-service.ts:18` | No |
| SEC-12 | Security | Hardening Recommendation | Info | High | `next.config.ts:22-24` | No |
| SQL-5 | Performance | Performance Candidate | Low-Med | High | `base-repository.ts:294-306` | Yes — benchmark |
| SQL-2 | Performance | Performance Candidate | Low | High | `media-repository.ts:906-919` | Yes — batch size |
| SQL-3 | Performance | Performance Candidate | Low | High | `media-repository.ts:914-920` | Yes — batch size |
| SQL-4 | Performance | Performance Candidate | Low | High | `media-repository.ts:111-155` | No |
| SQL-6 | Performance | Performance Candidate | Low | High | `media-service.ts:513-523` | No |
| IDX-MISS-1 | Performance | Needs Runtime Evidence | Unknown | Low | `media-repository.ts:460-543` | Yes — EXPLAIN |
| IDX-1 | Performance | Duplicate Index | Low-Med | High | Migration 001 | No |
| IDX-2 | Performance | Duplicate Index | Low-Med | High | Migration 001 | No |
| IDX-3 | Performance | Redundant Index | Low-Med | High | Migration 001:389+390 | No |
| IDX-5 | Performance | Duplicate Index | Low-Med | High | Migration 001:431+436 | No |
| IDX-6 | Performance | Redundant Index | Low | High | Migration 001:245+248 | No |
| CACHE-1 | Cache | Observation | Low | High | `cache-service.ts:45` | No |
| CACHE-2 | Cache | Observation | Low | High | `cache-service.ts:211-227` | No |
| DEAD-1..14 | Quality | Confirmed Dead Code | N/A | High | See Section D | No |
| H-1..6 | Security | Hardening Recommendation | Info | High | See Section C | No |

---

*Baseline frozen 2026-08-17. No code was changed. No remediation plan produced.*
*This document serves as the authoritative reference for future remediation work.*
