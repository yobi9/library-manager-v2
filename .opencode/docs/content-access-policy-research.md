# خطة نظام حظر المحتوى بالتصنيفات العمرية

> **تاريخ الإنشاء:** 2026-08-20
> **الحالة:** خطة مُوافق عليها — جاهزة للتنفيذ
> **المبدأ:** أبسط نظام حظر ممكن — قائمة حظر عامة واحدة فقط

---

## 1. القاعدة الأساسية

```
parental_control_enabled = false  →  لا فلترة (كل المحتوى ظاهر)
parental_control_enabled = true:
    certification = null/empty     →  مسموح (unrated مسموح دائماً)
    certification ∈ blocklist      →  محظور (يُخفى من كل مكان)
    certification ∉ blocklist      →  مسموح
Admin                              →  يرى كل شيء دائماً (bypass كامل)
```

## 2. ما لا يشمله النظام (مما تم رفضه أو استبعاده)

- ❌ Per-user `max_content_rating` — مؤجل
- ❌ `allowed_certifications` — لا نستخدمه (القاعدة: blocklist فقط)
- ❌ `parental_control_strict_mode` — لا نستخدمه (unrated مسموح دائماً)
- ❌ Rating threshold / ranking — لا نحتاجه
- ❌ Library-level permissions — خارج النطاق
- ❌ Access schedules — خارج النطاق
- ❌ Tags-based filtering — لا يوجد tags system مستقل
- ❌ Child accounts — لا نحتاجه
- ❌ `block_adult_content` setting — مسار مستقل (TMDB enrichment safety)
- ❌ DB migrations — لا يوجد تغيير schema
- ❌ HSV skin-tone detection — تم رفضه سابقاً
- ❌ NSFW ML detection — خارج النطاق

## 3. الملفات المتأثرة — 18 ملف

### 3.1 ملفات جديدة (3)

| الملف | الوصف |
|-------|-------|
| `src/backend/services/content-access-policy.ts` | خدمة صغيرة (~60 سطر): `resolveBlockedCertifications()`, `shouldBlockMedia()`, `buildCertificationSqlFilter()` |
| `src/app/admin/parental/page.tsx` | صفحة إدارية جديدة — thin re-export |
| `src/features/admin/pages/parental-control-page.tsx` | واجهة الرقابة الأبوية: Switch + قائمة التصنيفات الجاهزة + chips |

### 3.2 ملفات معدّلة (15)

| # | الملف | التغيير المطلوب |
|---|-------|-----------------|
| 1 | `src/backend/settings/settings-registry.ts` | إضافة `parental_control_enabled` (boolean, default false) + `blocked_certifications` (json, default []) |
| 2 | `src/shared/types/settings.ts` | إضافة `parental_control_enabled?: boolean` + `blocked_certifications?: string[]` إلى `AdminSettings` |
| 3 | `src/shared/constants/index.ts` | إضافة `ADMIN_PARENTAL: "/admin/parental"` إلى `ROUTES` |
| 4 | `src/backend/services/index.ts` | DI wiring: إنشاء `ContentAccessPolicyService` + تمريرها إلى `MediaService` و `SearchService` |
| 5 | `src/backend/services/media-service.ts` | تعديل constructor (إضافة `policyService`) + تعديل ~8 list methods لتمرير `excludeCertifications` |
| 6 | `src/backend/services/search-service.ts` | تعديل constructor + `searchMedia()` + `liveSearch()` لتمرير `excludeCertifications` |
| 7 | `src/backend/repositories/media-repository.ts` | إضافة `excludeCertifications?: string[]` param في: `getLatestMedia`, `getPinnedItems`, `getMediaByFilter`, `getLibraryMediaFiltered`, `getRecommendations`, `batchGetByIds`, `getPersonWorks`, `getMediaChildren`/`getMergedChildren` |
| 8 | `src/backend/repositories/search-repository.ts` | إضافة `excludeCertifications?: string[]` في `searchMediaWithCount()` + `searchMedia()` |
| 9 | `src/backend/controllers/media-controller.ts` | تعديل methods لتقبل `auth?: AuthContext` وتُمرره للـ service |
| 10 | `src/app/api/media/[id]/route.ts` | GET handler: `parseAuthFromRequest` + فحص `shouldBlockMedia` → 404 |
| 11 | `src/app/api/media/[id]/stream/route.ts` | `parseAuthFromRequest` + فحص → 404 |
| 12 | `src/app/api/media/[id]/check/route.ts` | `parseAuthFromRequest` + فحص → 404 |
| 13 | `src/app/api/images/[id]/route.ts` | `parseAuthFromRequest` + فحص → 404 |
| 14 | `src/backend/services/cache-invalidator.ts` | `settings_updated` → يحذف `media` + `catalog` + `search` أيضاً |
| 15 | `src/shared/components/layout/admin-sidebar.tsx` | إضافة "الرقابة الأبوية" في قسم "إدارة المحتوى" |

