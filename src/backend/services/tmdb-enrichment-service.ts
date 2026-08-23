import { EventEmitter } from "events";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { getEventBus } from "./event-bus";
import { runInWriterContext } from "../db/db";
import { logger } from "../observability/logger";
import { EnrichmentMediaRepository } from "../repositories/enrichment-media-repository";
import { MediaRepository } from "../repositories/media-repository";
import { LibraryRepository } from "../repositories/library-repository";
import { EnrichmentApprovalRepository } from "../repositories/enrichment-repository";
import { SearchRepository } from "../repositories/search-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SettingsService } from "./settings-service";
import { ENRICHED_WEB_PREFIX } from "./image-service";
import { isAbsoluteDiskPath } from "../utils/path-utils";

/**
 * قائمة حظر SSRF: النطاقات المحلية والعناوين الخاصة (RFC1918 و169.254.0.0/16)
 * وأسماء المضيفات الخاصة — تُفحص كبادئة (وليس تطابقاً تاماً بـ `$`)، لأن regex
 * سابق كان يختتم بـ `$` خارج المجموعة فلم يحظر أي عنوان IP خاص فعلياً
 * (مثل 127.0.0.1 و10.0.0.1 و192.168.1.5 و172.16.0.1).
 */
const SSRF_BLOCKLIST =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|localhost|metadata\.google\.internal|\[::1\])/i;

/**
 * يتحقق إن كان اسم مضيف محظوراً وفق قائمة SSRF (فحص بادئ، غير حساس لحالة الأحرف).
 *
 * @param hostname - اسم المضيف كما يعيده `URL.hostname` (بلا بروتوكول أو مسار).
 * @returns `true` إذا كان المضيف محظوراً (نطاق خاص/محلي/خدمة وصفية).
 */
export function isBlockedHostname(hostname: string): boolean {
  return SSRF_BLOCKLIST.test(hostname.toLowerCase());
}

/** مهلة طلبات شبكة TMDB وصورها (بالمللي ثانية) — تمنع تعليق طلبات الإثراء عند
 * تعطل المزود أو بطئه (تجميد «زر الإثراء» بلا نهاية). يتبع نمط بقية خدمات
 * الشبكة في المشروع (`image-service` = 8s، `live-stream-service`). */
const ENRICHMENT_FETCH_TIMEOUT_MS = 10000;

/**
 * يتحقق من أمان رابط صورة قبل تنزيله (منع SSRF): بروتوكول http(s) فقط
 * ومضيف غير محظور.
 *
 * @param imageUrl - رابط الصورة الكامل.
 * @returns `true` إذا كان الرابط آمناً للتنزيل.
 */
function isSafeImageUrl(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return !isBlockedHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function pLimit(concurrency: number) {
  const queue: Array<() => Promise<void>> = [];
  let active = 0;
  async function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const fn = queue.shift()!;
    try {
      await fn();
    } catch {
      /* individual task error is handled by caller */
    }
    active--;
    next();
  }
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      next();
    });
}

interface EnrichmentOptions {
  downloadImages: boolean;
  downloadCastImages: boolean;
  storageMode: string;
  force: boolean;
  tmdbId: number | null;
}

interface TmdbSearchResult {
  result: Record<string, unknown>;
  score: number;
}

interface BackoffEntry {
  timestamp: number;
  attempts: number;
  nextRetryAt: number;
  title: string | null;
}

interface BatchTracker {
  successful: number;
  failed: number;
  pending: number;
  skipped: number;
  processed: number;
}

interface EnrichmentStats {
  totalEnriched: number;
  success: number;
  failed: number;
  lastRun: string | null;
}

export class TmdbEnrichmentService extends EventEmitter {
  private enrichmentRepo: EnrichmentMediaRepository;
  private mediaRepo: MediaRepository;
  private libraryRepo: LibraryRepository;
  private approvalRepo: EnrichmentApprovalRepository;
  private settingsService?: SettingsService;

  private config: Record<string, unknown> = {
    language: "en",
    downloadImages: false,
    downloadCastImages: false,
    storageMode: "local",
  };
  private stats: EnrichmentStats = { totalEnriched: 0, success: 0, failed: 0, lastRun: null };
  private searchCache = new Map<string, TmdbSearchResult>();
  private readonly SEARCH_CACHE_MAX_SIZE = 500;
  private recentlyFailed = new Map<string | number, BackoffEntry>();
  private cancelledSessions = new Set<string>();
  private inFlightItems = new Set<number>();
  private cachedTableColumns: Set<string> | null = null;

  private readonly BACKOFF_BASE_MS = 300000;
  private readonly TMDB_BASE_URL = "https://api.themoviedb.org/3";

  private apiKey: string;

  private isScanActive: () => boolean = () => false;

  /**
   * يبني الخدمة مع مستودعاتها ومفتاح TMDB والإعدادات الاختيارية.
   *
   * @param enrichmentRepo - مستودع بيانات الإثراء (genres/people/companies).
   * @param mediaRepo - مستودع عناصر الوسائط.
   * @param libraryRepo - مستودع المكتبات.
   * @param approvalRepo - مستودع اقتراحات الموافقة على الإثراء.
   * @param searchRepo - مستودع فهرس البحث FTS5 (لمزامنة الصف بعد الإثراء).
   * @param apiKey - مفتاح TMDB (فارغ إن لم يُضبط بعد).
   * @param config - إعدادات إضافية تُدمج مع الافتراضية.
   * @param activityRepo - مستودع سجل الأنشطة (اختياري).
   * @param settingsService - خدمة الإعدادات (اختياري).
   * @param isScanActive - دالة تحدد إن كان ماسح مكتبات نشطاً حالياً؛ عند نشاطه
   *   يتخطى الإثراء (فردي وجماعي) لمنع تصادم قفل الكتابة WAL الوحيد مع كاتب
   *   الماسح — المصدر الرئيسي لتجميد التطبيق أثناء الإثراء. افتراضياً `() => false`.
   */
  constructor(
    enrichmentRepo: EnrichmentMediaRepository,
    mediaRepo: MediaRepository,
    libraryRepo: LibraryRepository,
    approvalRepo: EnrichmentApprovalRepository,
    private searchRepo: SearchRepository,
    apiKey: string,
    config: Record<string, unknown> = {},
    private activityRepo?: ActivityRepository,
    settingsService?: SettingsService,
    isScanActive?: () => boolean,
  ) {
    super();
    this.enrichmentRepo = enrichmentRepo;
    this.mediaRepo = mediaRepo;
    this.libraryRepo = libraryRepo;
    this.approvalRepo = approvalRepo;
    this.settingsService = settingsService;
    this.apiKey = apiKey;
    this.config = { ...this.config, ...config };
    if (isScanActive) this.isScanActive = isScanActive;

    setInterval(() => this.searchCache.clear(), 300000).unref();
    setInterval(() => this._cleanupBackoff(), 600000).unref();

    // مزامنة المفتاح في الذاكرة مع أي تغيير يصل عبر `settings_updated` (من منصة
    // التحكم أو صفحة الإعدادات الإدارية) دون انتظار إعادة تشغيل الخادم.
    getEventBus().on("settings_updated", (data) =>
      this._onSettingsUpdated(data as { key?: string; value?: unknown }),
    );
  }

