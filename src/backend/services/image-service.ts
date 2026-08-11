import { ImageRepository } from "../repositories/image-repository";
import { SettingsService } from "./settings-service";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

/** Image types supported by the image serving pipeline. */
export type ImageType = "poster" | "backdrop" | "library" | "person" | "still";

/**
 * خيارات معالجة الصورة القادمة من الاستعلام (`w`/`h`/`q`).
 *
 * - المصدر الموثوق: بارامترات نقطة `/api/images/[id]` في الواجهة
 *   (`image-helpers.ts` تبنيها) — لكنها اختيارية بالكامل.
 * - النطاق: تغيير الأبعاد (قصّ تغطية دون تكبير) وجودة إعادة الترميز للـ JPEG/WebP.
 * - القيود: تُتجاهل تماماً عند غيابها أو عند الصور من نوع SVG (لا معالجة).
 */
export interface ImageProcessOptions {
  /** العرض المستهدف بالبكسل (اختياري). */
  w?: number;
  /** الارتفاع المستهدف بالبكسل (اختياري). */
  h?: number;
  /** جودة إعادة الترميز 1–100 (افتراضي 80). */
  q?: number;
}

/** نوع مُخزَّن في كاش الذاكرة مع وقت انتهاء لتفادي تقديم صور قديمة للأبد. */
interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
}

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

/**
 * بادئة الويب القديمة لصور الإثراء المخزَّنة محلياً.
 *
 * تبقى الصيغة المخزَّنة في القاعدة (`enriched_poster`/`enriched_backdrop`/
 * `profile_path`) بصيغة web-relative ثابتة تبدأ بهذه البادئة حتى لو نُقل
 * التخزين الفعلي خارج جذر المشروع — يستخدمها `resolveImagePath` لربط المسار
 * المخزَّن بالجذر المطلق عند تفعيل التخزين الخارجي.
 */
export const ENRICHED_WEB_PREFIX = "/assets/images/enriched";

/** مهلة صلاحية إدخالات كاش الصور بالمللي ثانية (60 ثانية). */
const CACHE_TTL_MS = 60_000;
/** السقف الأعلى لعدد إدخالات كاش الصور (LRU). */
const CACHE_MAX_ENTRIES = 1000;

export class ImageService {
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();

  constructor(
    private imageRepo: ImageRepository,
    private settingsService?: SettingsService,
  ) {}

  /**
   * قراءة إعداد نصي مع قيمة احتياطية عند غياب الخدمة أو المفتاح.
   *
   * @param key - مفتاح الإعداد في `SettingsService`.
   * @param fallback - القيمة الاحتياطية المستخدمة عندما يكون الإعداد غائباً أو فارغاً.
   * @returns قيمة الإعداد النصية أو الـ fallback.
   */
  private async getSettingString(key: string, fallback: string): Promise<string> {
    const value = this.settingsService ? await this.settingsService.getSetting(key) : null;
    return typeof value === "string" && value.trim() ? value : fallback;
  }

  /**
   * Serves an image for a media item with cascading fallback through the
   * parent hierarchy. The lookup order for each level is:
   *   1. enriched_poster / enriched_backdrop  (TMDB image saved locally)
   *   2. poster_path / backdrop_path           (scanner-discovered local file)
   *   3. Cascade to parent via parent_media_id (repeats steps 1-2)
   *
   * For `type="person"` the profile image is resolved storage-aware from disk
   * (local enriched references) with the TMDB CDN as a remote fallback for
   * TMDB-relative references. For `type="still"` the episode still uses the
   * same resolution logic as `backdrop`.
   *
   * When no image is found (missing record, missing file, or failed read) the
   * method returns a bundled theme-neutral placeholder SVG instead of null so
   * the `/api/images` route never responds with 404.
   *
   * @param id - The media item ID (or person ID when `type="person"`).
   * @param type - Image type: "poster", "backdrop", "library", "person", "still".
   * @returns An object with the image buffer and MIME type, always populated.
   */
  async getImage(
    id: number,
    type: ImageType = "poster",
    opts: ImageProcessOptions = {},
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const cacheKey = this.buildCacheKey(id, type, opts);
    const cached = this.cacheGet(cacheKey);
    if (cached) return { buffer: cached.buffer, contentType: cached.contentType };

    const pending = this.inflight.get(cacheKey);
    if (pending) return pending;

    const task = this.resolveAndProcess(id, type, opts)
      .then((result) => {
        this.cacheSet(cacheKey, result);
        this.inflight.delete(cacheKey);
        return result;
      })
      .catch((error) => {
        this.inflight.delete(cacheKey);
        throw error;
      });
    this.inflight.set(cacheKey, task);
    return task;
  }