### 3.3 ملفات لا يجب لمسها

| الملف | السبب |
|-------|-------|
| `src/backend/db/schema.ts` | لا يوجد تغيير schema |
| `src/backend/db/migrations/*.sql` | لا يوجد migration جديد |
| `src/proxy.ts` | لا علاقة له بـ content filtering |
| `src/app/(viewer)/layout.tsx` | ViewerAccessService مستقل |
| `src/backend/services/viewer-access-service.ts` | لا يتغير |
| `src/backend/services/cache-service.ts` | infrastructure لا يتغير |

---

## 4. التنفيذ بالتفصيل

### المرحلة 1: البنية التحتية (5 ملفات)

#### 1.1 `src/backend/settings/settings-registry.ts` — إعدادين جديدين

```typescript
{
  key: "parental_control_enabled",
  type: "boolean",
  defaultValue: false,
  category: "viewer",
  isPublic: false,
  description: "تفعيل حظر المحتوى بالتصنيفات العمرية.",
},
{
  key: "blocked_certifications",
  type: "json",
  defaultValue: [],
  category: "viewer",
  isPublic: false,
  description: "قائمة التصنيفات العمرية المحظورة — مصفوفة نصوص.",
},
```

#### 1.2 `src/shared/types/settings.ts` — إضافة إلى AdminSettings

```typescript
// في AdminSettings:
parental_control_enabled?: boolean;
blocked_certifications?: string[];
```

#### 1.3 `src/shared/constants/index.ts` — route جديد

```typescript
ADMIN_PARENTAL: "/admin/parental",
```

#### 1.4 `src/backend/services/content-access-policy.ts` — خدمة جديدة

```typescript
/**
 * خدمة سياسة الوصول للمحتوى — Phase 1: Global Blocklist فقط.
 *
 * الغرض: تحديد ما إذا كان محتوى معين يجب حظره بناءً على تصنيفه العمرية.
 *
 * @remarks
 * - Admin يرى كل شيء دائماً (bypass كامل)
 * - المحتوى بدون تصنيف (null/empty) مسموح دائماً
 * - لا يوجد per-user في هذه المرحلة
 */

import type { AuthContext } from "../api/route-helpers";

/** نتيجة تحليل سياسة الحظر للمحتوى. */
interface ContentFilter {
  /** هل الفلترة مفعّلة؟ */
  enabled: boolean;
  /** قائمة التصنيفات المحظورة (فارغة إذا غير مفعّل). */
  blockedCertifications: string[];
}

/**
 * تحديد قائمة التصنيفات المحظورة بناءً على حالة المدير والإعدادات.
 *
 * @param auth - سياق المصادقة (null للزائر).
 * @param settings - إعدادات النظام من قاعدة البيانات.
 * @returns ContentFilter يحدد ما إذا كانت الفلترة مفعّلة والتصنيفات المحظورة.
 */
export function resolveBlockedCertifications(
  auth: AuthContext | null,
  settings: Record<string, unknown>,
): ContentFilter {
  // Admin bypass — يرى كل شيء دائماً
  if (auth?.isAdmin) {
    return { enabled: false, blockedCertifications: [] };
  }
  // إذا كانت الرقابة الأبوية غير مفعّلة
  if (!settings.parental_control_enabled) {
    return { enabled: false, blockedCertifications: [] };
  }
  // قراءة القائمة المحظورة
  const blocked = settings.blocked_certifications;
  return {
    enabled: true,
    blockedCertifications: Array.isArray(blocked) ? (blocked as string[]) : [],
  };
}

/**
 * التحقق من ما إذا كان عنصر معين يجب حظره.
 *
 * @param certification - التصنيف العمرية للعنصر (قد يكون null/undefined).
 * @param filter - نتيجة تحليل السياسة.
 * @returns true إذا كان العنصر يجب حظره.
 */
export function shouldBlockMedia(
  certification: string | null | undefined,
  filter: ContentFilter,
): boolean {
  if (!filter.enabled) return false;
  // المحتوى بدون تصنيف مسموح دائماً
  if (!certification || certification.trim() === "") return false;
  return filter.blockedCertifications.includes(certification);
}

/**
 * بناء شرط SQL لاستبعاد التصنيفات المحظورة من الاستعلامات.
 *
 * @param filter - نتيجة تحليل السياسة.
 * @returns كائن يحتوي على شرط SQL + القيم المُمرَّرة، أو null إذا لا فلترة.
 */
export function buildCertificationSqlFilter(
  filter: ContentFilter,
): { clause: string; values: string[] } | null {
  if (!filter.enabled || filter.blockedCertifications.length === 0) return null;
  const placeholders = filter.blockedCertifications.map(() => "?").join(",");
  return {
    clause: `(m.certification NOT IN (${placeholders}) OR m.certification IS NULL OR m.certification = '')`,
    values: filter.blockedCertifications,
  };
}

export type { ContentFilter };
```

