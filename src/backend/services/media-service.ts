import { MediaRepository, MERGABLE_ROOT_TYPES } from "../repositories/media-repository";
import { LibraryRepository } from "../repositories/library-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SearchRepository } from "../repositories/search-repository";
import { SettingsService } from "./settings-service";
import fs from "fs/promises";
import path from "path";
import { getEventBus } from "./event-bus";
import { CacheService } from "./cache-service";
import { CachePrefixes } from "./cache-prefixes";
import { traceGenresHealth } from "../observability/genres-trace";
import {
  buildMediaListScope,
  getPaginationSkewTracker,
  type MediaListTraceOptions,
} from "../observability/pagination-trace";
import { resolveBlockedCertifications, shouldBlockMedia } from "./content-access-policy";
import type { AuthContext } from "../api/route-helpers";
import {
  CREW_ROLE_PRIORITY,
  ESSENTIAL_CREW_ROLES,
  type EssentialCrewRole,
} from "@/shared/constants/crew-roles";

function processMediaItem(item: Record<string, unknown>) {
  const result = { ...item };
  result["id"] = item["media_id"] ?? item["id"];
  result["display_title"] = item["title"] ?? "";
  if (item["imdb_rating"] !== undefined && item["imdb_rating"] !== null) {
    result["imdb_rating"] = Number(item["imdb_rating"]);
  }
  return result;
}

/**
 * يمرر صفحة قائمة مخدومة إلى متتبع انحراف لقطة الترقيم (تطوير فقط).
 *
 * @remarks تُستدعى بعد الحل من الكاش لتشمل الإصابات والطزاجة معاً؛ تستخرج
 *          حقول الترقية ومعرّفي أول/آخر عنصر دفاعياً من الاستجابة، ولا تفعل
 *          شيئاً إذا غابت `pagination.total` (استجابة غير متوقعة الشكل).
 *          لا أثر في الإنتاج لأن المتتبع يتوقف عند `logger.enabled === false`.
 *
 * @param libraryId - معرف المكتبة صاحبة القائمة.
 * @param options - خيارات القائمة كما وردت للخدمة (تدخل بصمة الهوية).
 * @param blockedCertificationsCount - عدد التصنيفات المحظورة المطبقة.
 * @param result - استجابة `getLibraryMedia` كما عادت من الكاش.
 */
function tracePaginationPage(
  libraryId: number,
  options: MediaListTraceOptions,
  blockedCertificationsCount: number,
  result: unknown,
): void {
  const pagination = (
    result as { pagination?: { total?: unknown; offset?: unknown } } | null | undefined
  )?.pagination;
  if (!pagination || typeof pagination.total !== "number") return;

  const items =
    (result as { items?: Array<Record<string, unknown>> | undefined }).items ?? [];
  const idOf = (item: Record<string, unknown> | undefined): number | null => {
    const id = item?.["media_id"] ?? item?.["id"];
    return typeof id === "number" ? id : null;
  };

  getPaginationSkewTracker().observePage({
    libraryId,
    scope: buildMediaListScope(options, blockedCertificationsCount),
    offset: typeof pagination.offset === "number" ? pagination.offset : 0,
    total: pagination.total,
    count: items.length,
    firstId: idOf(items[0]),
    lastId: idOf(items.at(-1)),
  });
}

/**
 * TTL (بالثواني) لقراءات التفاصيل الثقيلة لعنصر واحد (Phase 4).
 *
 * @remarks مفصّل عنصر (وسائط + أبناؤه + الأنواع + الأبطال + الملفات + المكتبة)
 *          مكلف: استعلامات متوازية متعددة. الكاش 300 ثانية كشبكة أمان فقط —
 *          الطزاجة الحقيقية من `CacheInvalidator` (يُبطَل فوراً عند
 *          `media_updated` / `media_deleted` / `metadata_completed`).
 */
const MEDIA_DETAIL_CACHE_TTL_SECONDS = 300;