  /**
   * يحفظ مفتاح TMDB API: يفعّله في الذاكرة فوراً ثم يثبّته في إعدادات النظام
   * (`tmdb_api_key`) عبر `SettingsService` عند توفّره، مع تمرير المستخدم والـ IP
   * لسجل تدقيق الإعدادات. كتابة القاعدة تفشل مع إبقاء المفتاح فعّالاً في الذاكرة.
   *
   * @param apiKey - مفتاح TMDB API المراد حفظه.
   * @param userId - معرّف المستخدم المسؤول عن التغيير (اختياري — لسجل التدقيق).
   * @param ip - عنوان IP الخاص بالتغيير (اختياري — لسجل التدقيق).
   * @returns لا يُرجع قيمة.
   * @throws إذا فشل كتابة الإعداد في قاعدة البيانات.
   */
  async saveApiKey(apiKey: string, userId?: number, ip?: string): Promise<void> {
    this.apiKey = apiKey;
    if (this.settingsService) {
      await this.settingsService.updateSettings({ tmdb_api_key: apiKey }, userId, ip);
    }
  }

  /**
   * يقرأ مفتاح TMDB API المحفوظ في الإعدادات ويجعله فعّالاً في الذاكرة.
   *
   * يُستدعى عند بدء الخدمة (في `services/index.ts`) بحيث لا يفقد النظام المفتاح
   * بعد إعادة تشغيل الخادم. القيمة المخزنة (عند وجودها وغير فارغة) لها الأولوية
   * على مفتاح الـ constructor الفارغ.
   *
   * @returns المفتاح النشط بعد القراءة (المخزّن أو الممرَّر للبناء).
   */
  async loadApiKeyFromSettings(): Promise<string> {
    if (this.settingsService) {
      const stored = await this.settingsService.getSetting("tmdb_api_key");
      if (typeof stored === "string" && stored.trim() !== "") {
        this.apiKey = stored;
      }
    }
    return this.apiKey;
  }

  /**
   * معالج حدث `settings_updated` على الحافلة العامة: يحدّث مفتاح TMDB في الذاكرة
   * عند تغيير إعداد `tmdb_api_key` من أي مصدر.
   *
   * @param data - حمولة الحدث (تحتوي `key` و`value`).
   */
  private _onSettingsUpdated(data: { key?: string; value?: unknown }): void {
    if (data?.key === "tmdb_api_key" && typeof data.value === "string") {
      this.apiKey = data.value;
    }
  }

  updateConfig(newConfig: Record<string, unknown>): void {
    Object.assign(this.config, newConfig);
    if (newConfig.apiKey) this.apiKey = newConfig.apiKey as string;
  }