#### 1.5 `src/backend/services/cache-invalidator.ts` — تعديل

```typescript
// تغيير:
{
  event: "settings_updated",
  prefixes: [CachePrefixes.settings],
},
// إلى:
{
  event: "settings_updated",
  prefixes: [CachePrefixes.settings, CachePrefixes.media, CachePrefixes.catalog, CachePrefixes.search],
},
```

### المرحلة 2: Repository Layer (2 ملفات)

#### 2.1 `src/backend/repositories/media-repository.ts`

إضافة `excludeCertifications?: string[]` param إلى ~8 methods.

**النمط الموحد لكل method:**

```typescript
// مثال — getLatestMedia:
async getLatestMedia(type?: string, limit = 24, excludeCertifications?: string[]) {
  const db = await getDatabase();
  let whereClause = "WHERE m.is_available = 1 AND m.parent_media_id IS NULL";
  const params: unknown[] = [];

  if (type) {
    whereClause += " AND m.type = ?";
    params.push(type);
  }

  // === فلترة التصنيفات المحظورة ===
  if (excludeCertifications?.length) {
    const placeholders = excludeCertifications.map(() => "?").join(",");
    whereClause += ` AND (m.certification NOT IN (${placeholders}) OR m.certification IS NULL OR m.certification = '')`;
    params.push(...excludeCertifications);
  }

  return db.all(
    `SELECT m.*, ${GENRES_SUBQUERY}
     FROM media_items m
     ${whereClause}
     ORDER BY m.created_at DESC LIMIT ?`,
    [...params, limit],
  );
}
```

**الmethods المطلوب تعديلها:**

| Method | التعديل |
|--------|---------|
| `getLatestMedia(type?, limit?)` | إضافة `excludeCertifications?` |
| `getPinnedItems()` | إضافة `excludeCertifications?` |
| `getMediaByFilter(params)` | إضافة `excludeCertifications` إلى params |
| `getLibraryMediaFiltered(libraryId, options)` | إضافة `excludeCertifications` إلى options |
| `getRecommendations(mediaId, libraryId, type?, limit?)` | إضافة `excludeCertifications?` |
| `batchGetByIds(ids)` | إضافة `excludeCertifications?` |
| `getPersonWorks(personId)` | إضافة `excludeCertifications?` |
| `getMediaChildren(parentId)` | إضافة `excludeCertifications?` |
| `getMergedChildren(...)` | إضافة `excludeCertifications?` |

#### 2.2 `src/backend/repositories/search-repository.ts`

```typescript
// في searchMediaWithCount():
if (excludeCertifications?.length) {
  const placeholders = excludeCertifications.map(() => "?").join(",");
  whereParts.push(`(m.certification NOT IN (${placeholders}) OR m.certification IS NULL OR m.certification = '')`);
  filterParams.push(...excludeCertifications);
}

// في searchMedia():
if (excludeCertifications?.length) {
  const placeholders = excludeCertifications.map(() => "?").join(",");
  whereClause += ` AND (m.certification NOT IN (${placeholders}) OR m.certification IS NULL OR m.certification = '')`;
  params.push(...excludeCertifications);
}
```

### المرحلة 3: Service Layer (2 ملفات)

#### 3.1 `src/backend/services/media-service.ts`

