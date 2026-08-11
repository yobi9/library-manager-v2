# Image System Refactor Plan

> **Created:** 2026-08-04
> **Author:** opencode (AI)
> **Status:** Approved — Ready for Implementation
> **Audit Reference:** `docs/audits/image-system-architecture-audit.md`

---

## Table of Contents

1. [Objectives](#1-objectives)
2. [Architecture Principles](#2-architecture-principles)
3. [Phase 1: Critical Fixes](#3-phase-1-critical-fixes)
4. [Phase 2: Path Unification](#4-phase-2-path-unification)
5. [Phase 3: Dynamic Image Sources](#5-phase-3-dynamic-image-priorities)
6. [Phase 4: Production Hardening](#6-phase-4-production-hardening)
7. [File Change Matrix](#7-file-change-matrix)
8. [Testing Strategy](#8-testing-strategy)
9. [Risk Assessment](#9-risk-assessment)

---

## 1. Objectives

### Primary Goals

1. **Fix broken image types** — `person` and `still` must work correctly
2. **Unify path resolution** — all images use a single, configurable storage root
3. **Make image sources dynamic** — priority order configurable from the admin UI
4. **Production-safe** — images survive builds, deployments, and updates

### Non-Goals (Out of Scope)

- Server-side image resizing (requires `sharp` — separate effort)
- S3 storage implementation (separate project)
- Image compression or format conversion
- CDN integration

---

## 2. Architecture Principles

### 2.1 Single Source of Truth

The `ImageService` is the **sole authority** for image resolution. No frontend component, controller, or repository makes image source decisions. The frontend only constructs URLs; the service resolves them.

### 2.2 Configurable Paths

No image path is hardcoded. All paths derive from:
- Database settings (`image_storage_root`)
- Database table (`image_sources`)
- Placeholder constants (as last resort)

### 2.3 Consistent Path Format

All paths stored in the database are **web-relative** (e.g., `/assets/images/enriched/posters/550_poster.jpg`). Absolute filesystem paths are only used transiently during file I/O — never stored.

### 2.4 Never Return 404

The image API always returns a valid image. If the requested image does not exist, a placeholder is served. This prevents broken `<img>` tags in the UI.

### 2.5 Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| API Route | HTTP parsing, caching headers |
| Controller | Type validation, error handling |
| Service | Path resolution, fallback logic, file I/O |
| Repository | Database queries only |
| Frontend | URL construction only |

---

## 3. Phase 1: Critical Fixes

**Goal:** Fix all broken image types and URL construction bugs.
**Architecture Impact:** None — fixes within existing structure.
**Risk:** Low — isolated changes to individual files.

### 3.1 Files to Modify

#### 3.1.1 `src/backend/controllers/image-controller.ts`

**Current (line 12):**
```typescript
const type = ["poster", "backdrop", "library"].includes(typeParam)
  ? (typeParam as "poster" | "backdrop" | "library")
  : "poster";
```

**Change to:**
```typescript
const validTypes = ["poster", "backdrop", "library", "person", "still"] as const;
type ImageType = (typeof validTypes)[number];
const type: ImageType = validTypes.includes(typeParam as ImageType)
  ? (typeParam as ImageType)
  : "poster";
```

**Update the method signature and type annotation to accept `"person" | "still"`.**

#### 3.1.2 `src/backend/services/image-service.ts`

**Add new handler in `getImage()` for `type="person"` (before the poster/backdrop logic):**

```
if (type === "person") {
  // 1. Read profile_path from media_people table
  // 2. Construct TMDB image URL: https://image.tmdb.org/t/p/w500{profile_path}
  // 3. Download and serve (or serve placeholder)
}
```

**Add new handler for `type="still"`:**

```
if (type === "still") {
  // Still = backdrop of a specific episode
  // Use same logic as backdrop but look up the episode's backdrop_path
}
```

**Update `getDefaultImage()` to accept `"person"` and `"still"` types.**

#### 3.1.3 `src/backend/repositories/image-repository.ts`

**Add new method:**

```typescript
async getPersonImage(personId: number): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.get(
    "SELECT profile_path FROM media_people WHERE person_id = ?",
    [personId]
  );
  return row?.profile_path ?? null;
}
```

#### 3.1.4 `src/lib/frontend/image-helpers.ts`

**Fix `getLibraryImageUrl()` (line 36):**

```typescript
// Before (BROKEN):
return `/api/libraries/${id}/image`;

// After (CORRECT):
return `/api/images/${id}?type=library`;
```

#### 3.1.5 `src/backend/repositories/base-repository.ts`

**Fix library URL in `mapFields()` (line 144):**

```typescript
// Before (WRONG pattern):
result["imageUrl"] = `/api/images/library/${result["library_id"]}`;

// After (CORRECT pattern):
result["imageUrl"] = `/api/images/${result["library_id"]}?type=library`;
```

#### 3.1.6 `src/shared/constants/index.ts`

**Add `PERSON` and `STILL` to `DEFAULT_IMAGES`:**

```typescript
export const DEFAULT_IMAGES = {
  POSTER: "/assets/images/placeholders/poster.svg",
  BACKDROP: "/assets/images/placeholders/backdrop.svg",
  LIBRARY: "/assets/images/placeholders/library.svg",
  PERSON: "/assets/images/placeholders/person.svg",
  STILL: "/assets/images/placeholders/still.svg",
} as const;
```

#### 3.1.7 New Files: Placeholder SVGs

Create:
- `public/assets/images/placeholders/person.svg` — slate-colored silhouette
- `public/assets/images/placeholders/still.svg` — 16:9 aspect ratio placeholder

### 3.2 Phase 1 Completion Criteria

- [ ] `GET /api/images/{id}?type=person` returns the person's profile image
- [ ] `GET /api/images/{id}?type=still` returns the episode still image
- [ ] `getLibraryImageUrl()` returns a working URL
- [ ] `base-repository.ts` generates correct library URLs
- [ ] All 5 placeholder SVGs exist and are served correctly
- [ ] `tsc --noEmit` passes with no errors
- [ ] `npm run lint` shows no new errors

---

## 4. Phase 2: Path Unification

**Goal:** Make the storage root configurable and convert all paths to a consistent format.
**Architecture Impact:** Moderate — changes how paths are resolved and stored.
**Risk:** Medium — affects existing data; requires migration.

### 4.1 New Settings

Add to `src/backend/settings/settings-registry.ts`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `image_storage_root` | string | `"/assets/images/enriched"` | Base path for enriched images (web-relative) |
| `image_placeholder_dir` | string | `"/assets/images/placeholders"` | Base path for placeholder SVGs (web-relative) |

### 4.2 Path Resolution Refactor

**Current `resolveImagePath()`:**
```
if starts with "/" → process.cwd() + "public" + path
if relative → process.cwd() + "public" + path
if absolute → as-is
```

**New `resolveImagePath()`:**
```
Read image_storage_root from settings
if starts with "/" → process.cwd() + "public" + path
if relative → image_storage_root + "/" + path
if absolute → as-is (backward compatibility)
```

### 4.3 Scanner Path Normalization — SKIPPED (قرار)

**بترتيب التطوير:** تُترك مسارات الماسح المطلقة (`poster_path`/`backdrop_path`) كما هي تماماً.

- صور الماسح بجانب ملفات الميديا هي **الأولوية الثانية** وتعمل على نفس الجهاز بمسار مطلق — هذا سلوك مقصود.
- `image_storage_root` يخص **الأولوية الأولى فقط** (صور الإثراء المحلية) ولا علاقة له بمسارات الماسح.
- أي توحيد مستقبلي لمسارات الماسح يُؤجَّل مع Phase 3 (Dynamic Image Sources).

### 4.4 Build Script Fix — OUT OF SCOPE (مؤجل)

**بترتيب التطوير:** خارج نطاق المرحلة الحالية. ليس وقت تسليم — النظام ما زال قيد البناء
(خدمات وميزات قادمة). سيعاد تفعيل هذا البند مع Phase 4 (Production Hardening).

### 4.5 Settings Migration

**New migration file: `003_image_settings.sql`**

```sql
INSERT OR IGNORE INTO settings (key, value, category, data_type, description, is_secure)
VALUES
  ('image_storage_root', '/assets/images/enriched', 'storage', 'string', 'Base path for enriched images', 0),
  ('image_placeholder_dir', '/assets/images/placeholders', 'storage', 'string', 'Base path for placeholder SVGs', 0);
```

### 4.6 Phase 2 Completion Criteria

- [x] `image_storage_root` setting exists in DB and is readable
- [x] Enrichment (`_saveImage`) reads storage root from settings (لا مجلد ثابت)
- [x] `ImageService.resolveImagePath()` reads storage root from settings
- [x] `getDefaultImage()` reads placeholder dir from settings
- [x] New migration applies cleanly
- [x] Existing enriched images still work (backward compatibility)
- [x] Scanner absolute paths untouched (SKIPPED §4.3)
- [ ] `tsc --noEmit` passes
- [ ] `npm run lint` shows no new errors

---

## 5. Phase 3: Dynamic Image Sources

**Goal:** Image source priority order is stored in DB and configurable from admin UI.
**Architecture Impact:** High — new table, refactored service, new API endpoints, new UI.
**Risk:** High — core image resolution logic changes.

### 5.1 New Database Table

**`image_sources` table:**

```sql
CREATE TABLE image_sources (
  source_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('local', 'filesystem', 'remote', 'placeholder')),
  base_path TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  config_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Seed data:**

```sql
INSERT INTO image_sources (name, display_name, source_type, base_path, priority, is_active) VALUES
  ('enriched_local', 'الصور المُثخّنة', 'local', '/assets/images/enriched', 1, 1),
  ('media_folder', 'صور الميديا المحلية', 'filesystem', '', 2, 1),
  ('placeholder', 'الصورة الافتراضية', 'placeholder', '/assets/images/placeholders', 99, 1);
```

### 5.2 New Repository Methods

**`ImageSourceRepository` (new file):**

```typescript
class ImageSourceRepository {
  async getAll(): Promise<ImageSource[]>
  async getActive(): Promise<ImageSource[]>  // ordered by priority
  async create(source: CreateImageSourceInput): Promise<ImageSource>
  async update(sourceId: number, updates: Partial<ImageSource>): Promise<ImageSource>
  async delete(sourceId: number): Promise<void>
  async reorder(orderedIds: number[]): Promise<void>
}
```

### 5.3 Refactored ImageService

**Current `getImage()` logic:**
```
hardcoded: enriched → scanner → parent → placeholder
```

**New `getImage()` logic:**
```
sources = await imageSourceRepo.getActive()  // ordered by priority
for each source:
  path = resolveFromSource(source, mediaData)
  if path exists and file exists on disk:
    return readImageFile(path)
return getDefaultImage(type)
```

**`resolveFromSource()` mapping:**

| source_type | Resolution Logic |
|-------------|-----------------|
| `local` | Read `enriched_poster`/`enriched_backdrop` from DB, resolve relative to `base_path` |
| `filesystem` | Read `poster_path`/`backdrop_path` from DB (absolute paths), read directly |
| `placeholder` | Read SVG from `base_path` based on type |

### 5.4 New API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /api/image-sources` | GET | Admin | List all image sources |
| `POST /api/image-sources` | POST | Admin | Create a new source |
| `PUT /api/image-sources/{id}` | PUT | Admin | Update a source |
| `DELETE /api/image-sources/{id}` | DELETE | Admin | Delete a source |
| `PUT /api/image-sources/reorder` | PUT | Admin | Reorder sources by priority |

### 5.5 Admin UI

**New component: `src/features/admin/components/settings/image-sources-panel.tsx`**

Features:
- Drag-and-drop list of image sources (ordered by priority)
- Toggle active/inactive for each source
- Add new source (name, type, base path)
- Edit existing source
- Delete source (with confirmation)
- Preview: show which source would be used for a given media item

### 5.6 Phase 3 Completion Criteria

- [ ] `image_sources` table exists with seed data
- [ ] `ImageSourceRepository` provides full CRUD
- [ ] `ImageService.getImage()` iterates over `image_sources` by priority
- [ ] All 5 API endpoints work correctly
- [ ] Admin UI allows reordering sources
- [ ] Changing source order immediately affects image serving
- [ ] Backward compatibility: existing enriched/scanner images still work
- [ ] `tsc --noEmit` passes
- [ ] `npm run lint` shows no new errors

---

## 6. Phase 4: Production Hardening

**Goal:** Ensure images survive builds, deployments, and hardware failures.
**Architecture Impact:** Low — infrastructure changes, no code logic changes.
**Risk:** Low — additive changes.

### 6.1 Image Directory Verification

**On server startup, verify:**

```typescript
async function verifyImageDirectories(): Promise<void> {
  const dirs = [
    "public/assets/images/enriched/posters",
    "public/assets/images/enriched/backdrops",
    "public/assets/images/placeholders",
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}
```

### 6.2 Build Script Preservation

**Update `scripts/build-release.mjs`:**
- Remove deletion of `public/assets/images/enriched/`
- Copy enriched images to standalone output
- Verify placeholder SVGs are included

### 6.3 Image Health Check Endpoint

**New endpoint: `GET /api/images/health`** (admin only)

```typescript
// Checks:
// - All active image_sources have valid base_path directories
// - Enriched images exist on disk for items with enriched_poster/enriched_backdrop set
// - Placeholder SVGs exist and are readable
// - Returns count of healthy/unhealthy images
```

### 6.4 Backup Considerations

- Enriched images in `public/assets/images/enriched/` should be included in backup strategy
- Consider a separate backup for the `image_sources` table
- Document the recovery procedure for lost enriched images (re-run enrichment)

---

## 7. File Change Matrix

### Phase 1 (Critical Fixes)

| File | Action | Changes |
|------|--------|---------|
| `src/backend/controllers/image-controller.ts` | Modify | Add `person` and `still` to valid types |
| `src/backend/services/image-service.ts` | Modify | Add `person` and `still` handlers, update `getDefaultImage()` |
| `src/backend/repositories/image-repository.ts` | Modify | Add `getPersonImage()` method |
| `src/lib/frontend/image-helpers.ts` | Modify | Fix `getLibraryImageUrl()` return value |
| `src/backend/repositories/base-repository.ts` | Modify | Fix library URL pattern |
| `src/shared/constants/index.ts` | Modify | Add `PERSON` and `STILL` to `DEFAULT_IMAGES` |
| `public/assets/images/placeholders/person.svg` | Create | New placeholder SVG |
| `public/assets/images/placeholders/still.svg` | Create | New placeholder SVG |

### Phase 2 (Path Unification)

| File | Action | Changes |
|------|--------|---------|
| `src/backend/settings/settings-registry.ts` | Modify | Add `image_storage_root`, `image_placeholder_dir` |
| `src/backend/services/image-service.ts` | Modify | Read storage root + placeholder dir from settings |
| `src/backend/services/tmdb-enrichment-service.ts` | Modify | `_saveImage` reads storage root from settings (لا مجلد ثابت) |
| `src/backend/services/index.ts` | Modify | Inject `settingsService` into Image + Enrichment services |
| `src/backend/db/migrations/003_image_settings.sql` | Create | Migration for new settings |
| `src/shared/types/settings.ts` | Modify | Add new setting types (AdminSettings) |
| `src/backend/scanner/image-linker.service.ts` | SKIPPED | §4.3 قرار — مسارات الماسح تبقى مطلقة |
| `scripts/build-release.mjs` | OUT OF SCOPE | §4.4 مؤجل لـ Phase 4 |

### Phase 3 (Dynamic Image Sources)

| File | Action | Changes |
|------|--------|---------|
| `src/backend/db/schema.ts` | Modify | Add `DbImageSource` interface |
| `src/backend/repositories/image-source-repository.ts` | Create | Full CRUD for `image_sources` |
| `src/backend/services/image-service.ts` | Modify | Refactor to iterate over sources |
| `src/backend/controllers/image-source-controller.ts` | Create | API controller |
| `src/backend/controllers/index.ts` | Modify | Wire new controller |
| `src/backend/services/index.ts` | Modify | Wire new repository/service |
| `src/app/api/image-sources/route.ts` | Create | GET (list) + POST (create) |
| `src/app/api/image-sources/[id]/route.ts` | Create | PUT (update) + DELETE |
| `src/app/api/image-sources/reorder/route.ts` | Create | PUT (reorder) |
| `src/features/admin/components/settings/image-sources-panel.tsx` | Create | Admin UI |
| `src/backend/db/migrations/004_image_sources.sql` | Create | Table + seed data |

### Phase 4 (Production Hardening)

| File | Action | Changes |
|------|--------|---------|
| `scripts/build-release.mjs` | Modify | Copy enriched images to standalone |
| `src/app/api/images/health/route.ts` | Create | Health check endpoint |
| `src/backend/services/image-service.ts` | Modify | Add startup verification |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Test | Target | Phase |
|------|--------|-------|
| `getImage(type="person")` returns person profile | `image-service.ts` | 1 |
| `getImage(type="still")` returns episode still | `image-service.ts` | 1 |
| `resolveImagePath()` handles all path formats | `image-service.ts` | 2 |
| `getImage()` respects source priority order | `image-service.ts` | 3 |
| Deactivated source is skipped | `image-service.ts` | 3 |
| Placeholder served when all sources fail | `image-service.ts` | 1, 3 |

### 8.2 Integration Tests

| Test | Target | Phase |
|------|--------|-------|
| `GET /api/images/{id}?type=person` returns 200 | API route | 1 |
| `GET /api/images/{id}?type=still` returns 200 | API route | 1 |
| `POST /api/image-sources` creates new source | API route | 3 |
| `PUT /api/image-sources/reorder` updates priorities | API route | 3 |
| Image serving changes when source order changes | End-to-end | 3 |
| `GET /api/images/health` returns health status | API route | 4 |

### 8.3 Manual Verification Checklist

After each phase, verify:

- [ ] Poster images display correctly on all pages
- [ ] Backdrop images display correctly on all pages
- [ ] Person profile images display correctly
- [ ] Episode still images display correctly
- [ ] Library cover images display correctly
- [ ] Placeholder SVGs display when no image exists
- [ ] Admin dashboard shows correct images
- [ ] Search results show correct poster thumbnails
- [ ] Enrichment saves images to the correct directory
- [ ] Scanner discovers and stores images correctly

---

## 9. Risk Assessment

### Phase 1: Low Risk

- Isolated changes to individual files
- No database changes
- No existing behavior changes (only adds new capabilities)
- Backward compatible by design

### Phase 2: Medium Risk

- Changes path resolution logic
- Requires database migration
- Existing absolute paths from scanner need backward compatibility
- **Mitigation:** `resolveImagePath()` keeps absolute path handling as fallback

### Phase 3: High Risk

- Core image resolution logic changes fundamentally
- New database table affects all image serving
- Admin UI changes affect settings workflow
- **Mitigation:** Run Phase 3 alongside Phase 1+2 for extended testing period; keep fallback to hardcoded logic if `image_sources` table is empty

### Phase 4: Low Risk

- Infrastructure changes only
- No logic changes
- Additive (health check, backup, verification)

---

## Migration Notes

### Backward Compatibility

During Phase 2 and 3, the system must handle:

1. **Existing absolute paths** from scanner (e.g., `D:\media\Movies\poster.jpg`)
2. **Existing relative paths** from enrichment (e.g., `/assets/images/enriched/posters/550_poster.jpg`)
3. **Empty `image_sources` table** (fall back to hardcoded priority)
4. **Mixed path formats** in the same database

The `resolveImagePath()` method retains its three-way branching logic (starts with `/`, relative, absolute) throughout all phases.

### Rollback Strategy

Each phase is independently deployable and rollbackable:

- **Phase 1:** Revert controller and service changes
- **Phase 2:** Revert settings reads; paths remain hardcoded
- **Phase 3:** Revert service refactor; delete `image_sources` table; fall back to hardcoded priority

---

*This plan is a living document. Update it as implementation progresses and new requirements emerge.*