/**
 * TTL (بالثواني) لقوائم الوسائط والفلترة والتوصيات (Phase 4).
 *
 * @remarks بادئة `media` تُبطَل عند أي تعديل/حذف/إثراء/مسح، لذا 60 ثانية
 *          شبكة أمان للمحتوى المتغير (قوائم الأدمن والفلاتر) مع طزاجة مقبولة.
 */
const MEDIA_LIST_CACHE_TTL_SECONDS = 60;

/**
 * TTL (بالثواني) للتصنيفات والأشخاص (Phase 6).
 *
 * @remarks بادئة `catalog` تُبطَل عند أي `media_updated` / `media_deleted` /
 *          `metadata_completed` / `scan_completed`، لذا 300 ثانية شبكة أمان كافية
 *          لهذه القراءات منخفضة التغير (أنواع/سنوات/أشخاص/أعمال شخص).
 */
const TAXONOMY_CACHE_TTL_SECONDS = 300;

export class MediaService {
  constructor(
    private mediaRepo: MediaRepository,
    private libraryRepo: LibraryRepository,
    private cache: CacheService,
    private settingsService: SettingsService,
    private activityRepo?: ActivityRepository,
    private searchRepo?: SearchRepository,
  ) {}

  /**
   * قراءة الإعدادات وتحديد التصنيفات المحظورة للمستخدم الحالي.
   *
   * @param auth - سياق المصادقة (null للزائر).
   * @returns مصفوفة التصنيفات المحظورة (فارغة إذا لا فلترة).
   */
  private async getBlockedCertifications(auth?: AuthContext | null): Promise<string[]> {
    const settings = await this.settingsService.getAllSettings();
    const filter = resolveBlockedCertifications(auth ?? null, settings);
    return filter.enabled ? filter.blockedCertifications : [];
  }