```typescript
import { resolveBlockedCertifications, shouldBlockMedia, buildCertificationSqlFilter } from "./content-access-policy";
import type { ContentFilter } from "./content-access-policy";

export class MediaService {
  constructor(
    private mediaRepo: MediaRepository,
    private libraryRepo: LibraryRepository,
    private cache: CacheService,
    private settingsService: SettingsService,
    private activityRepo?: ActivityRepository,
    private searchRepo?: SearchRepository,
  ) {}

  // مثال — getLatestItems:
  async getLatestItems(type?: string, limit = 24, auth?: AuthContext) {
    const settings = await this.settingsService.getAllSettings();
    const filter = resolveBlockedCertifications(auth ?? null, settings);
    const blocked = filter.enabled ? filter.blockedCertifications : undefined;

    return this.cache.withCache(
      CachePrefixes.media,
      { type: "latest", mediaType: type ?? "all", limit, blocked },
      async () => {
        const items = await this.mediaRepo.getLatestMedia(type, limit, blocked);
        return items.map(processMediaItem);
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  // نفس النمط لكل list method: getPinnedItems, getMediaByFilter, getLibraryMedia,
  // getRecommendations, getMediaBatch, getPersonWorks, getMediaChildren
}
```

**ملاحظة مهمة:** `blocked` يجب أن يصبح جزءاً من cache key حتى لا تختلط النتائج.

#### 3.2 `src/backend/services/search-service.ts`

```typescript
export class SearchService {
  constructor(
    private searchRepo: SearchRepository,
    private cache: CacheService,
    private settingsService: SettingsService,
    private getIsScanActive?: () => boolean,
  ) {}

  async searchMedia(params: { q?: string; type?: string; libraryId?: number; year?: number; page?: number; limit?: number; auth?: AuthContext }) {
    const settings = await this.settingsService.getAllSettings();
    const filter = resolveBlockedCertifications(params.auth ?? null, settings);
    const blocked = filter.enabled ? filter.blockedCertifications : undefined;

    // pass blocked to searchRepo.searchMediaWithCount(...)
    // pass blocked to cache key
  }

  async liveSearch(query: string, limit = 8, auth?: AuthContext) {
    // نفس النمط
  }
}
```

### المرحلة 4: Controller + API Routes (5 ملفات)

#### 4.1 `src/backend/controllers/media-controller.ts`

```typescript
export class MediaController extends BaseController {
  constructor(
    private mediaService: MediaService,
    private viewService: ViewService,
  ) {
    super();
  }

  // تعديل كل method لتقبل auth:
  async getLatest(type?: string, limitStr?: string, auth?: AuthContext) {
    try {
      const limit = this.parseLimit(limitStr, 24);
      const items = await this.mediaService.getLatestItems(type, limit, auth);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMediaById(id: string, auth?: AuthContext) {
    try {
      const mediaId = this.parseId(id);
      const media = await this.mediaService.getMediaById(mediaId, auth);
      if (!media) return this.notFound("Media not found");
      return this.ok(media);
    } catch (err) {
      return this.handleError(err);
    }
  }

  // نفس النمط لـ: getPinned, getMediaByFilter, getRecommendations, etc.
}
```

#### 4.2 `src/app/api/media/[id]/route.ts` — GET

```typescript
export async function GET(request: NextRequest, { params }) {
  try {
    const auth = parseAuthFromRequest(request);
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.media.getMediaById(id, auth ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}
```

#### 4.3 `src/app/api/media/[id]/stream/route.ts`

```typescript
export async function GET(req: NextRequest, { params }) {
  try {
    const auth = parseAuthFromRequest(req);
    const { id } = await params;

    // فحص الحظر قبل البث
    const settings = await getServices().settings.getAllSettings();
    const filter = resolveBlockedCertifications(auth, settings);
    if (filter.enabled) {
      const media = await getServices().media.getMediaById(Number(id));
      if (media && shouldBlockMedia(media["certification"] as string | null, filter)) {
        return new Response("Not found", { status: 404 });
      }
    }

    // باقي كود البث الحالي...
    const result = await getControllers().media.getStreamTarget(id);
    // ...
  } catch (error) {
    return handleRouteError(error);
  }
}
```

#### 4.4 `src/app/api/media/[id]/check/route.ts`

```typescript
export async function GET(request: NextRequest, { params }) {
  try {
    const auth = parseAuthFromRequest(request);
    const { id } = await params;

    // فحص الحظر
    const settings = await getServices().settings.getAllSettings();
    const filter = resolveBlockedCertifications(auth, settings);
    if (filter.enabled) {
      const media = await getServices().media.getMediaById(Number(id));
      if (media && shouldBlockMedia(media["certification"] as string | null, filter)) {
        return new Response("Not found", { status: 404 });
      }
    }

    const c = getControllers();
    return toNextResponse(await c.media.checkPlayable(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
```