  /**
   * يحل مسار الصورة الخام ثم يمررها عبر معالجة sharp (إن وُجدت أبعاد/جودة).
   *
   * - السلوك: `resolveImage` يطبق السلسلة الكاملة (شخص/مكتبة/وسائط/افتراضي)
   *   ثم `processImage` يغيّر الأبعاد ويعيد الترميز حسب `opts`.
   * - الضمان: النتيجة دائماً موجودة (الافتراضي SVG يُعاد كما هو دون معالجة).
   *
   * @param id - معرّف العنصر (أو الشخص عند `type="person"`).
   * @param type - نوع الصورة.
   * @param opts - خيارات المعالجة (أبعاد/جودة) الاختيارية.
   * @returns الصورة المعالجة مع نوع MIME.
   */
  private async resolveAndProcess(
    id: number,
    type: ImageType,
    opts: ImageProcessOptions,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const raw = await this.resolveImage(id, type);
    return this.processImage(raw.buffer, raw.contentType, opts);
  }

  /**
   * يحل الصورة الخام (دون معالجة) عبر السلسلة الاحتياطية الكاملة.
   *
   * @param id - معرّف العنصر (أو الشخص عند `type="person"`).
   * @param type - نوع الصورة المطلوب.
   * @returns الصورة الخام مع نوع MIME (ضمان عدم العودة `null`).
   */
  private async resolveImage(
    id: number,
    type: ImageType,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (type === "person") {
      return (await this.getPersonImage(id)) ?? (await this.getDefaultImage("person"));
    }

    if (type === "library") {
      const imagePath = await this.imageRepo.getLibraryImage(id);
      const result = imagePath
        ? await this.readImageFile(await this.resolveImagePath(imagePath))
        : null;
      return result ?? (await this.getDefaultImage("library"));
    }

    const isBackdrop = type === "backdrop" || type === "still";
    const col = isBackdrop ? "backdrop_path" : "poster_path";
    const enrichedCol = isBackdrop ? "enriched_backdrop" : "enriched_poster";

    let currentId: number | null = id;
    while (currentId) {
      const data = await this.imageRepo.getMediaImageData(currentId);
      if (!data) break;

      // 1st priority: enriched (TMDB, saved locally)
      const enrichedPath = data[enrichedCol];
      if (enrichedPath) {
        const result = await this.readImageFile(await this.resolveImagePath(enrichedPath));
        if (result) return result;
      }

      // 2nd priority: scanner-discovered path
      const primaryPath = data[col];
      if (primaryPath) {
        const result = await this.readImageFile(await this.resolveImagePath(primaryPath));
        if (result) return result;
      }

      // 3rd priority: cascade to parent (any type)
      currentId = data.parent_media_id;
    }

    return this.getDefaultImage(type);
  }

  /**
   * يعالج صورة عبر sharp: تغيير الأبعاد (قصّ تغطية دون تكبير) وإعادة الترميز.
   *
   * - السلوك: عند غياب `w`/`h`/`q` تُعاد الصورة كما هي دون معالجة. الصور من
   *   نوع SVG تُتخطى دائماً (لا يمكن معالجتها بـ sharp). جودة `q` تُطبَّق على
   *   إعادة الترميز للـ JPEG/WebP فقط (افتراضي 80).
   * - الحواف: أي فشل في sharp (ملف تالف أو صيغة غير مدعومة) يعيد الصورة الخام
   *   بدلاً من إسقاط الاستجابة (نفس مبدأ "لا 404 أبداً").
   *
   * @param buffer - محتوى الصورة الخام.
   * @param contentType - نوع MIME الأصلي.
   * @param opts - خيارات الأبعاد والجودة (اختيارية).
   * @returns الصورة المعالجة مع نوع MIME النهائي.
   */
  private async processImage(
    buffer: Buffer,
    contentType: string,
    opts: ImageProcessOptions,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (contentType === "image/svg+xml") return { buffer, contentType };
    if (!opts.w && !opts.h && !opts.q) return { buffer, contentType };

    try {
      const isWebp = contentType === "image/webp";
      const isJpeg = contentType === "image/jpeg";
      const quality = opts.q && opts.q > 0 && opts.q <= 100 ? opts.q : 80;

      let pipeline = sharp(buffer, { failOn: "none" });
      if (opts.w || opts.h) {
        pipeline = pipeline.resize({
          ...(opts.w ? { width: opts.w } : {}),
          ...(opts.h ? { height: opts.h } : {}),
          fit: "cover",
          withoutEnlargement: true,
        });
      }

      if (isWebp) {
        return { buffer: await pipeline.webp({ quality }).toBuffer(), contentType: "image/webp" };
      }
      if (isJpeg) {
        return { buffer: await pipeline.jpeg({ quality }).toBuffer(), contentType: "image/jpeg" };
      }
      return { buffer: await pipeline.toBuffer(), contentType };
    } catch {
      return { buffer, contentType };
    }
  }