  /**
   * Retrieves a single media item by its ID, including its children (e.g., seasons of a series),
   * its genres and the people (cast + crew) rows.
   *
   * @param id - The media item ID.
   * @returns The processed media item with `library_name`, `children` array, `genres`
   *          (array of genre names), `people` (raw media_people rows), `cast` (actors only)
   *          and `crew` (every non-actor person), or `null` if not found.
   *          Each child is processed through `processMediaItem`.
   */
  async getMediaById(id: number, auth?: AuthContext) {
    return this.cache.withCache(
      CachePrefixes.mediaDetail,
      { id, auth: auth ? { userId: auth.userId, isAdmin: auth.isAdmin } : undefined },
      async () => {
        const media = (await this.mediaRepo.getById(id)) as Record<string, unknown> | undefined;
        if (!media) return null;
        const settings = await this.settingsService.getAllSettings();
        const certFilter = resolveBlockedCertifications(auth ?? null, settings);
        if (shouldBlockMedia(media["certification"] as string | null | undefined, certFilter)) return null;
        const processed = processMediaItem(media);
        const isRootMergable =
          media["parent_media_id"] == null && MERGABLE_ROOT_TYPES.has(media["type"] as string);
        const [children, genres, people, files] = await Promise.all([
          isRootMergable
            ? this.mediaRepo.getMergedChildren(
                id,
                media["library_id"] as number,
                media["type"] as string,
                media["normalized_title"] as string | null,
              )
            : this.mediaRepo.getMediaChildren(id),
          this.mediaRepo.getGenresForMedia(id),
          this.mediaRepo.getPeopleByMediaId(id),
          this.mediaRepo.getMediaFiles(id),
        ]);
        processed["children"] = children.map(processMediaItem);
        processed["genres"] = (genres as Array<{ genre: string }>).map((g) => g.genre);
        processed["people"] = people;
        // Cast = viewer-friendly projection of `people` filtered to real actors only.
        // Enrichment stores actors with `role: "Actor"` / `department: "Acting"`, while
        // every crew member keeps its own role (Director, Writer, ...) and department.
        // The frontend (`MediaItem.cast`) reads `person_id`, `name`, `display_name`,
        // `character`, `profile_path`, `role`, `order`.
        processed["cast"] = people
          .filter((p) => p.role === "Actor")
          .map((p) => ({
            person_id: p.person_id,
            name: p.name,
            display_name: p.name,
            character: p.character,
            profile_path: p.profile_path,
            role: p.role,
            department: p.department,
            order: p.importance_order,
          }));
        // Crew = essential crew only (Director, Writer, Screenplay, Story, Producer,
        // Assistant Director). Technical teams (camera, sound, stunts, art, ...) stay in
        // `people`/`media_people` for the admin but are NOT exposed to the public viewer.
        // Ordering = role priority (Director → Writer → Producer → Assistant Director),
        // then `importance_order` for stability.
        const crewRoleSet = new Set<string>(ESSENTIAL_CREW_ROLES);
        processed["crew"] = people
          .filter((p) => p.role !== "Actor" && crewRoleSet.has(p.role))
          .sort((a, b) => {
            const pa = CREW_ROLE_PRIORITY[a.role as EssentialCrewRole] ?? 99;
            const pb = CREW_ROLE_PRIORITY[b.role as EssentialCrewRole] ?? 99;
            return pa - pb || a.importance_order - b.importance_order;
          })
          .map((p) => ({
            person_id: p.person_id,
            name: p.name,
            display_name: p.name,
            character: p.character,
            profile_path: p.profile_path,
            role: p.role,
            department: p.department,
            order: p.importance_order,
          }));

        const firstFile = (files[0] as { file_path?: string } | undefined) ?? undefined;
        let folderPath: string | null = null;
        let folderSource: "directory-path" | "file-dirname" | "library-path" | "none" = "none";

        // 1. Authoritative: the item's own folder. The scanner stores the real
        //    folder — containers get `item.path`, current leaf items get
        //    `item.parentPath` — but some legacy leaf rows hold the media file
        //    path itself, so normalize a media-file path to its containing folder.
        const ownDir = processed["directory_path"];
        if (typeof ownDir === "string" && ownDir.trim()) {
          const ext = path.extname(ownDir).toLowerCase();
          const isMediaFile = this.getMimeType(ext) !== "application/octet-stream";
          folderPath = isMediaFile ? path.dirname(ownDir) : ownDir;
          folderSource = "directory-path";
        }

        if (processed["library_id"]) {
          const lib = (await this.libraryRepo.getById(processed["library_id"] as number)) as
            Record<string, unknown> | undefined;
          processed["library_name"] = lib?.["name"] ?? "Unknown";

          // 2. Fallback — the first file's parent folder (legacy rows without a
          //    directory path).
          if (!folderPath && firstFile?.file_path) {
            const dir = path.dirname(firstFile.file_path);
            if (dir && dir !== ".") {
              folderPath = dir;
              folderSource = "file-dirname";
            }
          }

          // 3. Last resort — the library's first configured path.
          if (!folderPath && typeof lib?.["paths"] === "string") {
            const firstLibPath = (lib["paths"] as string)
              .split(";")
              .map((p) => p.trim())
              .find(Boolean);
            if (firstLibPath) {
              folderPath = firstLibPath;
              folderSource = "library-path";
            }
          }
        }
        processed["folder_path"] = folderPath;
        if (process.env.NODE_ENV === "development") {
          console.log("[OpenFolder] MediaService.getMediaById:", {
            mediaId: id,
            type: processed["type"] ?? null,
            title: processed["title"] ?? null,
            directoryPath: ownDir ?? null,
            firstFile: firstFile?.file_path ?? null,
            folderSource,
            folderPath,
          });
        }
        return processed;
      },
      MEDIA_DETAIL_CACHE_TTL_SECONDS,
    );
  }