#### 4.5 `src/app/api/images/[id]/route.ts`

```typescript
export async function GET(request: NextRequest, { params }) {
  try {
    const auth = parseAuthFromRequest(request);
    const { id } = await params;

    // فحص الحظر
    const settings = await getServices().settings.getAllSettings();
    const filter = resolveBlockedCertifications(auth, settings);
    if (filter.enabled) {
      const media = await getServices().media.getMediaById(Number(id));
      if (media && shouldBlockMedia(media["certification"] as string | null, filter)) {
        return new Response("Not found", { status: 404 });
      }
    }

    // باقي كود الصور الحالي...
  } catch (error) {
    return handleRouteError(error);
  }
}
```

### المرحلة 5: Admin UI (3 ملفات + sidebar)

#### 5.1 `src/app/admin/parental/page.tsx`

```typescript
"use client";
export { ParentalControlPage as default } from "@/features/admin/pages/parental-control-page";
```

#### 5.2 `src/features/admin/pages/parental-control-page.tsx`

صفحة تتضمن:

**الجزء الأول — مفتاح التشغيل:**
- Switch لتفعيل/تعطيل `parental_control_enabled`
- وصف: "عند التفعيل، يُخفى المحتوى بالتصنيفات المحظورة من جميع المستخدمين (عدا المدير)"

**الجزء الثاني — قائمة التصنيفات المحظورة:**
- تجلب التصنيفات من `GET /api/media/certifications` (قائمة جاهزة من المكتبة)
- عرضها كقائمة قابلة للتحديد (checkboxes أو selectable chips)
- Admin يختار التصنيفات المحظورة
- حفظ عبر `apiPut("/api/settings", { parental_control_enabled, blocked_certifications })`

**النمط المتبوع:** نفس نمط `exclusive-page.tsx` — reads from `useAdminSettings()`, writes via `apiPut`.

#### 5.3 `src/shared/components/layout/admin-sidebar.tsx`

```typescript
// في قسم "إدارة المحتوى":
{
  title: "إدارة المحتوى",
  items: [
    { label: "ترتيب الأقسام", href: ROUTES.ADMIN_LIBRARIES, icon: ListOrdered },
    { label: "التحكم بالعناصر", href: ROUTES.ADMIN_MEDIA, icon: Sliders },
    { label: "الرقابة الأبوية", href: ROUTES.ADMIN_PARENTAL, icon: Shield },
  ],
},
```

### المرحلة 6: الاختبارات

#### 6.1 `src/tests/unit/content-access-policy.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveBlockedCertifications,
  shouldBlockMedia,
  buildCertificationSqlFilter,
} from "@/backend/services/content-access-policy";

