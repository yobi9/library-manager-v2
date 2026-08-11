# Image System Architecture Audit

> **Audit Date:** 2026-08-04
> **Auditor:** opencode (AI)
> **Scope:** Complete image pipeline — storage, retrieval, serving, fallback, settings, production
> **Status:** Published

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Database Schema — Image Fields](#3-database-schema--image-fields)
4. [Backend Services](#4-backend-services)
5. [Controllers & API Routes](#5-controllers--api-routes)
6. [Frontend Image URL Construction](#6-frontend-image-url-construction)
7. [Settings System](#7-settings-system)
8. [Production & Deployment](#8-production--deployment)
9. [Identified Problems](#9-identified-problems)
10. [Gap Analysis](#10-gap-analysis)
11. [Recommendations Summary](#11-recommendations-summary)

---

## 1. Executive Summary

The image system serves media item posters, backdrops, library covers, person profiles, and episode stills through a single API endpoint (`/api/images/{id}`). Two image sources exist: TMDB-enriched images saved locally and scanner-discovered images from media folders. A cascading fallback ensures the API never returns 404.

**Critical findings:**

- `person` and `still` image types are broken (silently fall through to `poster`)
- `getLibraryImageUrl()` points to a non-existent route
- All image paths are hardcoded to `process.cwd()` with no configurable storage root
- Scanner stores absolute filesystem paths; enrichment stores web-relative paths — inconsistent
- `w=` and `h=` query parameters are accepted but completely ignored (no resize)
- S3 storage mode is declared in settings but never implemented
- `standalone` build does not include `public/` — enriched images are lost in production
- The build script (`build-release.mjs`) actively deletes enriched images

---

## 2. System Architecture Overview

### 2.1 Image Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     IMAGE SOURCES                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TMDB Enrichment                  Scanner (Image Linker)    │
│  ┌──────────────────┐             ┌──────────────────┐      │
│  │ Downloads from    │             │ Scans media dirs  │      │
│  │ image.tmdb.org    │             │ for poster/fanart │      │
│  │                   │             │                   │      │
│  │ Saves to:         │             │ Saves to:         │      │
│  │ public/assets/    │             │ poster_path =     │      │
│  │   enriched/       │             │   absolute path   │      │
│  │   posters/*.jpg   │             │ backdrop_path =   │      │
│  │   backdrops/*.jpg │             │   absolute path   │      │
│  └────────┬──────────┘             └────────┬──────────┘      │
│           │                                  │                 │
│           ▼                                  ▼                 │
│  enriched_poster =                poster_path =               │
│  "/assets/images/                "D:\media\Movies\            │
│   enriched/posters/               Film\poster.jpg"            │
│   550_poster_abc.jpg"                                           │
│                                                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (media_items)                      │
│  poster_path | backdrop_path | enriched_poster | enriched_   │
│                                          backdrop            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ImageService.getImage()                     │
│                                                              │
│  Priority 1: enriched_poster / enriched_backdrop             │
│  Priority 2: poster_path / backdrop_path                     │
│  Priority 3: cascade to parent_media_id (repeat 1+2)        │
│  Priority 4: placeholder SVG (never returns null)            │
│                                                              │
│  resolveImagePath() converts DB path → filesystem path       │
│  readImageFile() reads from disk + detects MIME type         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              GET /api/images/{id}?type=poster                 │
│                                                              │
│  Returns: Response(buffer, Content-Type, Cache-Control: 24h) │
│  Auth: None (public)                                         │
│  Never returns 404 — always returns image or placeholder     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 File Inventory

| Layer | File | Lines | Role |
|-------|------|-------|------|
| **API Route** | `src/app/api/images/[id]/route.ts` | 28 | HTTP handler — parses type, delegates to controller |
| **Controller** | `src/backend/controllers/image-controller.ts` | 22 | Validates type, delegates to service |
| **Service** | `src/backend/services/image-service.ts` | 141 | Core logic — cascading fallback, path resolution, file reading |
| **Repository** | `src/backend/repositories/image-repository.ts` | 54 | DB queries for image fields |
| **Frontend Helpers** | `src/lib/frontend/image-helpers.ts` | 37 | URL construction: `getPosterUrl()`, `getBackdropUrl()`, etc. |
| **Media Helpers** | `src/lib/frontend/media-helpers.ts` | 224 | `mapMediaToCard()`, `mapMediaToDetail()` — builds image URLs inline |
| **Constants** | `src/shared/constants/index.ts` | 63 | `DEFAULT_IMAGES` — client-side placeholder paths |
| **TMDB Enrichment** | `src/backend/services/tmdb-enrichment-service.ts` | 1073 | `_saveImage()` — downloads and stores enriched images |
| **Scanner** | `src/backend/scanner/image-linker.service.ts` | 149 | `linkImagesToMedia()` — discovers and stores scanner images |
| **Upload Route** | `src/app/api/enrich/upload-image/route.ts` | 13 | Admin endpoint for manual image upload |
| **Upload Controller** | `src/backend/controllers/enrichment-controller.ts` | 191 | `uploadImageFromUrl()` with SSRF protection |
| **Settings Registry** | `src/backend/settings/settings-registry.ts` | 510 | Defines `storage_mode`, `download_images`, `download_cast_images` |

---

## 3. Database Schema — Image Fields

### 3.1 Table: `media_items`

| Field | Type | Purpose | Source |
|-------|------|---------|--------|
| `poster_path` | `TEXT` | Scanner-discovered poster file path | `image-linker.service.ts` |
| `backdrop_path` | `TEXT` | Scanner-discovered backdrop file path | `image-linker.service.ts` |
| `enriched_poster` | `TEXT` | TMDB-downloaded poster (local save) | `tmdb-enrichment-service.ts` |
| `enriched_backdrop` | `TEXT` | TMDB-downloaded backdrop (local save) | `tmdb-enrichment-service.ts` |
| `logo_url` | `TEXT` | Logo URL (UNUSED in current code) | — |
| `clearart_url` | `TEXT` | Clearart URL (UNUSED in current code) | — |
| `thumb_url` | `TEXT` | Thumbnail URL (UNUSED in current code) | — |
| `artwork_saved_to_folder` | `INTEGER` | Artwork save flag (UNUSED) | — |
| `images_last_checked` | `TEXT` | Last image verification timestamp (UNUSED) | — |
| `parent_media_id` | `INTEGER` | Parent item for cascading fallback | Scanner / manual |

### 3.2 Table: `libraries`

| Field | Type | Purpose |
|-------|------|---------|
| `image` | `TEXT` | Library cover image path |

### 3.3 Table: `media_people`

| Field | Type | Purpose |
|-------|------|---------|
| `profile_path` | `TEXT` | TMDB person profile path (TMDB-relative, e.g. `/abc123.jpg`) |

### 3.4 Other Tables

| Table | Field | Purpose |
|-------|-------|---------|
| `news` | `image_url` | News article image |
| `ads` | `image_url` | Ad creative image (NOT NULL) |
| `store_products` | `image_url` | Product image |

### 3.5 Path Storage Inconsistency

| Source | Path Format | Example | Stored In |
|--------|-------------|---------|-----------|
| Scanner (image-linker) | **Absolute filesystem** | `D:\media\Movies\Film\poster.jpg` | `poster_path`, `backdrop_path` |
| Enrichment (local mode) | **Web-relative** | `/assets/images/enriched/posters/550_poster_abc.jpg` | `enriched_poster`, `enriched_backdrop` |
| Enrichment (media_folder) | **Absolute (forward slashes)** | `D:/media/Movies/Film/metadata/images/550_poster_abc.jpg` | `enriched_poster`, `enriched_backdrop` |
| Person profile | **TMDB-relative** | `/abc123.jpg` | `media_people.profile_path` |

`resolveImagePath()` in `image-service.ts` handles all three formats, but the inconsistency is fragile and makes migration to remote storage difficult.

---

## 4. Backend Services

### 4.1 ImageService (`image-service.ts`)

**Constructor:** `ImageService(imageRepo: ImageRepository)`

#### `getImage(id, type)` — lines 23-60

- Accepts `type: "poster" | "backdrop" | "library"` (default `"poster"`)
- Returns `Promise<{ buffer: Buffer; contentType: string }>` — **never null**
- For `library`: reads from `libraries.image` column
- For `poster`/`backdrop`: cascading loop through enriched → scanner → parent
- Falls back to `getDefaultImage()` (SVG placeholder)

#### `resolveImagePath(storedPath)` — lines 105-113

| Input Pattern | Resolution |
|---------------|------------|
| Starts with `/` | `process.cwd() + "/public" + storedPath.slice(1)` |
| Relative (no `/` prefix) | `process.cwd() + "/public" + storedPath` |
| Absolute (`C:\...` or `\\server\...`) | Used as-is |

**Hardcoded:** `process.cwd()`, `"public"`, `"assets"`, `"images"`, `"placeholders"`

#### `readImageFile(imagePath)` — lines 121-140

- Reads file via `fs.readFile()`
- MIME type from extension: `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`, `.gif` → `image/gif`, `.svg` → `image/svg+xml`
- Default MIME: `image/jpeg`
- Returns `null` on any error (swallowed in try/catch)

#### `getDefaultImage(type)` — lines 73-89

- Reads SVG from: `path.join(process.cwd(), "public", "assets", "images", "placeholders", fileName)`
- Last resort: inline SVG `<rect>` with `fill="#27272a"`

### 4.2 ImageRepository (`image-repository.ts`)

#### `getLibraryImage(libraryId)` — lines 4-11

```sql
SELECT image FROM libraries WHERE library_id = ?
```

#### `getMediaImage(mediaId, column)` — lines 13-19

```sql
SELECT ${column} FROM media_items WHERE media_id = ?
```

**Note:** Column name is string-interpolated (constrained to enum).

#### `getMediaImageData(mediaId)` — lines 30-53

```sql
SELECT poster_path, backdrop_path, enriched_poster, enriched_backdrop, parent_media_id
FROM media_items WHERE media_id = ?
```

Returns all 5 image fields in one query for the cascading fallback loop.

### 4.3 TMDB Enrichment — `_saveImage()` (`tmdb-enrichment-service.ts`)

**Lines 463-513.** Downloads an image from a URL and saves it locally.

**Filename:** `{media_id}_{label}_{md5hash-first-12-chars}{ext}`

**Two storage modes:**

| Mode | Target Directory | Path Stored in DB |
|------|-----------------|-------------------|
| `media_folder` | `{media_dir}/metadata/images/` | Absolute path (forward slashes) |
| `local` (default) | `public/assets/images/enriched/{type}/` | Web-relative: `/assets/images/enriched/{type}/{file}` |

**Deduplication:** If the file already exists on disk, download is skipped and the existing path is returned.

**SSRF Protection:** `isSafeImageUrl()` validates protocol (`http:`/`https:`) and blocks private IP ranges.

### 4.4 Scanner Image Linker (`image-linker.service.ts`)

**Lines 31-76.** Discovers images in media directories.

**Filename recognition:**

| Pattern | Type |
|---------|------|
| Contains `"poster"` | poster |
| Equals `"folder.jpg"` | poster |
| Equals `"cover.jpg"` | poster |
| Contains `"backdrop"` | backdrop |
| Contains `"fanart"` | backdrop |
| Equals `"background.jpg"` | backdrop |

**Fallback logic:**
- No backdrop found → backdrop = poster
- No poster found → poster and backdrop = first image found

**Path stored:** Absolute filesystem path (e.g., `D:\media\Movies\Film\poster.jpg`)

**Overwrite protection:** Does not overwrite `enriched_poster`/`enriched_backdrop` (checked via `isEnrichedPath()`).

---

## 5. Controllers & API Routes

### 5.1 Image API — `GET /api/images/{id}`

**Route:** `src/app/api/images/[id]/route.ts` (28 lines)

| Parameter | Source | Default |
|-----------|--------|---------|
| `id` | URL path param | Required |
| `type` | Query param `?type=` | `"poster"` |
| `w` | Query param `?w=` | Ignored (not used by backend) |
| `h` | Query param `?h=` | Ignored (not used by backend) |

**Auth:** None (public endpoint)
**Cache:** `public, max-age=86400` (24 hours)
**Response:** Raw image bytes with `Content-Type` header

### 5.2 Image Controller — `ImageController.getImage(id, typeParam)`

**File:** `src/backend/controllers/image-controller.ts` (22 lines)

**Type validation (line 12):**
```typescript
const type = ["poster", "backdrop", "library"].includes(typeParam)
  ? (typeParam as "poster" | "backdrop" | "library")
  : "poster";
```

**Bug:** `person`, `still`, and any unrecognized type silently default to `"poster"`.

### 5.3 Upload Image API — `POST /api/enrich/upload-image`

**Route:** `src/app/api/enrich/upload-image/route.ts` (13 lines)

**Auth:** Admin only (`requireAdmin`)
**Body:** `{ mediaId, imageUrl, type: "poster" | "backdrop", storageMode }`

**Flow:** Controller → SSRF validation → `TmdbEnrichmentService.uploadImageFromUrl()` → `_saveImage()` → DB update

### 5.4 `getLibraryImageUrl()` — BROKEN

**File:** `src/lib/frontend/image-helpers.ts` line 36

```typescript
return `/api/libraries/${id}/image`;
```

**No matching route exists.** Library images are served through `/api/images/{id}?type=library`. This function generates a dead URL.

### 5.5 `base-repository.ts` — Library URL Inconsistency

**File:** `src/backend/repositories/base-repository.ts` line 144

```typescript
result["imageUrl"] = `/api/images/library/${result["library_id"]}`;
```

This generates `/api/images/library/123` which does not match the image route pattern `/api/images/{id}?type=library`. The dynamic route expects `{id}` not `library/{id}`.

---

## 6. Frontend Image URL Construction

### 6.1 Centralized Helpers (`image-helpers.ts`)

| Function | Output |
|----------|--------|
| `getImageUrl(id, type, options?)` | `/api/images/{id}?type={type}&w={w}&h={h}` |
| `getPosterUrl(id)` | `/api/images/{id}?type=poster&w=300&h=450` |
| `getBackdropUrl(id)` | `/api/images/{id}?type=backdrop&w=1920&h=1080` |
| `getEpisodeStillUrl(id, opts?)` | `/api/images/{id}?type=still&w=640&h=360` |
| `getLibraryImageUrl(libraryId)` | `/api/libraries/{id}/image` **(BROKEN)** |

### 6.2 Inline URL Construction (Not Using Helpers)

| Component | File | Line | Pattern |
|-----------|------|------|---------|
| `mapMediaToCard()` | `media-helpers.ts` | 130 | `/api/images/${numId}?type=poster&w=300&h=450` |
| `mapMediaToDetail()` | `media-helpers.ts` | 165-168 | Inline poster + backdrop URLs |
| `media-card.tsx` | `media-card.tsx` | 178 | `/api/images/${id}?type=poster` |
| `person-detail-page.tsx` | `person-detail-page.tsx` | 14 | `/api/images/${id}?type=person` |
| `people-directory-page.tsx` | `people-directory-page.tsx` | 13 | `/api/images/${id}?type=person` |
| `item-detail-page.tsx` | `item-detail-page.tsx` | 425, 463 | `?type=person`, `?type=poster` |
| `hero.tsx` | `hero.tsx` | 22 | `/api/images/${mediaId}?type=backdrop` |
| `dashboard-page.tsx` | `dashboard-page.tsx` | 97, 120, 144 | `?type=library`, `?type=poster` |
| `ItemManagementDialog.tsx` | `ItemManagementDialog.tsx` | 366 | `?type=${type}` |
| `ItemControlCard.tsx` | `ItemControlCard.tsx` | 92 | `?type=poster` |
| `media-selector-modal.tsx` | `media-selector-modal.tsx` | 43 | `?type=poster` |
| `exclusive-manager.tsx` | `exclusive-manager.tsx` | 30 | `?type=poster` |
| `exclusive-form-modal.tsx` | `exclusive-form-modal.tsx` | 131 | `?type=poster` |
| `search-service.ts` | `search-service.ts` | 110, 153 | `?type=poster` (live search) |
| `base-repository.ts` | `base-repository.ts` | 144 | `/api/images/library/${id}` |

**16 locations** construct image URLs. Only 3 use the centralized helpers.

### 6.3 Client-Side Fallbacks (`DEFAULT_IMAGES`)

```typescript
export const DEFAULT_IMAGES = {
  POSTER: "/assets/images/placeholders/poster.svg",
  BACKDROP: "/assets/images/placeholders/backdrop.svg",
  LIBRARY: "/assets/images/placeholders/library.svg",
} as const;
```

Used in `library-card.tsx` and `sections-grid.tsx` with `<img onError>` handlers. Server-side also has its own fallback to the same SVGs — redundant dual fallback.

---

## 7. Settings System

### 7.1 Image-Related Settings

| Key | Type | Default | Registry Line | Purpose |
|-----|------|---------|---------------|---------|
| `storage_mode` | enum: `local`, `s3`, `both` | `"local"` | 313-319 | Where enriched images are stored |
| `download_images` | boolean | `false` | 322-327 | Download poster/backdrop during enrichment |
| `download_cast_images` | boolean | `false` | 330-335 | Download cast person images during enrichment |

### 7.2 Settings Flow

```
Admin UI (EnrichmentOptionsPanel)
  → POST /api/settings
    → SettingsController.update()
      → SettingsService.updateSettings()
        → validateSetting(key, value)  [registry]
        → upsertSetting(key, value)    [repository → DB]
        → eventBus.emit("settings_updated", { key, value })
```

### 7.3 What Is NOT Configurable

- Image storage root path (hardcoded to `process.cwd() + "/public/assets/images/enriched/"`)
- Image dimensions / quality
- Placeholder SVG paths
- Number or order of image sources (priority is hardcoded in `ImageService`)
- Remote image source configuration (TMDB base URL)

---

## 8. Production & Deployment

### 8.1 Build Configuration

| Setting | Value | Impact |
|---------|-------|--------|
| `output: "standalone"` | `next.config.ts:35` | `public/` directory NOT included in standalone build |
| `images.remotePatterns` | `[]` (empty) | Next.js `<Image>` cannot serve remote URLs |
| `images.formats` | `["image/avif", "image/webp"]` | Irrelevant — images served through custom API, not Next.js Image |

### 8.2 `build-release.mjs` — Enriched Images Deleted

**Lines 134-146:** The build script actively cleans `public/assets/images/enriched/`:

```javascript
// cleaned (standalone copy): public\assets\images\enriched
```

Every production build destroys all TMDB-enriched images. See `docs/INSTALLER.md` for build data separation concerns.

### 8.3 Standalone Launcher

```javascript
// standalone-launcher.js
// Loads .env.local then .env.production into process.env
// Then requires server.js
```

The launcher sets environment variables but does NOT ensure image directories exist.

### 8.4 Missing Infrastructure

- **No Dockerfile** or docker-compose
- **No installer script** for image directories
- **No backup strategy** for enriched images
- **No image processing library** (sharp, jimp, etc.) installed
- **No health check** for image availability

### 8.5 Windows-Native Deployment

The project uses a Windows-native deployment model:
- Inno Setup installer
- NSSM service runner
- Bundled `node.exe` v22.18.0
- No Linux/Docker support

---

## 9. Identified Problems

### 9.1 Critical Bugs

| # | Problem | File:Line | Impact |
|---|---------|-----------|--------|
| C1 | `type=person` silently falls through to `poster` — person images never displayed | `image-controller.ts:12` | All person profile images broken |
| C2 | `type=still` silently falls through to `poster` — episode stills never displayed | `image-controller.ts:12` | Episode still images broken |
| C3 | `getLibraryImageUrl()` returns `/api/libraries/{id}/image` — route does not exist | `image-helpers.ts:36` | Library images via this helper broken |
| C4 | `base-repository.ts` generates `/api/images/library/{id}` — wrong pattern | `base-repository.ts:144` | Library images via `mapFields()` broken |

### 9.2 Design Flaws

| # | Problem | File:Line | Impact |
|---|---------|-----------|--------|
| D1 | All paths hardcoded to `process.cwd()` — no configurable storage root | `image-service.ts:79,107,111` | Cannot change storage location without code changes |
| D2 | Scanner stores absolute paths; enrichment stores relative paths | DB schema | Fragile `resolveImagePath()`, hard to migrate |
| D3 | `w=` and `h=` query params completely ignored | `image-service.ts` | No server-side resizing, wasted bandwidth |
| D4 | No `sharp` or image processing library | `package.json` | Cannot resize, compress, or convert images |
| D5 | `storage_mode: "s3"` in settings but no S3 implementation | `tmdb-enrichment-service.ts:463` | Setting is misleading, S3 never works |
| D6 | 5 dead columns in `media_items` (logo_url, clearart_url, thumb_url, etc.) | `schema.ts:94-100,117` | Schema bloat, confusion |

### 9.3 Production Risks

| # | Problem | File:Line | Impact |
|---|---------|-----------|--------|
| P1 | `standalone` build excludes `public/` — enriched images lost | `next.config.ts:35` | Production deployment loses all enriched images |
| P2 | `build-release.mjs` deletes `public/assets/images/enriched/` | `scripts/build-release.mjs:135` | Every build destroys enriched images |
| P3 | No backup strategy for enriched images | — | Images permanently lost on disk failure |
| P4 | No Dockerfile — Windows-only deployment | — | Cannot deploy to Linux/cloud |

### 9.4 Consistency Issues

| # | Problem | File:Line | Impact |
|---|---------|-----------|--------|
| E1 | Image URL construction scattered across 16 locations | Multiple files | Maintenance nightmare |
| E2 | `DEFAULT_IMAGES` duplicated (constants + inline SVG in service) | `constants/index.ts` + `image-service.ts:85` | Two sources of truth |
| E3 | `ImageController` unreachable `!result` check | `image-controller.ts:16` | Dead code — `getImage()` never returns null |

---

## 10. Gap Analysis

### Current vs. Desired State

| Capability | Current | Desired | Gap |
|-----------|---------|---------|-----|
| Configurable storage root | Hardcoded `process.cwd()` | Setting in DB | **No setting exists** |
| Dynamic image sources | 2 hardcoded sources | N sources in DB table | **No `image_sources` table** |
| Change sources from UI | Impossible | Admin settings page | **No UI or API** |
| Person images | Broken (falls to poster) | Full support via `media_people.profile_path` | **No handler in service** |
| Episode stills | Broken (falls to poster) | Full support via child `backdrop_path` | **No handler in service** |
| Image resize | Ignored (`w=`, `h=` params unused) | Server-side resize via sharp | **No resize logic** |
| S3 storage | Declared in settings, not implemented | Full S3 support | **No S3 code** |
| Consistent path format | Absolute + relative mixed | Unified format | **No migration** |
| Placeholder configuration | Hardcoded SVG paths | Configurable per-type | **No setting** |
| Image health checks | None | Periodic verification | **No mechanism** |

---

## 11. Recommendations Summary

### Immediate (Phase 1 — No Architecture Change)

1. Add `person` and `still` type handlers in `ImageService` and `ImageController`
2. Fix `getLibraryImageUrl()` to return correct route pattern
3. Fix `base-repository.ts` library URL generation
4. Add `PERSON` and `STILL` to `DEFAULT_IMAGES` constants
5. Create `person.svg` and `still.svg` placeholder files

### Short-Term (Phase 2 — Path Unification)

6. Add `image_storage_root` setting to settings registry
7. Make `ImageService` read storage root from settings instead of `process.cwd()`
8. Convert scanner absolute paths to web-relative paths on save
9. Add migration for new settings
10. Fix `build-release.mjs` to preserve enriched images

### Long-Term (Phase 3 — Dynamic Architecture)

11. Create `image_sources` database table with priority ordering
12. Refactor `ImageService.getImage()` to iterate over `image_sources`
13. Create admin UI for managing image sources
14. Consider adding `sharp` for server-side resize
15. Evaluate S3 implementation if needed

---

*This audit is the single source of truth for the image system architecture. Update this document when any of the audited files change.*

---

## 12. Status Update — 2026-08-06

> Resolves findings **D1** (configurable storage root) and the person-image consistency
> issues documented in §3.3/§9. Deferred: dynamic `image_sources` (Phase 3) and S3.

### 12.1 External Storage Relocation

- **Migration `004_external_image_storage.sql`** sets the `image_storage_root` setting to
  `D:\assets\images\enriched` (absolute, outside the project) and the **settings registry
  default** matches. Idempotent (`UPDATE` + `INSERT OR IGNORE`).
- **DB-stored paths are unchanged** — `enriched_poster`/`enriched_backdrop`/`profile_path`
  keep the web-relative form `/assets/images/enriched/...`. `ImageService.resolveImagePath()`
  maps that prefix to the absolute root when the setting is absolute (`path.isAbsolute`).
- **Write path:** `TmdbEnrichmentService._saveImage()` writes to the absolute root (under
  `posters/` / `backdrops/`) and still stores web-relative paths in the DB via the exported
  `ENRICHED_WEB_PREFIX` constant. New enrichments therefore persist to the external drive.
- **Windows absolute-path fix:** Node's `path.isAbsolute("/assets/...")` returns `true` on
  Windows (root-relative), which made the first branch of `resolveImagePath` return the
  web-relative string as-is and break reads from external storage. Replaced with
  `isAbsoluteDiskPath()` — matches only drive-letter (`C:\...`) and UNC (`\\server\...`).
- The source tree `public/assets/images/enriched/` (61,448 files / 1,844,800,039 bytes) was
  moved to `D:\assets\images\enriched` after verifying byte-identical copy via robocopy.

### 12.2 Person Profile-Path Normalization

`media_people.profile_path` is duplicated across rows (one per role) and could diverge
(hash/date conflicts) or point at missing files; `MAX(profile_path)` (textual) may pick a
broken path. `scripts/normalize-person-images.mjs` resolves a single best value per person —
newest existing local file → TMDB-raw ref (CDN) → `NULL` — and writes it to **every** row of
that person. Dry-run by default; `--apply` writes a DB backup to `data/backups/` first.

**Result (idempotent, re-runs report 0 changes):**

| Metric | Before | After |
|--------|-------:|------:|
| Persons with `profile_path` | 52,742 | 51,981 |
| Persons with conflicting values (2+) | 570 | 0 |
| Distinct broken local paths | 778 | 0 |
| Persons unified → `NULL` (no viewable file) | — | 761 |

### 12.3 Verified Runtime Behavior

- `GET /api/images/2?type=person` → `image/jpeg` read from `D:\assets\images\enriched`
- `GET /api/images/471?type=poster|backdrop` → `image/jpeg` from external storage
- `GET /api/images/3774?type=person` (TMDB-raw ref) → `image/jpeg` via CDN fallback
- `GET /api/images/40024?type=person` (`NULL` path) → placeholder SVG (never 404)

### 12.4 Incidental Fix

- `src/features/viewer/pages/item-detail-page.tsx:73` — removed a stray backtick
  (`))``}`) that broke JSX parsing and failed `tsc`.