  async getMediaBatch(ids: number[], auth?: AuthContext) {
    if (!ids.length) return [];
    const blocked = await this.getBlockedCertifications(auth);
    const items = (await this.mediaRepo.batchGetByIds(ids, blocked.length ? blocked : undefined)) as Record<string, unknown>[];
    const libIds = [...new Set(items.map((m) => m["library_id"]).filter(Boolean))] as (
      string | number
    )[];
    const libMap: Record<number, string> = {};
    if (libIds.length) {
      const libs = (await this.libraryRepo.getByIds(libIds)) as Record<string, unknown>[];
      for (const lib of libs) {
        libMap[lib["library_id"] as number] = lib["name"] as string;
      }
    }
    const mapped = items.map((item) => {
      const p = processMediaItem(item);
      p["library_name"] = libMap[p["library_id"] as number] ?? "Unknown";
      return p;
    });
    traceGenresHealth("service:getMediaBatch", mapped);
    return mapped;
  }

  /**
   * يجلب قائمة وسائط مكتبة مع ترقيم صفحات وفلترة، عبر الكاش (TTL 60ث).
   *
   * @remarks بعد الحل من الكاش (إصابة أو طزاجة) تُمرَّر الاستجابة إلى
   *          متتبع انحراف لقطة الترقيم (`pagination-trace`) الذي يسجّل
   *          حدثاً تطويرياً لكل صفحة مخدومة ويحذّر عند اختلاف إجمالي
   *          القائمة بين الصفحات داخل جلسة واحدة — فئة الفشل الصامتة
   *          في OFFSET pagination فوق بيانات متغيّرة أثناء المسح.
   *
   * @param libraryId - معرف المكتبة المطلوب عناصرها.
   * @param options - خيارات القائمة (ترقيم، ترتيب، فلاتر سنة/نوع/تصنيف/بحث).
   * @param options.cursor - رمز keyset من صفحة سابقة؛ عند وجوده يُبنى الرد بوضع
   *        المؤشر: pagination {total, limit, hasMore, nextCursor} بلا offset،
   *        محصّناً ضد انزياح النوافذ عند الإدراج أثناء التمرير. غيابه يحفظ
   *        عقد OFFSET القديم كما هو للتوافق.
   * @param auth - سياق المصادقة (null للزائر) لتطبيق التصنيفات المحظورة.
   * @returns استجابة موحدة: `success`, `library`, `items`, `pagination`
   *          {total, offset, limit, hasMore} في وضع OFFSET أو
   *          {total, limit, hasMore, nextCursor} في وضع المؤشر.
   */
  async getLibraryMedia(
    libraryId: number,
    options: {
      rootOnly?: boolean;
      sortBy?: string;
      sortOrder?: string;
      limit?: number;
      offset?: number;
      cursor?: string;
      year?: string;
      genre?: string;
      certification?: string;
      search?: string;
    } = {},
    auth?: AuthContext,
  ) {
    const blocked = await this.getBlockedCertifications(auth);
    const result = await this.cache.withCache(
      CachePrefixes.media,
      { type: "library-media", libraryId, options, blocked },
      async () => {
        const library = (await this.libraryRepo.getById(libraryId)) as
          Record<string, unknown> | undefined;
        if (!library) throw new Error(`Library ${libraryId} not found`);

        const limit = options.limit ?? 50;
        const offset = options.offset ?? 0;

        const repoResult = await this.mediaRepo.getLibraryMediaFiltered(libraryId, {
          ...options,
          excludeCertifications: blocked.length ? blocked : undefined,
        });

        const mappedItems = repoResult.items.map(processMediaItem);
        traceGenresHealth("service:getLibraryMedia", mappedItems);

        // وضع المؤشر: hasMore يأتي محسوباً من الجلب الزائد (limit+1) في الـrepo
        // والمؤشر التالي مرمّز من آخر صف — لا يعتمدان على offset ولا على total.
        if (options.cursor) {
          return {
            success: true,
            library: {
              id: library["library_id"],
              name: library["name"],
              type: library["type"],
            },
            items: mappedItems,
            pagination: {
              total: repoResult.total,
              limit,
              hasMore: repoResult.hasMore ?? false,
              nextCursor: repoResult.nextCursor ?? null,
            },
          };
        }

        return {
          success: true,
          library: {
            id: library["library_id"],
            name: library["name"],
            type: library["type"],
          },
          items: mappedItems,
          pagination: {
            total: repoResult.total,
            offset,
            limit,
            hasMore: offset + repoResult.items.length < repoResult.total,
            // يُصدر من الـrepo في الفرعين متى وُجدت صفحة تالية، ليبدأ التمرير
            // اللانهائي بالكامل على keyset من الصفحة الثانية فصاعداً.
            nextCursor: repoResult.nextCursor ?? null,
          },
        };
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );

    tracePaginationPage(libraryId, options, blocked.length, result);
    return result;
  }

  async getLatestItems(type?: string, limit = 24, auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.media,
      { type: "latest", mediaType: type ?? "all", limit, blocked },
      async () => {
        const items = (await this.mediaRepo.getLatestMedia(type, limit, blocked)) as Record<
          string,
          unknown
        >[];
        const mapped = items.map(processMediaItem);
        traceGenresHealth("service:getLatestItems", mapped);
        return mapped;
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  async getPinnedItems(auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.media,
      { type: "pinned", blocked },
      async () => {
        const items = (await this.mediaRepo.getPinnedItems(blocked)) as Record<string, unknown>[];
        const mapped = items.map(processMediaItem);
        traceGenresHealth("service:getPinnedItems", mapped);
        return mapped;
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  async getAllGenres() {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "genres" },
      () => this.mediaRepo.getAllGenres(),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  async getMediaTypes() {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "types" },
      () => this.mediaRepo.getMediaTypes(),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  async togglePin(mediaId: number) {
    const media = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | undefined;
    const newState = await this.mediaRepo.togglePin(mediaId);
    getEventBus().emit("media_updated", { id: mediaId, updates: { is_pinned: newState === 1 } });
    if (this.activityRepo) {
      const title = (media?.["title"] as string | null) ?? `ID: ${mediaId}`;
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: newState === 1 ? "media_pinned" : "media_unpinned",
          module: "media",
          severity: "info",
          targetId: mediaId,
          details: { mediaId, title },
        })
        .catch((err: Error) => {
          console.error("[MediaService] Failed to log pin toggle:", err.message);
        });
    }
    return newState;
  }

  /**
   * يجلب عمود `title` الخام لعنصر وسائط باستعلام صف واحد خفيف،
   * دون تحميل الأطفال/الأنواع/الطاقم كما يفعل `getMediaById`.
   *
   * @param mediaId - معرّف العنصر (مفتاح `media_items.media_id`).
   * @returns العنوان كنص، أو `null` إذا لم يوجد العنصر.
   */
  async getMediaTitle(mediaId: number): Promise<string | null> {
    const row = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | undefined;
    return (row?.["title"] as string | null) ?? null;
  }

  async getRecommendations(mediaId: number, libraryId: number, type?: string, limit = 20, auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.recommendations,
      { mediaId, libraryId, mediaType: type ?? "all", limit, blocked },
      async () => {
        const items = (await this.mediaRepo.getRecommendations(
          mediaId,
          libraryId,
          type,
          limit,
          blocked,
        )) as Record<string, unknown>[];
        const mapped = items.map(processMediaItem);
        traceGenresHealth("service:getRecommendations", mapped);
        return mapped;
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  async getAvailableYears(libraryId?: number) {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "years", libraryId: libraryId ?? "all" },
      () => this.mediaRepo.getAvailableYears(libraryId),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Returns every distinct certification rating in the library with its item count,
   * served from the shared catalog cache. Feeds the viewer `/certification` page.
   *
   * @returns Array of `{ name, count }` sorted by count descending.
   */
  async getAllCertifications() {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "certifications" },
      () => this.mediaRepo.getAllCertifications(),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Returns the IMDb rating buckets available in the data, each with a cumulative
   * item count (`imdb_rating >= value`). Served from the shared catalog cache and
   * consumed by the viewer `/rating` page.
   *
   * @returns Array of `{ value, count }` ordered descending (highest rating first).
   */
  async getRatingBuckets() {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "ratings" },
      () => this.mediaRepo.getRatingBuckets(),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Retrieves a paginated, filterable list of media items.
   *
   * @param params - Filtering and pagination options passed to the repository.
   * @param params.year - Filter by production year.
   * @param params.genre - Filter by genre name.
   * @param params.certification - Filter by certification rating.
   * @param params.minRating - Minimum IMDb rating.
   * @param params.search - Text search on title or original title.
   * @param params.libraryId - Filter by library ID.
   * @param params.type - Filter by media type.
   * @param params.filterBy - Status filter: "all" | "pinned" | "no-content" | "needs-review".
   * @param params.rootOnly - If true, only root items are returned.
   * @param params.excludeTypes - Media types to exclude.
   * @param params.page - Page number (1-indexed).
   * @param params.limit - Items per page.
   * @returns Object with processed items, total, page, limit and hasMore.
   */
  async getMediaByFilter(params: {
    year?: number;
    genre?: string;
    certification?: string;
    minRating?: number;
    search?: string;
    libraryId?: number;
    type?: string;
    filterBy?: "all" | "pinned" | "no-content" | "needs-review";
    rootOnly?: boolean;
    excludeTypes?: string[];
    page?: number;
    limit?: number;
  }, auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.media,
      { type: "filter", params, blocked },
      async () => {
        const result = await this.mediaRepo.getMediaByFilter({
          ...params,
          excludeCertifications: blocked.length ? blocked : undefined,
        });

        // معالجة العناصر لدمج enriched في poster_path/backdrop_path إذا كانت فارغة
        const processedItems = (result.items as Record<string, unknown>[]).map((item) => {
          // نسخ enriched_poster إلى poster_path إذا كان poster_path فارغاً
          if (item.enriched_poster && !item.poster_path) {
            item.poster_path = item.enriched_poster;
          }
          // نسخ enriched_backdrop إلى backdrop_path إذا كان backdrop_path فارغاً
          if (item.enriched_backdrop && !item.backdrop_path) {
            item.backdrop_path = item.enriched_backdrop;
          }
          // تطبيق processMediaItem (الذي يحول id و display_title)
          return processMediaItem(item);
        });

        const mappedItems = (result.items as Record<string, unknown>[]).map(processMediaItem);
        traceGenresHealth("service:getMediaByFilter", mappedItems);

        return {
          ...result,
          items: mappedItems,
        };
      },
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Returns dashboard-style statistics for the admin items-control toolbar
   * (totals, libraries count, needs-attention, no-content, last sync time).
   *
   * @returns Object with the stats computed by the repository.
   */
  async getAdminStats() {
    return this.cache.withCache(
      CachePrefixes.media,
      { type: "admin-stats" },
      () => this.mediaRepo.getAdminStats(),
      MEDIA_LIST_CACHE_TTL_SECONDS,
    );
  }

  async deleteItem(mediaId: number) {
    const media = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | undefined;
    if (!media) throw new Error("Media not found");

    if (this.activityRepo) {
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: "media_deleted",
          module: "media",
          severity: "error",
          targetId: mediaId,
          details: { mediaId, title: media["title"] ?? `ID: ${mediaId}` },
        })
        .catch((err: Error) => {
          console.error("[MediaService] Failed to log media deletion:", err.message);
        });
    }

    const files = (await this.mediaRepo.getMediaFiles(mediaId)) as Record<string, unknown>[];
    for (const file of files) {
      if (file["file_path"]) {
        try {
          await fs.unlink(file["file_path"] as string);
        } catch {
          // file may not exist
        }
      }
      await this.mediaRepo.deleteFile(file["file_id"] as number);
    }

    await this.mediaRepo.delete(mediaId);
    getEventBus().emit("media_deleted", { id: mediaId });

    if (this.searchRepo) {
      void this.searchRepo.removeFromIndex(mediaId).catch((err: Error) => {
        console.error("[MediaService] Failed to remove from FTS index:", err.message);
      });
    }

    return true;
  }

  async updateMedia(mediaId: number, updates: Record<string, unknown>) {
    const existing = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | undefined;
    if (!existing) throw new Error("Media not found");

    const allowed = [
      "title",
      "original_title",
      "overview",
      "year",
      "imdb_rating",
      "certification",
      "poster_path",
      "backdrop_path",
      "sort_order",
      "is_pinned",
      "is_available",
      "type",
    ];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }
    if (Object.keys(safeUpdates).length === 0) return existing;
    safeUpdates["updated_at"] = new Date().toISOString();
    const result = await this.mediaRepo.update(mediaId, safeUpdates);
    getEventBus().emit("media_updated", { id: mediaId, updates: safeUpdates });
    getEventBus().emit("media:changed", { id: mediaId });

    // Sync FTS5 index when title, overview, or other indexed fields change.
    const indexedFields = ["title", "original_title", "overview"];
    const hasIndexedChange = indexedFields.some((f) => f in safeUpdates);
    if (hasIndexedChange && this.searchRepo) {
      void this.searchRepo.addToIndex(mediaId).catch((err: Error) => {
        console.error("[MediaService] Failed to update FTS index:", err.message);
      });
    }

    if (this.activityRepo) {
      const title =
        (existing["title"] as string) ?? (safeUpdates["title"] as string) ?? `ID: ${mediaId}`;
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: "media_updated",
          module: "media",
          severity: "success",
          targetId: mediaId,
          details: { mediaId, title, fields: Object.keys(safeUpdates) },
        })
        .catch((err: Error) => {
          console.error("[MediaService] Failed to log media update:", err.message);
        });
    }
    return result;
  }

  async getMediaChildren(parentId: number, auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.mediaDetail,
      { type: "children", parentId, blocked },
      async () => {
        const items = await this.mediaRepo.getMediaChildren(parentId);
        return (items as Record<string, unknown>[]).map(processMediaItem);
      },
      MEDIA_DETAIL_CACHE_TTL_SECONDS,
    );
  }