describe("ContentAccessPolicy", () => {
  describe("resolveBlockedCertifications", () => {
    it("Admin bypass — يرى كل شيء دائماً", () => {
      const result = resolveBlockedCertifications(
        { userId: 1, username: "admin", isAdmin: true },
        { parental_control_enabled: true, blocked_certifications: ["R"] },
      );
      expect(result.enabled).toBe(false);
      expect(result.blockedCertifications).toEqual([]);
    });

    it("家长制 غير مفعّل — لا فلترة", () => {
      const result = resolveBlockedCertifications(
        { userId: 2, username: "user", isAdmin: false },
        { parental_control_enabled: false, blocked_certifications: ["R"] },
      );
      expect(result.enabled).toBe(false);
    });

    it("家长制 مفعّل — يُرجع القائمة المحظورة", () => {
      const result = resolveBlockedCertifications(
        { userId: 2, username: "user", isAdmin: false },
        { parental_control_enabled: true, blocked_certifications: ["R", "NC-17"] },
      );
      expect(result.enabled).toBe(true);
      expect(result.blockedCertifications).toEqual(["R", "NC-17"]);
    });

    it("زائر — يُطبَّق الفلترة", () => {
      const result = resolveBlockedCertifications(
        null,
        { parental_control_enabled: true, blocked_certifications: ["18+"] },
      );
      expect(result.enabled).toBe(true);
      expect(result.blockedCertifications).toEqual(["18+"]);
    });
  });

  describe("shouldBlockMedia", () => {
    it("家长制 غير مفعّل — لا يحظر", () => {
      const filter = { enabled: false, blockedCertifications: [] };
      expect(shouldBlockMedia("R", filter)).toBe(false);
    });

    it("تصنيف محظور — يحظر", () => {
      const filter = { enabled: true, blockedCertifications: ["R", "NC-17"] };
      expect(shouldBlockMedia("R", filter)).toBe(true);
    });

    it("تصنيف غير محظور — لا يحظر", () => {
      const filter = { enabled: true, blockedCertifications: ["R"] };
      expect(shouldBlockMedia("PG-13", filter)).toBe(false);
    });

    it("unrated (null) — مسموح دائماً", () => {
      const filter = { enabled: true, blockedCertifications: ["R"] };
      expect(shouldBlockMedia(null, filter)).toBe(false);
    });

    it("unrated (empty string) — مسموح دائماً", () => {
      const filter = { enabled: true, blockedCertifications: ["R"] };
      expect(shouldBlockMedia("", filter)).toBe(false);
    });
  });

  describe("buildCertificationSqlFilter", () => {
    it("家长制 غير مفعّل — null", () => {
      const filter = { enabled: false, blockedCertifications: [] };
      expect(buildCertificationSqlFilter(filter)).toBeNull();
    });

    it("قائمة فارغة — null", () => {
      const filter = { enabled: true, blockedCertifications: [] };
      expect(buildCertificationSqlFilter(filter)).toBeNull();
    });

    it("قائمة محظورة — يُرجع SQL clause", () => {
      const filter = { enabled: true, blockedCertifications: ["R", "NC-17"] };
      const result = buildCertificationSqlFilter(filter);
      expect(result).not.toBeNull();
      expect(result!.values).toEqual(["R", "NC-17"]);
      expect(result!.clause).toContain("NOT IN");
      expect(result!.clause).toContain("IS NULL");
    });
  });
});
```

#### 6.2 التحقق النهائي

```bash
npm run typecheck    # التحقق من الأنواع
npm run lint         # التحقق من الكود
npm test             # تشغيل الاختبارات
npm run build        # بناء الإنتاج
```

---

## 5. تدفق البيانات الكامل

```
┌─────────────────────────────────────────────────────────────┐
│ Admin يفعّل parental_control_enabled = true                  │
│ Admin يختار ["R", "NC-17", "18+"]                           │
│                                                              │
│ → PUT /api/settings { parental_control_enabled: true,       │
│                       blocked_certifications: ["R","NC-17","18+"] }│
│ → SettingsService → SQLite                                   │
│ → EventBus "settings_updated"                                │
│ → CacheInvalidator → media + catalog + search caches cleared │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ زائر يزور الصفحة الرئيسية                                    │
│ → GET /api/media/latest                                      │
│ → parseAuthFromRequest → null (visitor)                      │
│ → resolveBlockedCertifications(null, settings)               │
│   → { enabled: true, blocked: ["R","NC-17","18+"] }         │
│ → mediaRepo.getLatestMedia(type, limit, ["R","NC-17","18+"])│
│ → SQL: WHERE ... AND (m.certification NOT IN ('R','NC-17','18+') │
│        OR m.certification IS NULL OR m.certification = '')   │
│ → نتائج بدون محتوى محظور                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Admin يزور الصفحة نفسها                                      │
│ → parseAuthFromRequest → { isAdmin: true }                   │
│ → resolveBlockedCertifications → { enabled: false }          │
│ → mediaRepo.getLatestMedia(type, limit, undefined)           │
│ → كل المحتوى ظاهر                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ زائر يحاول الوصول المباشر لعنصر محظور                       │
│ → GET /api/media/42                                          │
│ → parseAuthFromRequest → null                                │
│ → getMediaById(42) → certification = "R"                    │
│ → shouldBlockMedia("R", filter) → true                       │
│ → Response: 404 Not found                                    │
│                                                              │
│ نفس الشيء: /stream, /check, /images                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. التحقق من الت_username_alignment مع معايير المشروع

- [x] TypeScript strict — لا يوجد `any`
- [x] TSDoc لكل دالة جديدة/معدّلة
- [x] Arabic comments في الكود
- [x] Tailwind v4 — لا arbitrary brackets
- [x] Server Components by default — `"use client"` فقط للتفاعل
- [x] Path aliases (`@/`, `@backend/`)
- [x] Import order: React/Next → 3rd-party → `@/*` → relative → type imports
- [x] kebab-case files, PascalCase components, UPPER_SNAKE_CASE constants
- [x] لا يوجد `require()` — فقط ES imports
- [x] لا يوجد dead code أو placeholder text