  /**
   * يبني مفتاح كاش فريداً من المعرّف والنوع وخيارات المعالجة.
   *
   * @param id - معرّف العنصر/الشخص.
   * @param type - نوع الصورة.
   * @param opts - خيارات المعالجة.
   * @returns سلسلة مفتاح فريدة ضمن كاش الصور.
   */
  private buildCacheKey(id: number, type: ImageType, opts: ImageProcessOptions): string {
    return `${type}:${id}:w:${opts.w ?? ""}:h:${opts.h ?? ""}:q:${opts.q ?? ""}`;
  }

  /**
   * يقرأ إدخالاً من كاش LRU إن لم تكن صلاحيته قد انتهت (ويرفّع ترتيبه).
   *
   * @param key - مفتاح الكاش.
   * @returns الإدخال المخزّن أو `undefined` عند الغياب/الانتهاء.
   */
  private cacheGet(key: string): CacheEntry | undefined {
    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return undefined;
    }
    // إعادة الإدراج لنقله لنهاية الترتيب (LRU).
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);
    return entry;
  }

  /**
   * يخزن إدخالاً في كاش LRU ويقترع أقدم إدخال عند تجاوز السقف.
   *
   * @param key - مفتاح الكاش.
   * @param value - الإدخال المراد تخزينه.
   */
  private cacheSet(key: string, value: { buffer: Buffer; contentType: string }): void {
    this.memoryCache.set(key, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
    while (this.memoryCache.size > CACHE_MAX_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Resolves a person's profile image through the same storage-aware pipeline
   * used for media enriched images, with the TMDB CDN as a remote fallback.
   *
   * Stored `media_people.profile_path` values are treated as one of:
   *   1. Local enriched references — web-relative (e.g. `/assets/images/
   *      enriched/persons/...`), relative (resolved under `image_storage_root`)
   *      or absolute disk paths. Read from disk via `resolveImagePath`.
   *   2. TMDB-relative references — a single-segment filename at the URL root
   *      (e.g. `/abc123.jpg`). Fetched from the pinned `image.tmdb.org` CDN.
   *
   * Candidates are tried in order until one resolves; when none do, null is
   * returned so the caller falls back to the bundled placeholder.
   *
   * @param personId - The person ID to look up.
   * @returns The resolved image, or null when no candidate path works.
   */
  private async getPersonImage(
    personId: number,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const profilePaths = await this.imageRepo.getPersonImages(personId);
    for (const profilePath of profilePaths) {
      if (this.isTmdbRelativePath(profilePath)) {
        const remote = await this.fetchRemoteImage(`${TMDB_IMAGE_BASE_URL}${profilePath}`);
        if (remote) return remote;
      } else {
        const local = await this.readImageFile(await this.resolveImagePath(profilePath));
        if (local) return local;
      }
    }
    return null;
  }

  /**
   * Detects whether a stored reference is a TMDB-relative path.
   *
   * TMDB returns profile/posters as `/abc123.jpg` — a leading slash followed by
   * a single filename with no further subdirectories. Local enriched references
   * always contain at least one additional `/` (e.g.
   * `/assets/images/enriched/persons/person_1_abc.jpg`), so this check keeps the
   * two families apart without relying on a hardcoded storage root.
   *
   * @param storedPath - The path stored in the database.
   * @returns True when the path is a TMDB-relative remote reference.
   */
  private isTmdbRelativePath(storedPath: string): boolean {
    return storedPath.startsWith("/") && !storedPath.slice(1).includes("/");
  }

  /**
   * Reads the bundled theme-neutral placeholder SVG for a given image type.
   *
   * The placeholders own their full background gradient (slate palette), so
   * they render identically in both light and dark themes and are never
   * distorted by `object-cover` cropping (content is centered with safe padding).
   *
   * @param type - The image type the placeholder will be shown for.
   * @returns The SVG buffer and MIME type, never null — if the bundled asset
   *          is missing or unreadable a minimal inline SVG is served instead.
   */
  private async getDefaultImage(type: ImageType): Promise<{ buffer: Buffer; contentType: string }> {
    const fileNameMap: Record<ImageType, string> = {
      poster: "poster.svg",
      backdrop: "backdrop.svg",
      library: "library.svg",
      person: "person.svg",
      still: "still.svg",
    };
    const placeholderDir = await this.getSettingString(
      "image_placeholder_dir",
      "/assets/images/placeholders",
    );
    const result = await this.readImageFile(
      path.join(process.cwd(), "public", placeholderDir.replace(/^\/+/, ""), fileNameMap[type]),
    );
    if (result) return result;
    // Last resort so `getImage` never returns null (no 404 responses).
    return {
      buffer: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><rect width="300" height="450" fill="#27272a"/></svg>`,
      ),
      contentType: "image/svg+xml",
    };
  }

  /**
   * Downloads an image from a remote URL (used for person profile images).
   *
   * The request is validated against the SSRF-safe protocol/host rules and
   * aborted after 8 seconds so a slow or dead host cannot stall the route.
   *
   * @param imageUrl - The fully-qualified HTTPS image URL.
   * @returns The image buffer and content type, or null on any failure.
   */
  private async fetchRemoteImage(
    imageUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  /**
   * يكتشف ما إذا كان المسار المخزَّن مسار قرص مطلقاً حقيقياً (محرك + فاصل، أو
   * مشاركة شبكة UNC) وليس مساراً web-relative يبدأ بـ `/` — ففي Node على ويندوز
   * `path.isAbsolute("/assets/...")` يُرجع `true` لأنه يعامله كمستوٍ على جذر
   * المحرك، لذا لا يصح الاعتماد عليه لتمييز مسارات القرص من المسارات الويب.
   *
   * @param storedPath - مسار الصورة كما هو محفوظ في قاعدة البيانات.
   * @returns `true` عندما يكون المسار مطلقاً على القرص (`C:\...` / `\\server\...`).
   */
  private isAbsoluteDiskPath(storedPath: string): boolean {
    return /^[A-Za-z]:[\\/]/.test(storedPath) || /^[\\/]{2}/.test(storedPath);
  }

  /**
   * يحوّل مسار صورة مخزّن في قاعدة البيانات إلى مسار قرص صالح للقراءة.
   *
   * - المسار المطلق الحقيقي (`\\server\...` أو `C:\...`) يُقرأ كما هو.
   * - إذا كان إعداد `image_storage_root` مساراً مطلقاً خارج جذر المشروع
   *   (التخزين الخارجي)، تُربط المسارات المخزَّنة بالبادئة الويب القديمة
   *   `ENRICHED_WEB_PREFIX` بذلك الجذر (تجريد البادئة وإلحاق الباقي)،
   *   والمسارات النسبية الأخرى تُحل تحت الجذر نفسه.
   * - وإلا (المسار نسبي لجذر الويب): المسار الذي يبدأ بـ `/` يُحل داخل
   *   مجلد `public`، والمسار النسبي يُحل داخل `public` تحت `image_storage_root`.
   *
   * يضمن هذا الاتساق عبر كل الفروع (library، enriched، الأساسي) دون تغيير
   * ترتيب الأولويات (enriched ← أساسي ← صعود الأب)، ويبقي مسارات الماسح
   * المطلقة كما هي (الأولوية الثانية).
   *
   * @param storedPath - مسار الصورة كما هو محفوظ في قاعدة البيانات.
   * @returns مسار قرص مطلق/صالح للقراءة.
   */
  private async resolveImagePath(storedPath: string): Promise<string> {
    if (this.isAbsoluteDiskPath(storedPath)) return storedPath;

    const storageRoot = await this.getSettingString("image_storage_root", ENRICHED_WEB_PREFIX);

    if (path.isAbsolute(storageRoot)) {
      const rel = storedPath.startsWith(ENRICHED_WEB_PREFIX)
        ? storedPath.slice(ENRICHED_WEB_PREFIX.length)
        : storedPath;
      return path.join(storageRoot, rel.replace(/^[/\\]+/, ""));
    }

    if (storedPath.startsWith("/")) {
      return path.join(process.cwd(), "public", storedPath.slice(1));
    }
    return path.join(process.cwd(), "public", storageRoot.replace(/^\/+/, ""), storedPath);
  }

  /**
   * Reads an image file from disk and returns its buffer and MIME type.
   *
   * @param imagePath - Absolute or relative filesystem path to the image file.
   * @returns The image buffer and MIME type, or null if the file can't be read.
   */
  private async readImageFile(imagePath: string): Promise<{
    buffer: Buffer;
    contentType: string;
  } | null> {
    try {
      const buffer = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };
      return { buffer, contentType: mimeTypes[ext] ?? "image/jpeg" };
    } catch {
      return null;
    }
  }
}