  private async _fetchFromTmdb(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(ENRICHMENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TMDB API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  private async _ensureTableColumns(): Promise<Set<string>> {
    if (this.cachedTableColumns) return this.cachedTableColumns;
    this.cachedTableColumns = await this.enrichmentRepo.getValidColumnNames();
    return this.cachedTableColumns;
  }

  private async _filterUpdateData(
    updateData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const columns = await this._ensureTableColumns();
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (columns.has(key)) filtered[key] = value;
    }
    return filtered;
  }

  private async _getOptions(provided: Partial<EnrichmentOptions> = {}): Promise<EnrichmentOptions> {
    return {
      downloadImages: provided.downloadImages ?? false,
      downloadCastImages: provided.downloadCastImages ?? false,
      storageMode: provided.storageMode ?? "local",
      force: provided.force ?? false,
      tmdbId: provided.tmdbId ?? null,
    };
  }

  private _detectLanguage(title: string): string {
    if (!title) return "en";
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(title)
      ? "ar"
      : "en";
  }

  private _stripArabicPrefix(title: string): string {
    if (!title) return title;
    const prefixes = [
      "^(?:ال)?فيلم(?:\\s+(?:الكوري|الصيني|الهندي|التركي|الياباني|الأمريكي|الفرنسي|البريطاني|الإيطالي|الألماني|الإسباني|الروسي|الأفريقي|العربي|الأجنبي))?",
      "^(?:ال)?مسلسل(?:\\s+(?:الكوري|الصيني|الهندي|التركي|الياباني|الأمريكي|الفرنسي|البريطاني|الإيطالي|الألماني|الإسباني|الروسي|الأفريقي|العربي|الأجنبي))?",
      "^(?:ال)?افلام",
      "^(?:ال)?أفلام",
      "^(?:ال)?سلسلة",
      "^(?:ال)?سلسله",
      "^(?:ال)?مجموعة",
    ];
    let result = title;
    for (const p of prefixes) {
      result = result.replace(new RegExp(p + "\\s+", "ui"), "");
    }
    return result.trim() || title;
  }

  private _cleanTitle(title: string, stripYears = true): string {
    if (!title) return "";
    let cleaned = title;
    const noise = [
      "مدبلج",
      "مترجم",
      "مدبلجة",
      "المدبلج",
      "مدبلجه",
      "المترجم",
      "دبلجة",
      "الدبلجة",
      "مدبلج للعربية",
      "مترجم للعربية",
      "WEB-DL",
      "BluRay",
      "HDTV",
      "DVDRip",
      "BDRip",
      "WEBRip",
      "1080p",
      "720p",
      "2160p",
      "4K",
      "x264",
      "x265",
      "H264",
      "HEVC",
      "عربي",
      "العربية",
      "ترجمة",
    ];
    const noisePattern = new RegExp(`\\s*(?:${noise.join("|")})\\s*`, "gi");
    cleaned = cleaned.replace(noisePattern, " ").replace(/\s*\[[^\]]*\]\s*/g, " ");
    cleaned = cleaned.replace(/[^\p{L}\p{N}\s]/gu, " ");
    if (stripYears) cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, " ");
    return cleaned.replace(/\s{2,}/g, " ").trim();
  }

  private _extractYearFromTitle(title: string): number | null {
    if (!title) return null;
    const matches = [...title.matchAll(/\b(19|20)\d{2}\b/g)];
    if (matches.length > 0) {
      const m = matches[matches.length - 1];
      if (m) return parseInt(m[0]);
    }
    const attached = title.match(/(?:^|[ ( -])(19|20)\d{2}/);
    if (attached) {
      const val = parseInt(attached[1] || "");
      if (val >= 1900 && val <= 2099) return val;
    }
    return null;
  }

  private _normalizeForSimilarity(str: string): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private _jaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(" ").filter((w) => w.length > 1));
    const words2 = new Set(str2.split(" ").filter((w) => w.length > 1));
    if (words1.size === 0 || words2.size === 0) return 0;
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private _calculateTitleSimilarity(title1: string, title2: string): number {
    const n1 = this._normalizeForSimilarity(title1);
    const n2 = this._normalizeForSimilarity(title2);
    return (
      this._jaccardSimilarity(n1, n2) * 0.7 +
      (Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length)) * 0.3
    );
  }

  private _selectBestMatch(
    results: Array<Record<string, unknown>>,
    query: string,
    year?: number | null,
  ): { best: Record<string, unknown>; score: number } | null {
    if (!results || results.length === 0) return null;
    let bestResult: { best: Record<string, unknown>; score: number } | null = null;
    for (const item of results) {
      const title = (item.title as string) || (item.name as string) || "";
      let score = this._calculateTitleSimilarity(query, title);
      const itemYear =
        (item.release_date as string)?.slice(0, 4) || (item.first_air_date as string)?.slice(0, 4);
      if (year && itemYear && parseInt(itemYear) === year) score += 0.15;
      if (!bestResult || score > bestResult.score) {
        bestResult = { best: item, score };
      }
    }
    return bestResult && bestResult.score >= 0.65 ? bestResult : null;
  }

  private async _searchTMDB(
    title: string,
    year?: number | null,
    type?: string | null,
  ): Promise<TmdbSearchResult | null> {
    const searchType = type === "movie" ? "movie" : "tv";
    const cacheKey = `${title}|${year}|${type}`;
    if (this.searchCache.has(cacheKey)) return this.searchCache.get(cacheKey)!;

    const cleaned = this._cleanTitle(this._stripArabicPrefix(title), false);
    const extractedYear = this._extractYearFromTitle(cleaned);
    const finalYear = year || extractedYear;

    let results: Array<Record<string, unknown>> = [];
    try {
      const res = await this._fetchFromTmdb(`/search/${searchType}`, {
        query: cleaned,
        language: "en",
      });
      results = (res.results as Array<Record<string, unknown>>) || [];
    } catch {
      /* ignore */
    }

    let match = this._selectBestMatch(results, cleaned, finalYear);

    if (!match && results.length === 0 && finalYear) {
      try {
        const res = await this._fetchFromTmdb(`/discover/${searchType}`, {
          sort_by: "popularity.desc",
          language: "en",
          ...(searchType === "movie"
            ? { primary_release_year: finalYear }
            : { first_air_date_year: finalYear }),
        });
        const discoverResults = (res.results as Array<Record<string, unknown>>) || [];
        match = this._selectBestMatch(discoverResults.slice(0, 20), cleaned, finalYear);
      } catch {
        /* ignore */
      }
    }

    const result = match ? { result: match.best, score: match.score } : null;
    if (result) {
      if (this.searchCache.size >= this.SEARCH_CACHE_MAX_SIZE) this.searchCache.clear();
      this.searchCache.set(cacheKey, result);
    }
    return result;
  }

  private _isInBackoff(id: string | number): boolean {
    const entry = this.recentlyFailed.get(id);
    if (!entry) return false;
    if (Date.now() < entry.nextRetryAt) return true;
    this.recentlyFailed.delete(id);
    return false;
  }

  private _recordFailure(id: string | number, title: string | null = null): void {
    const prev = this.recentlyFailed.get(id);
    const attempts = (prev?.attempts || 0) + 1;
    this.recentlyFailed.set(id, {
      timestamp: Date.now(),
      attempts,
      nextRetryAt: Date.now() + Math.min(this.BACKOFF_BASE_MS * Math.pow(3, attempts - 1), 3600000),
      title: title || prev?.title || null,
    });
  }

  private _cleanupBackoff(): void {
    const now = Date.now();
    for (const [id, entry] of this.recentlyFailed) {
      if (now >= entry.nextRetryAt) this.recentlyFailed.delete(id);
    }
  }

  private _translateGenres(genres: string[]): string[] {
    const map: Record<string, string> = {
      Action: "أكشن",
      Adventure: "مغامرة",
      Animation: "أنيميشن",
      Comedy: "كوميديا",
      Crime: "جريمة",
      Documentary: "وثائقي",
      Drama: "دراما",
      Family: "عائلي",
      Fantasy: "خيال",
      History: "تاريخ",
      Horror: "رعب",
      Music: "صوتيات",
      Mystery: "غموض",
      Romance: "رومانسي",
      "Science Fiction": "خيال علمي",
      "TV Movie": "فيلم تلفزيوني",
      Thriller: "إثارة",
      War: "حرب",
      Western: "غربي",
      "Action & Adventure": "أكشن ومغامرة",
      Kids: "أطفال",
      News: "أخبار",
      Reality: "تلفزيون واقع",
      "Sci-Fi & Fantasy": "خيال علمي وفانتازيا",
      Soap: "دراما اجتماعية",
      Talk: "برنامج حواري",
      "War & Politics": "حرب وسياسة",
      Biography: "سيرة ذاتية",
    };
    return genres.map((g) => map[g] || g);
  }

  private _extractContentRating(details: Record<string, unknown>, type: string): string | null {
    try {
      if (type === "movie") {
        const releaseDates =
          (
            details.release_dates as {
              results?: Array<{
                iso_3166_1: string;
                release_dates?: Array<{ certification: string }>;
              }>;
            }
          )?.results || [];
        const us = releaseDates.find((r) => r.iso_3166_1 === "US");
        if (us?.release_dates?.length) {
          const c = us.release_dates[0]?.certification;
          if (c) return c;
        }
        for (const country of releaseDates) {
          if (country.release_dates?.length) {
            const c = country.release_dates[0]?.certification;
            if (c) return c;
          }
        }
      } else {
        const ratings =
          (details.content_ratings as { results?: Array<{ iso_3166_1: string; rating: string }> })
            ?.results || [];
        const us = ratings.find((r) => r.iso_3166_1 === "US");
        if (us?.rating) return us.rating;
        if (ratings.length > 0 && ratings[0]?.rating) return ratings[0].rating;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private _formatAgeRating(rating: string | null): string | null {
    if (!rating) return null;
    const str = String(rating).trim();
    if (/^\d+$/.test(str)) return `${str}+`;
    return str;
  }

  /**
   * قراءة مسار التخزين الأساسي لصور الإثراء من الإعدادات.
   *
   * القيمة قد تكون مساراً مطلقاً خارج جذر المشروع (مثل
   * `D:\assets\images\enriched` — التخزين الخارجي) أو مساراً نسبياً
   * لجذر الويب (مثل `/assets/images/enriched`). عند غياب الخدمة أو
   * المفتاح أو القيمة الفارغة يُعاد المسار الافتراضي القديم حفاظاً على
   * التوافق الرجعي مع المسارات المخزّنة سابقاً في `enriched_poster`/
   * `enriched_backdrop`.
   *
   * @returns مسار التخزين الأساسي (مطلق أو نسبي يبدأ بـ `/`).
   */
  private async _getStorageRoot(): Promise<string> {
    const value = this.settingsService
      ? await this.settingsService.getSetting("image_storage_root")
      : null;
    return typeof value === "string" && value.trim() ? value : "/assets/images/enriched";
  }

  private async _saveImage(
    imageUrl: string,
    mediaItem: Record<string, unknown>,
    storageMode: string,
    label: string,
  ): Promise<string> {
    if (!isSafeImageUrl(imageUrl)) throw new Error("Blocked image URL (SSRF protection)");
    const urlHash = crypto.createHash("md5").update(imageUrl).digest("hex").substring(0, 12);
    const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
    const filename = `${mediaItem.media_id}_${label}_${urlHash}${ext}`;

    const useMediaFolder =
      storageMode === "media_folder" && !!(mediaItem.file_path as string)?.trim();

    if (useMediaFolder) {
      const mediaDir = path.dirname(mediaItem.file_path as string);
      const targetDir = path.join(mediaDir, "metadata", "images");
      await fs.mkdir(targetDir, { recursive: true });
      const absolutePath = path.join(targetDir, filename);
      const res = await fetch(imageUrl, {
        signal: AbortSignal.timeout(ENRICHMENT_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(absolutePath, buffer);
      return absolutePath.replace(/\\/g, "/");
    }

    const storageRoot = await this._getStorageRoot();
    const storageDir = storageRoot.replace(/^\/+/, "");

    const typeDir =
      label === "poster"
        ? "posters"
        : label === "backdrop"
          ? "backdrops"
          : label === "person"
            ? "persons"
            : "";

    const baseDir = isAbsoluteDiskPath(storageRoot)
      ? path.join(storageRoot, typeDir)
      : path.join(process.cwd(), "public", storageDir, typeDir);
    const urlPrefix = isAbsoluteDiskPath(storageRoot)
      ? `${ENRICHED_WEB_PREFIX}${typeDir ? `/${typeDir}` : ""}`
      : `${storageRoot.replace(/\/+$/, "")}${typeDir ? `/${typeDir}` : ""}`;

    await fs.mkdir(baseDir, { recursive: true });
    const absolutePath = path.join(baseDir, filename);
    const relativePath = `${urlPrefix}/${filename}`;

    try {
      await fs.access(absolutePath);
      return relativePath.replace(/\\/g, "/");
    } catch {
      /* proceed */
    }

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(ENRICHMENT_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);
    return relativePath.replace(/\\/g, "/");
  }

  /**
   * يطبّق بيانات TMDB الكاملة على عنصر وسائط (تحديث الأعمدة + الأصناف + الطاقم
   * + شركات الإنتاج + وقت المزامنة) داخل معاملة واحدة ثم يزامن صف فهرس البحث.
   *
   * كل الكتابات (update/refreshEnrichmentStatus/saveGenres/savePeople/
   * saveProductionCompanies/updateCreditsSyncTime) تُنفَّذ داخل
   * `runInWriterContext` + `withTransaction` (SAVEPOINT) بحيث أي فشل في منتصف
   * العملية يسترجع كامل التغييرات بدل ترك حالة جزئية؛ وبعد نجاح المعاملة يُحدَّث
   * `media_search` عبر `addToIndex` كي تصبح الأصناف والطاقم والمفتاح الصوتي
   * الجديدة قابلة للبحث فوراً.
   *
   * تنزيل صور الطاقم (شبكة + قرص) يتم قبل فتح المعاملة: كان التنزيل داخل
   * الـ SAVEPOINT يُمسك قفل الكتابة الوحيد (WAL) لثوانٍ لكل صورة، فتحت
   * إثراءات الدفعات المتوازية (3 مهام) تتنافس كتابة سجل الأنشطة على الاتصال
   * الرئيسي مع كاتب الماسح/الدفعة وتنتهي بـ `SQLITE_BUSY`.
   *
   * @param media - صف الوسائط الحالي (يتضمن `media_id` و`type` و`library_id`).
   * @param detailsEn - بيانات TMDB بالإنجليزية (تحتوي credits والتصنيفات).
   * @param detailsAr - بيانات TMDB بالعربية (overview/tagline/production_companies).
   * @param options - خيارات الإثراء (تحميل الصور، وضع التخزين).
   */
  private async _applyEnrichmentFromDetails(
    media: Record<string, unknown>,
    detailsEn: Record<string, unknown>,
    detailsAr: Record<string, unknown>,
    options: EnrichmentOptions,
  ): Promise<void> {
    const tmdbType = media.type === "movie" ? "movie" : "tv";
    const contentRating = this._extractContentRating(detailsAr, tmdbType);
    const finalOverview =
      (detailsAr.overview as string)?.trim() || (detailsEn.overview as string)?.trim() || null;

    let originCountry: string | null = null;
    if (tmdbType === "movie") {
      const countries =
        ((detailsEn.production_countries || detailsAr.production_countries) as Array<{
          iso_3166_1: string;
        }>) || [];
      originCountry = countries[0]?.iso_3166_1 || null;
    } else {
      originCountry =
        (detailsEn.origin_country as string[])?.[0] ||
        (detailsAr.origin_country as string[])?.[0] ||
        null;
    }

    const tmdbReleaseDate = (detailsEn.release_date || detailsEn.first_air_date) as string | null;
    const parsedReleaseYear = tmdbReleaseDate ? new Date(tmdbReleaseDate).getFullYear() : null;
    const currentYear = new Date().getFullYear();
    const releaseYear =
      parsedReleaseYear !== null &&
      Number.isFinite(parsedReleaseYear) &&
      parsedReleaseYear <= currentYear
        ? parsedReleaseYear
        : null;

    const updateData: Record<string, unknown> = {
      tmdb_id: detailsEn.id,
      original_title: (detailsAr.original_title ||
        detailsAr.original_name ||
        detailsEn.original_name ||
        detailsEn.original_title) as string,
      overview: finalOverview,
      tagline:
        (detailsAr.tagline as string)?.trim() || (detailsEn.tagline as string)?.trim() || null,
      imdb_rating: detailsEn.vote_average ?? null,
      imdb_votes: detailsEn.vote_count ?? null,
      year: releaseYear,
      runtime: detailsEn.runtime ?? null,
      certification: this._formatAgeRating(contentRating),
      origin_country: originCountry,
      metadata_status: "completed",
      metadata_source: "tmdb",
      last_metadata_sync: new Date().toISOString(),
      enriched: 1,
    };

    if (options.downloadImages) {
      const posterPath = (detailsAr.poster_path || detailsEn.poster_path) as string;
      if (posterPath) {
        try {
          updateData.enriched_poster = await this._saveImage(
            `https://image.tmdb.org/t/p/w500${posterPath}`,
            media,
            options.storageMode,
            "poster",
          );
        } catch (e) {
          console.warn(`[Enrichment] Poster save failed: ${(e as Error).message}`);
        }
      }
      const backdropPath = (detailsAr.backdrop_path || detailsEn.backdrop_path) as string;
      if (backdropPath) {
        try {
          updateData.enriched_backdrop = await this._saveImage(
            `https://image.tmdb.org/t/p/w1280${backdropPath}`,
            media,
            options.storageMode,
            "backdrop",
          );
        } catch (e) {
          console.warn(`[Enrichment] Backdrop save failed: ${(e as Error).message}`);
        }
      }
    }

    const mediaId = media.media_id as number;

    // بناء قائمة الطاقم وتنزيل صورهم خارج معاملة الكتابة: التنزيل الشبكي داخل
    // الـ SAVEPOINT كان يمسك قفل الكتابة الوحيد (WAL) لثوانٍ لكل صورة
    // (المصدر المباشر لـ `SQLITE_BUSY` على كتابة سجل الأنشطة تحت إثراء دفعات
    // متوازية)، ونقل البناء قبل المعاملة يبقي الكتابات داخل معاملة قصيرة.
    const allPeople: Array<{
      person_id: number | null;
      name: string;
      role: string;
      character: string | null;
      department: string | null;
      profile_path: string | null;
      importance_order: number;
    }> = [];
    const castList = (detailsEn.credits as { cast?: Array<Record<string, unknown>> })?.cast || [];
    for (let i = 0; i < castList.length; i++) {
      const actor = castList[i];
      if (!actor || !actor.name) continue;
      allPeople.push({
        person_id: actor.id as number,
        name: actor.name as string,
        role: "Actor",
        character: (actor.character as string) || null,
        department: "Acting",
        profile_path: (actor.profile_path as string) || null,
        importance_order: (actor.order as number) ?? i,
      });
    }
    const crewList = (detailsEn.credits as { crew?: Array<Record<string, unknown>> })?.crew || [];
    for (let i = 0; i < crewList.length; i++) {
      const member = crewList[i];
      if (!member || !member.name) continue;
      allPeople.push({
        person_id: member.id as number,
        name: member.name as string,
        role: member.job as string,
        character: null,
        department: (member.department as string) || null,
        profile_path: (member.profile_path as string) || null,
        // TMDB crew entries have no `order` field, so the previous `member.order || 0`
        // pushed every crew row to importance_order=0 (interleaved with the lead actor).
        // Offset past the cast block so crew is always ordered after the actors.
        importance_order: allPeople.length + i,
      });
    }
    // تنزيل صور الأشخاص إذا كان الخيار مفعّلاً
    if (options.downloadCastImages) {
      for (const person of allPeople) {
        if (person.profile_path && person.profile_path.startsWith("/")) {
          try {
            const localPath = await this._saveImage(
              `https://image.tmdb.org/t/p/w500${person.profile_path}`,
              media,
              options.storageMode,
              "person",
            );
            person.profile_path = localPath; // استبدال الرابط بالمسار المحلي
          } catch (e) {
            console.warn(`[Enrichment] Failed to download person image for ${person.name}:`, e);
            // نُبقي الرابط الأصلي كفولباك
          }
        }
      }
    }

    await runInWriterContext(async () => {
      await this.enrichmentRepo.withTransaction(async () => {
        Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);
        const filtered = await this._filterUpdateData(updateData);
        await this.mediaRepo.update(mediaId, filtered);
        await this.mediaRepo.refreshEnrichmentStatus(mediaId);

        const enGenres = ((detailsEn.genres as Array<{ name: string }>) || []).map((g) => g.name);
        await this.enrichmentRepo.saveGenres(mediaId, this._translateGenres(enGenres));

        await this.enrichmentRepo.savePeople(mediaId, allPeople);

        const companies =
          ((detailsAr.production_companies || detailsEn.production_companies) as Array<{
            name?: string;
          }>) || [];
        await this.enrichmentRepo.saveProductionCompanies(mediaId, companies);
        await this.enrichmentRepo.updateCreditsSyncTime(mediaId);
      });
      await this.searchRepo.addToIndex(mediaId);
    });

    this.emit("media:changed", { id: media.media_id, libraryId: media.library_id });
    getEventBus().emit("media:changed", { id: media.media_id, libraryId: media.library_id });
  }

  /**
   * يثري بيانات عنصر وسائط واحد من TMDB (بحث أو معرّف يدوي) ويعيد ملخص النتيجة.
   *
   * يبث حدث `metadata_completed` على حافلة الخدمة المحلية دائمًا، وعلى الحافلة
   * العامة عندما يكون `emitGlobal` صحيحًا، كي يستطيع `CacheInvalidator` إبطال
   * مفاتيح الكاش وتبقى الواجهة الإدارية متابعة للنتائج عبر SSE.
   *
   * كما يسجّل خطوات الإثراء في الكونسول عبر `logger` (أحداث `enrichment.item_*`):
   * بدء المعالجة، نتيجة بحث TMDB مع درجة التشابه، النجاح، انتظار الموافقة،
   * أو سبب الفشل — بما يتيح تشخيص فشل العناصر (مثل حالة فلتر «بلا محتوى»).
   *
   * @param id - معرّف عنصر الوسائط في قاعدة البيانات.
   * @param options - خيارات الإثراء الجزئية (تُدمج مع الإعدادات المخزّنة).
   * @param emitGlobal - هل يُبث الحدث على الحافلة العامة؟ يُمرَّر `false` من
   * `enrichBatch` ليتجمّع بث النتائج في حدث واحد في نهاية الجلسة.
   * @returns كائن الحالة: `success`، ومصدر النجاح أو رسالة الخطأ، والعنوان عند توفّره.
   * قد يعيد `inProgress: true` إذا كان العنصر يُثرى حالياً من جلسة أخرى، أو
   * `skipped: true` إذا كان ماسح مكتبات نشطاً (يتخطى الإثراء لتجنب تصادم قفل
   * الكتابة WAL مع كاتب الماسح الذي يجمّد التطبيق).
   */
  async enrichItem(
    id: number,
    options: Partial<EnrichmentOptions> = {},
    emitGlobal = true,
  ): Promise<Record<string, unknown>> {
    if (this.isScanActive()) {
      const message = "Scan in progress, enrichment skipped";
      this.emit("metadata_completed", { id, success: false, skipped: true, error: message });
      if (emitGlobal) {
        getEventBus().emit("metadata_completed", {
          id,
          success: false,
          skipped: true,
          error: message,
        });
      }
      logger.warn("enrichment.item_skipped", { id, reason: "scan_active" });
      return { success: false, skipped: true, error: message, title: null };
    }
    if (this.inFlightItems.has(id)) {
      return {
        success: false,
        inProgress: true,
        message: "Already being enriched",
        title: null,
      };
    }
    this.inFlightItems.add(id);
    const finalOptions = await this._getOptions(options);
    this.emit("metadata_started", { id, type: "single", options: finalOptions });
    getEventBus().emit("metadata_started", { id, type: "single", options: finalOptions });

    // العنوان مرفوع إلى نطاق دالة كاملة كي يصل إليه catch لتمريره في سجل الفشل.
    let currentMediaTitle: string | null = null;
    try {
      const media = (await this.mediaRepo.getById(id)) as Record<string, unknown> | null;
      if (!media) throw new Error("Media not found");
      currentMediaTitle = media.title as string;

      logger.info("enrichment.item_started", {
        id,
        title: currentMediaTitle,
        type: media.type,
        year: media.year ?? null,
        force: finalOptions.force,
      });

      const excludedTypes = ["season", "episode", "series_sports", "series_deen"];
      if (excludedTypes.includes(media.type as string)) {
        this.emit("metadata_completed", {
          id,
          success: false,
          error: `Type ${media.type} is excluded`,
          skipped: true,
        });
        if (emitGlobal) {
          getEventBus().emit("metadata_completed", {
            id,
            success: false,
            error: `Type ${media.type} is excluded`,
            skipped: true,
          });
        }
        return {
          success: false,
          error: `Type ${media.type} is excluded`,
          skipped: true,
          title: currentMediaTitle,
        };
      }

      if (!finalOptions.force && this._isInBackoff(id)) {
        const entry = this.recentlyFailed.get(id)!;
        const remaining = Math.ceil((entry.nextRetryAt - Date.now()) / 1000);
        this.emit("metadata_completed", {
          id,
          success: false,
          error: `In backoff for ${remaining}s`,
          skipped: true,
        });
        if (emitGlobal) {
          getEventBus().emit("metadata_completed", {
            id,
            success: false,
            error: `In backoff for ${remaining}s`,
            skipped: true,
          });
        }
        return {
          success: false,
          error: `In backoff for ${remaining}s`,
          skipped: true,
          title: currentMediaTitle,
        };
      }
      let searchYear = media.year as number | undefined;
      let searchTitle = media.title as string;
      const tmdbType = media.type === "movie" ? "movie" : "tv";
      if (!searchYear) searchYear = this._extractYearFromTitle(searchTitle) ?? undefined;
      searchTitle = this._cleanTitle(this._stripArabicPrefix(searchTitle), false);

      let tmdbResult: TmdbSearchResult | null = null;

      if (finalOptions.tmdbId) {
        const [detailsAr, detailsEn] = await Promise.all([
          this._fetchFromTmdb(`/${tmdbType}/${finalOptions.tmdbId}`, {
            language: "ar",
            append_to_response: "credits",
          }),
          this._fetchFromTmdb(`/${tmdbType}/${finalOptions.tmdbId}`, {
            language: "en",
            append_to_response: "credits",
          }),
        ]);
        if (detailsAr && detailsEn) {
          await this._applyEnrichmentFromDetails(media, detailsEn, detailsAr, finalOptions);
          this.stats.success++;
          this.stats.totalEnriched++;
          this._logMetadataResult(id, currentMediaTitle, true);
          this.emit("metadata_completed", { id, success: true, source: "manual_tmdb_id" });
          if (emitGlobal) {
            getEventBus().emit("metadata_completed", {
              id,
              success: true,
              source: "manual_tmdb_id",
            });
          }
          logger.info("enrichment.item_success", {
            id,
            title: currentMediaTitle,
            source: "manual_tmdb_id",
          });
          return { success: true, source: "manual_tmdb_id", title: currentMediaTitle };
        }
      }

      tmdbResult = await this._searchTMDB(searchTitle, searchYear, tmdbType);

      logger.info("enrichment.search_result", {
        id,
        searchTitle,
        searchYear: searchYear ?? null,
        tmdbType,
        score: tmdbResult?.score ?? null,
        resultId: tmdbResult?.result?.id ?? null,
        resultTitle: tmdbResult ? tmdbResult.result.title || tmdbResult.result.name : null,
      });

      if (tmdbResult) {
        const APPROVAL_THRESHOLD_LOW = 0.65;
        const APPROVAL_THRESHOLD_HIGH = 0.8;

        if (
          tmdbResult.score >= APPROVAL_THRESHOLD_LOW &&
          tmdbResult.score < APPROVAL_THRESHOLD_HIGH
        ) {
          const detailsAr = await this._fetchFromTmdb(`/${tmdbType}/${tmdbResult.result.id}`, {
            language: "ar",
            append_to_response: "credits",
          });
          const detailsEn = await this._fetchFromTmdb(`/${tmdbType}/${tmdbResult.result.id}`, {
            language: "en",
            append_to_response: "credits",
          });
          const detailsJson = JSON.stringify({
            detailsAr,
            detailsEn,
            tmdbResult: tmdbResult.result,
          });
          const mediaTitle = currentMediaTitle ?? "";
          await runInWriterContext(() =>
            this.approvalRepo.createApproval(
              id,
              mediaTitle,
              tmdbResult.result.id as number,
              (tmdbResult.result.title || tmdbResult.result.name) as string,
              tmdbResult.score,
              detailsJson,
            ),
          );
          logger.warn("enrichment.item_pending_approval", {
            id,
            title: currentMediaTitle,
            score: tmdbResult.score,
          });
          this.emit("metadata_completed", {
            id,
            success: false,
            pending: true,
            message: "Awaiting user approval",
            similarityScore: tmdbResult.score,
          });
          if (emitGlobal) {
            getEventBus().emit("metadata_completed", {
              id,
              success: false,
              pending: true,
              message: "Awaiting user approval",
              similarityScore: tmdbResult.score,
            });
          }
          return {
            success: false,
            pending: true,
            message: "Awaiting user approval",
            similarityScore: tmdbResult.score,
            title: currentMediaTitle,
          };
        }

        if (tmdbResult.score < APPROVAL_THRESHOLD_LOW) {
          throw new Error(`Similarity too low (${tmdbResult.score})`);
        }

        const [detailsAr, detailsEn] = await Promise.all([
          this._fetchFromTmdb(`/${tmdbType}/${tmdbResult.result.id}`, {
            language: "ar",
            append_to_response: "credits",
          }),
          this._fetchFromTmdb(`/${tmdbType}/${tmdbResult.result.id}`, {
            language: "en",
            append_to_response: "credits",
          }),
        ]);

        await this._applyEnrichmentFromDetails(media, detailsEn, detailsAr, finalOptions);
      } else {
        throw new Error("No result from TMDB");
      }

      this.recentlyFailed.delete(id);
      this.stats.success++;
      this.stats.totalEnriched++;
      this._logMetadataResult(id, currentMediaTitle, true);
      this.emit("metadata_completed", { id, success: true, source: "tmdb" });
      if (emitGlobal) {
        getEventBus().emit("metadata_completed", { id, success: true, source: "tmdb" });
      }
      logger.info("enrichment.item_success", { id, title: currentMediaTitle, source: "tmdb" });
      return { success: true, source: "tmdb", title: currentMediaTitle };
    } catch (error) {
      this._recordFailure(id, null);
      this.stats.failed++;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("enrichment.item_failed", { id, title: currentMediaTitle, error: msg });
      this._logMetadataResult(id, currentMediaTitle, false, msg);
      this.emit("metadata_completed", { id, success: false, error: msg });
      if (emitGlobal) {
        getEventBus().emit("metadata_completed", { id, success: false, error: msg });
      }
      return { success: false, error: msg, title: String(id) };
    } finally {
      this.inFlightItems.delete(id);
    }
  }

  /**
   * Persists a metadata enrichment outcome (success or failure) into the
   * `activities` table as a system event so the admin events page can show
   * "تم تحديث بيانات العنصر ... بنجاح" / "خطأ في تحديث بيانات العنصر ...".
   *
   * الكتابة تُنفَّذ داخل `runInWriterContext` (اتصال الكاتب) بحيث لا تلمس
   * الإثراءُ الاتصالَ الرئيسي الذي تخدمه كل طلبات HTTP؛ كان تنفيذها عليه
   * يصطدم بقفل الكاتب WAL فيحجب الاتصال الرئيسي 30–90 ثانية (تجميد التطبيق
   * الكامل). وتُتخطى الكتابة أثناء مسح نشط لتجنب زيادة الحمل على كاتب الماسح.
   *
   * @param mediaId - The enriched media item id.
   * @param title - The media item title (nullable when only the id is known).
   * @param success - Whether enrichment completed successfully.
   * @param error - The failure message (only when `success` is false).
   */
  private _logMetadataResult(
    mediaId: number,
    title: string | null,
    success: boolean,
    error?: string,
  ): void {
    const repo = this.activityRepo;
    if (!repo || this.isScanActive()) return;
    void runInWriterContext(() =>
      repo
        .logActivity({
          entityType: "system",
          action: "metadata_update",
          module: "enrichment",
          severity: success ? "success" : "error",
          targetId: mediaId,
          details: { mediaId, title, success, error: error ?? null },
        })
        .catch((err: Error) => {
          console.error("[TmdbEnrichmentService] Failed to log metadata result:", err.message);
        }),
    );
  }

  /**
   * يسجّل قرار اعتماد/رفض اقتراح إثراء في سجل الأنشطة بأمان: أي فشل في التسجيل
   * يُطبَع فقط ولا يعطّل عملية الموافقة نفسها.
   *
   * مثل `_logMetadataResult` تُنفَّذ الكتابة داخل `runInWriterContext` (اتصال
   * الكاتب) وتُتخطى أثناء مسح نشط — لحماية الاتصال الرئيسي من تصادم قفل WAL.
   *
   * @param action - إجراء النظام (`enrichment_approved` | `enrichment_approval_failed` | `enrichment_rejected`).
   * @param details - تفاصيل القرار (معرّف الاقتراح والعنصر).
   * @param severity - شدة الحدث (`success` | `info` | `error`).
   */
  private _logSystemEvent(
    action: string,
    details: Record<string, unknown>,
    severity: "success" | "info" | "error",
  ): void {
    const repo = this.activityRepo;
    if (!repo || this.isScanActive()) return;
    void runInWriterContext(() =>
      repo
        .logActivity({
          entityType: "system",
          action,
          module: "enrichment",
          severity,
          details,
        })
        .catch((err: Error) => {
          console.error(`[TmdbEnrichmentService] Failed to log ${action}:`, err.message);
        }),
    );
  }

  cancelSession(sessionId: string): void {
    this.cancelledSessions.add(sessionId);
  }

  /**
   * يثري مجموعة عناصر وسائط بحد أقصى 3 مهام متزامنة، مع تتبّع التقدم لكل عنصر
   * وبث حدث واحد مجمّع من `metadata_completed` في النهاية.
   *
   * يُكتم البث العام للأحداث الفردية (عبر `emitGlobal=false`) ثم يبث الحدث
   * المجمّع على الحافلة العامة مع `success` كي يقرّر `CacheInvalidator` إبطال
   * الكاش مرة واحدة للجلسة كاملة بدلًا من N عملية إبطال متوازية.
   *
   * يسجّل بداية ونهاية الجلسة في الكونسول عبر `logger`
   * (حدثا `enrichment.batch_started` و`enrichment.batch_completed`).
   *
   * يتخطى الجلسة كاملةً ويعيد `skipped: true` إذا كان ماسح مكتبات نشطاً —
   * يمنع تصادم كاتب الإثراء مع كاتب الماسح على قفل الكتابة WAL الوحيد
   * (المصدر الرئيسي لتجميد التطبيق). العناصر التي يتخطاها الحارس الفردي
   * (إذا بدأ مسح أثناء جلسة قائمة) تُحتسب في `skipped` لا `failed`.
   *
   * @param ids - قائمة معرّفات عناصر الوسائط المراد إثراؤها.
   * @param options - خيارات الإثراء مع معرّف جلسة اختياري ودالة تقدم اختيارية.
   * @returns إحصاءات الجلسة: `successful`، `failed`، `pending`، `skipped`، `total`.
   */
  async enrichBatch(
    ids: number[],
    options: Partial<EnrichmentOptions> & {
      sessionId?: string;
      onProgress?: (data: Record<string, unknown>) => void;
    } = {},
  ): Promise<Record<string, unknown>> {
    const finalOptions = await this._getOptions(options);
    const { sessionId = null, onProgress = null } = options;
    const total = ids.length;
    if (this.isScanActive()) {
      const skippedPayload = {
        sessionId,
        ids,
        total,
        successful: 0,
        failed: 0,
        pending: 0,
        skipped: total,
        success: false,
      };
      this.emit("metadata_completed", skippedPayload);
      getEventBus().emit("metadata_completed", skippedPayload);
      logger.warn("enrichment.batch_skipped", { sessionId, total, reason: "scan_active" });
      return { successful: 0, failed: 0, pending: 0, skipped: total, total };
    }
    const limit = pLimit(3);
    const tracker: BatchTracker = {
      successful: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
      processed: 0,
    };

    logger.info("enrichment.batch_started", { sessionId, total });

    this.emit("metadata_started", { sessionId, ids, total, type: "batch", options: finalOptions });
    getEventBus().emit("metadata_started", {
      sessionId,
      ids,
      total,
      type: "batch",
      options: finalOptions,
    });

    await Promise.all(
      ids.map((id) =>
        limit(async () => {
          if (sessionId && this.cancelledSessions.has(sessionId)) return;
          const result = await this.enrichItem(id, finalOptions, false);
          tracker.processed++;
          if (result.success) tracker.successful++;
          else if (result.pending) tracker.pending++;
          else if (result.skipped) tracker.skipped++;
          else tracker.failed++;
          const progress = {
            sessionId,
            total,
            processed: tracker.processed,
            percentage: (tracker.processed / total) * 100,
            currentId: id,
            currentTitle: result.title || `ID: ${id}`,
            successful: tracker.successful,
            failed: tracker.failed,
            pending: tracker.pending,
            skipped: tracker.skipped,
          };
          this.emit("enrichment_progress", progress);
          if (onProgress) onProgress(progress);
        }),
      ),
    );

    this.emit("metadata_completed", {
      sessionId,
      ids,
      total,
      successful: tracker.successful,
      failed: tracker.failed,
      pending: tracker.pending,
      skipped: tracker.skipped,
      success: tracker.successful > 0,
    });
    getEventBus().emit("metadata_completed", {
      sessionId,
      ids,
      total,
      successful: tracker.successful,
      failed: tracker.failed,
      pending: tracker.pending,
      skipped: tracker.skipped,
      success: tracker.successful > 0,
    });
    logger.info("enrichment.batch_completed", {
      sessionId,
      total,
      successful: tracker.successful,
      failed: tracker.failed,
      pending: tracker.pending,
      skipped: tracker.skipped,
    });
    return {
      successful: tracker.successful,
      failed: tracker.failed,
      pending: tracker.pending,
      skipped: tracker.skipped,
      total,
    };
  }

  async enrichByFilter(
    filters: Record<string, unknown> = {},
    options: Partial<EnrichmentOptions> & {
      sessionId?: string;
      onProgress?: (data: Record<string, unknown>) => void;
    } = {},
  ): Promise<Record<string, unknown>> {
    const ids = await this.enrichmentRepo.getAllIdsForEnrichment(
      filters as { libraryId?: string; type?: string; onlyEmpty?: boolean },
    );
    if (ids.length === 0) return { success: true, message: "No items match filter" };
    return this.enrichBatch(ids, options);
  }

  async getItemsByFilter(
    filters: Record<string, unknown> = {},
    limit = 0,
    offset = 0,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    if (limit > 0) {
      const page = Math.floor(offset / limit) + 1;
      const result = await this.enrichmentRepo.getIdsForEnrichmentPaginated(
        filters as { libraryId?: string; type?: string; onlyEmpty?: boolean },
        page,
        limit,
      );
      return { items: result.ids.map((id: number) => ({ media_id: id, id })), total: result.total };
    }
    const ids = await this.enrichmentRepo.getAllIdsForEnrichment(
      filters as { libraryId?: string; type?: string; onlyEmpty?: boolean },
    );
    return { items: ids.map((id: number) => ({ media_id: id, id })), total: ids.length };
  }

  async createPendingApproval(
    mediaId: number,
    mediaTitle: string,
    tmdbResult: Record<string, unknown>,
    similarityScore: number,
    detailsAr: Record<string, unknown>,
    detailsEn: Record<string, unknown>,
  ): Promise<void> {
    const json = JSON.stringify({ detailsAr, detailsEn, tmdbResult });
    await this.approvalRepo.createApproval(
      mediaId,
      mediaTitle,
      tmdbResult.id as number,
      (tmdbResult.title || tmdbResult.name) as string,
      similarityScore,
      json,
    );
  }

  async getPendingApprovals(limit = 100): Promise<Array<Record<string, unknown>>> {
    return this.approvalRepo.getPending(limit) as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * يوافق إدارياً على اقتراح إثراء معلّق ويطبّق بياناته على العنصر.
   *
   * تُنفَّذ مرحلة التطبيق وتحديث حالة الموافقة إلى `approved` داخل **كتلة كاتب
   * واحدة** (`runInWriterContext` موحّد، 3.5.9) بدل كتلتين منفصلتين — هذا يزيل
   * تصادم كاتِب-كاتب المحتمل (N28) بين كتلة الإثراء وكتلة الحالة، ويضمن تسلسلاً
   * كاملاً للعملية على اتصال الكاتب.
   *
   * @param approvalId - معرّف طلب الموافقة.
   * @param options - خيارات إثراء جزئية قد تُمرَّر لتجاوز الافتراضات.
   * @returns كائن نجاح بمحتوى التطبيق.
   * @throws Error إذا لم يوجد الطلب أو لم تكن حالته `pending` أو لم يوجد العنصر أو فشل التطبيق (وتُسجَّل الحالة `failed`).
   */
  async approveEnrichment(
    approvalId: number,
    options: Partial<EnrichmentOptions> = {},
  ): Promise<Record<string, unknown>> {
    const approval = (await this.approvalRepo.getById(approvalId)) as Record<
      string,
      unknown
    > | null;
    if (!approval) throw new Error("Approval not found");
    if (approval.status !== "pending") throw new Error("Already processed");

    const details = JSON.parse(approval.details_json as string) as Record<string, unknown>;
    const { detailsAr, detailsEn, tmdbResult } = details as {
      detailsAr: Record<string, unknown>;
      detailsEn: Record<string, unknown>;
      tmdbResult: Record<string, unknown>;
    };
    const media = (await this.mediaRepo.getById(approval.media_id as number)) as Record<
      string,
      unknown
    > | null;
    if (!media) throw new Error("Media not found");

    try {
      const finalOptions = await this._getOptions(options);
      // كتلة كاتب واحدة موحّدة: تطبيق الإثراء ثم تحديث حالة الموافقة (3.5.9).
      await runInWriterContext(async () => {
        await this._applyEnrichmentFromDetails(media, detailsEn, detailsAr, finalOptions);
        await this.approvalRepo.updateStatus(approvalId, "approved");
      });
      this._logSystemEvent(
        "enrichment_approved",
        { approvalId, mediaId: media.media_id, title: media.title ?? null },
        "success",
      );
      return { success: true, message: "Enrichment applied" };
    } catch (err) {
      await runInWriterContext(() => this.approvalRepo.updateStatus(approvalId, "failed"));
      this._logSystemEvent(
        "enrichment_approval_failed",
        { approvalId, mediaId: media.media_id, error: (err as Error).message },
        "error",
      );
      throw err;
    }
  }

  async rejectEnrichment(approvalId: number): Promise<Record<string, unknown>> {
    await runInWriterContext(() => this.approvalRepo.updateStatus(approvalId, "rejected"));
    this._logSystemEvent("enrichment_rejected", { approvalId }, "info");
    return { success: true };
  }

  async approveAllPendingEnrichments(
    options: Partial<EnrichmentOptions> = {},
  ): Promise<Record<string, unknown>> {
    const pending = (await this.approvalRepo.getAllPending()) as Array<Record<string, unknown>>;
    let successCount = 0,
      failCount = 0;
    const limit = pLimit(3);
    await Promise.all(
      pending.map((approval) =>
        limit(async () => {
          try {
            await this.approveEnrichment(approval.id as number, options);
            successCount++;
          } catch {
            failCount++;
          }
        }),
      ),
    );
    return { count: successCount, failed: failCount, total: pending.length };
  }

  /**
   * يعيد ضبط بيانات الإثراء لعنصر وسائط (حقول TMDB والأصناف والطاقم).
   *
   * يُنفَّذ الحذف ثم إعادة توليف صف `media_search` داخل `runInWriterContext`
   * حتى يبقى فهرس البحث متزامناً مع الحالة بعد الإعادة (بدل بقاء أنقاض
   * الأصناف/الطاقم القديمة في صف الفهرس).
   *
   * @param mediaId - معرّف عنصر الوسائط.
   * @returns كائن الحالة مع رسالة النجاح.
   * @throws خطأً إذا لم يوجد العنصر.
   */
  async resetItemMetadata(mediaId: number): Promise<Record<string, unknown>> {
    const media = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | null;
    if (!media) throw new Error("Media not found");
    await runInWriterContext(async () => {
      await this.enrichmentRepo.resetEnrichment(mediaId);
      await this.searchRepo.addToIndex(mediaId);
    });
    this.emit("media:changed", { id: mediaId, libraryId: media.library_id });
    return { success: true, message: "Enrichment data reset" };
  }

  async uploadImageFromUrl(
    mediaId: number,
    imageUrl: string,
    type: string,
    storageMode = "local",
  ): Promise<Record<string, unknown>> {
    const media = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | null;
    if (!media) throw new Error("Media not found");
    const savedPath = await this._saveImage(
      imageUrl,
      media,
      storageMode,
      type === "poster" ? "poster" : "backdrop",
    );
    const updateData: Record<string, unknown> = { last_metadata_sync: new Date().toISOString() };
    if (type === "poster") updateData.enriched_poster = savedPath;
    else updateData.enriched_backdrop = savedPath;
    await runInWriterContext(() => this.mediaRepo.update(mediaId, updateData));
    this.emit("media:changed", { id: mediaId, libraryId: media.library_id });
    return { success: true, path: savedPath, type };
  }

  async testApiKey(apiKey: string): Promise<Record<string, unknown>> {
    const url = `${this.TMDB_BASE_URL}/movie/550?api_key=${apiKey}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ENRICHMENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TMDB API key test failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async testConnection(): Promise<Record<string, unknown>> {
    return this._fetchFromTmdb("/movie/550");
  }

  getStats(): EnrichmentStats {
    return { ...this.stats };
  }
  resetStats(): void {
    this.stats = { totalEnriched: 0, success: 0, failed: 0, lastRun: null };
  }
}


 