  async getStreamInfo(mediaId: number, auth?: AuthContext) {
    const media = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | undefined;
    if (!media) return null;
    const settings = await this.settingsService.getAllSettings();
    const certFilter = resolveBlockedCertifications(auth ?? null, settings);
    if (shouldBlockMedia(media["certification"] as string | null | undefined, certFilter)) return null;

    const files = (await this.mediaRepo.getMediaFiles(mediaId)) as Record<string, unknown>[];
    if (!files.length) return null;

    const file = files[0]!;
    const filePath = file["file_path"] as string;

    try {
      const stat = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.getMimeType(ext);

      return {
        media_id: mediaId,
        file_path: filePath,
        file_size: stat.size,
        mime_type: mimeType,
        duration: file["duration"] ?? null,
        title: media["title"],
      };
    } catch {
      return null;
    }
  }

  async getPerson(personId: number) {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "person", personId },
      () => this.mediaRepo.getPersonById(personId),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  async getPersonWorks(personId: number, auth?: AuthContext) {
    const blocked = await this.getBlockedCertifications(auth);
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "person-works", personId, blocked },
      async () => {
        const works = (await this.mediaRepo.getPersonWorks(personId, blocked.length ? blocked : undefined)) as Record<string, unknown>[];
        const mapped = works.map(processMediaItem);
        traceGenresHealth("service:getPersonWorks", mapped);
        return mapped;
      },
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  async getAllPeople(limit = 100, search?: string) {
    return this.cache.withCache(
      CachePrefixes.catalog,
      { kind: "people", limit, search: search ?? "" },
      () => this.mediaRepo.getAllPeople(limit, search),
      TAXONOMY_CACHE_TTL_SECONDS,
    );
  }

  private getMimeType(ext: string): string {
    const mimeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".wmv": "video/x-ms-wmv",
      ".flv": "video/x-flv",
      ".webm": "video/webm",
      ".m4v": "video/mp4",
      ".ts": "video/mp2t",
      ".mp3": "audio/mpeg",
      ".flac": "audio/flac",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return mimeMap[ext] ?? "application/octet-stream";
  }
}
