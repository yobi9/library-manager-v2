import { EventEmitter } from "events";
import { MediaRepository } from "../repositories/media-repository";
import { TranslationCacheRepository } from "../repositories/translation-cache-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { getEventBus } from "./event-bus";
import { runInWriterContext } from "../db/db";
import { createProvider, GoogleTranslateProvider } from "./translation-provider";

const MAX_CONCURRENT = 3;
const MIN_TIME_MS = 500;
const HIGH_WATER = 50;
const COOLDOWN_MS = 10 * 60 * 1000;
const TRANSLATION_TIMEOUT = 15000;

const TRANSLATION_ALLOWED_COLUMNS = new Set([
  "overview",
  "tagline",
  "title",
  "original_title",
  "year",
  "type",
  "imdb_rating",
  "certification",
  "country",
  "release_date",
  "runtime",
  "poster_path",
  "backdrop_path",
  "enriched_poster",
  "enriched_backdrop",
  "trailer_url",
  "language",
  "status",
  "is_available",
  "is_pinned",
  "sort_order",
]);

function hasArabic(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export class TranslationService extends EventEmitter {
  private mediaRepo: MediaRepository;
  private cache: TranslationCacheRepository;
  private provider: GoogleTranslateProvider | null = null;
  private activityRepo?: ActivityRepository;
  private _rateLimited = false;
  private _cooldownUntil: number | null = null;
  private _abortControllers = new Set<AbortController>();
  private _activeCount = 0;
  private _queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }> = [];
  private _processingQueue = false;

  constructor(
    mediaRepo: MediaRepository,
    cache: TranslationCacheRepository,
    activityRepo?: ActivityRepository,
  ) {
    super();
    this.mediaRepo = mediaRepo;
    this.cache = cache;
    this.activityRepo = activityRepo;
    this.provider = createProvider();
  }

  get isAvailable(): boolean {
    return this.provider?.isAvailable ?? false;
  }

  get isRateLimited(): boolean {
    return this._rateLimited;
  }

  get stats() {
    return {
      isAvailable: this.isAvailable,
      isRateLimited: this._rateLimited,
      cooldownUntil: this._cooldownUntil,
      cooldownRemaining: this._cooldownUntil ? Math.max(0, this._cooldownUntil - Date.now()) : 0,
      queued: this._queue.length,
      running: this._activeCount,
    };
  }

  private async _schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (this._activeCount < MAX_CONCURRENT) {
      this._activeCount++;
      try {
        return await fn();
      } finally {
        this._activeCount--;
        this._processQueue();
      }
    }
    return new Promise<T>((resolve, reject) => {
      this._queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
    });
  }

  private _processQueue(): void {
    if (this._processingQueue || this._queue.length === 0 || this._activeCount >= MAX_CONCURRENT)
      return;
    this._processingQueue = true;
    while (this._queue.length > 0 && this._activeCount < MAX_CONCURRENT) {
      const item = this._queue.shift();
      if (!item) break;
      this._activeCount++;
      item
        .fn()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this._activeCount--;
          this._processingQueue = false;
          this._processQueue();
        });
    }
    this._processingQueue = false;
  }

  async translateText(text: string, targetLang = "ar"): Promise<string | null> {
    if (!text?.trim()) return text;
    if (!this.isAvailable) return text;
    if (this._rateLimited) return null;

    const cached = await this.cache.get(text, targetLang);
    if (cached) return cached;

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this._rateLimited) return null;

      const controller = new AbortController();
      this._abortControllers.add(controller);
      const timer = setTimeout(() => {
        timer.unref();
        controller.abort(new Error("Translation timed out"));
      }, TRANSLATION_TIMEOUT);

      try {
        const result = await this._schedule(async () => {
          if (this._rateLimited) return null;
          return await this.provider!.translate(text, targetLang, controller.signal);
        });

        if (result === null) return null;
        await this.cache.set(text, targetLang, result as string);
        return result as string;
      } catch (err) {
        const msg = (err as Error).message || "";

        if (/Too Many Requests|429|too many|timed out|timeout/i.test(msg)) {
          this._enterCooldown();
          return null;
        }

        if (
          /ECONNRESET|socket hang up|ETIMEDOUT|ECONNREFUSED|fetch failed|network|abort/i.test(msg)
        ) {
          if (attempt < 3)
            await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
          continue;
        }

        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
      } finally {
        clearTimeout(timer);
        this._abortControllers.delete(controller);
      }
    }

    return null;
  }

  async translateBatch(
    texts: string[],
    targetLang = "ar",
    onProgress?: (done: number, total: number) => void,
  ): Promise<Array<{ original: string; translated: string | null }>> {
    if (!texts?.length) return [];
    const unique = [...new Set(texts.filter((t) => t?.trim()))];
    if (unique.length === 0) return [];

    if (this.provider?.translateBatch) {
      try {
        const results = await this.provider.translateBatch(unique, targetLang);
        if (results && results.length === unique.length) {
          return results.map((translated, idx) => ({ original: unique[idx]!, translated }));
        }
      } catch {
        /* fall through */
      }
    }

    const results: Array<{ original: string; translated: string | null }> = [];
    const chunkSize = 5;
    for (let i = 0; i < unique.length; i += chunkSize) {
      if (this._rateLimited) break;
      const chunk = unique.slice(i, i + chunkSize);
      for (const text of chunk) {
        if (this._rateLimited) break;
        const translated = await this.translateText(text, targetLang);
        results.push({ original: text, translated });
        if (onProgress) onProgress(results.length, unique.length);
      }
      if (i + chunkSize < unique.length && !this._rateLimited) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return results;
  }

  cancelAll(): void {
    for (const controller of this._abortControllers) {
      try {
        controller.abort(new Error("Service shutdown"));
      } catch {
        /* ignore */
      }
    }
    this._abortControllers.clear();
  }

  resetRateLimit(): void {
    this._rateLimited = false;
    this._cooldownUntil = null;
  }

  private _enterCooldown(): void {
    this._rateLimited = true;
    this._cooldownUntil = Date.now() + COOLDOWN_MS;
    setTimeout(() => {
      this._rateLimited = false;
      this._cooldownUntil = null;
    }, COOLDOWN_MS).unref();
  }

  async getItemForTranslation(mediaId: number): Promise<Record<string, unknown> | null> {
    return this.mediaRepo.getById(mediaId) as Promise<Record<string, unknown> | null>;
  }

  async translateItemFields(item: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this._rateLimited) return {};

    const updateData: Record<string, unknown> = {};
    const fields = [
      { src: "overview", dest: "overview" },
      { src: "tagline", dest: "tagline" },
    ];

    for (const { src, dest } of fields) {
      if (this._rateLimited) break;
      const text = item[src] as string | undefined;
      if (!text || hasArabic(text)) continue;
      try {
        const result = await this.translateText(text);
        if (result) updateData[dest] = result;
      } catch {
        /* skip */
      }
    }

    return updateData;
  }

  /**
   * يترجم أسماء الطاقم والشخصيات غير العربية لعنصر وسائط.
   *
   * يقرأ الأسماء/الشخصيات من `media_people`، يترجمها عبر المزوّد، ثم يحدّث
   * الصفوف عبر `mediaRepo.batchUpdatePersonNames/batchUpdatePersonCharacters`.
   * عمليات الكتابة تُنفَّذ داخل `runInWriterContext` (3.5.10) فتذهب على اتصال
   * الكاتب بدل الرئيسي المشترك — الترجمة الدفعية لا تصطدم بقراءات العملاء ولا
   * بكاتب الماسح.
   *
   * @param mediaId - معرّف عنصر الوسائط.
   * @returns عدد الأسماء والشخصيات المحدَّثة.
   */
  async translatePeople(mediaId: number): Promise<{ updatedNames: number; updatedChars: number }> {
    if (this._rateLimited) return { updatedNames: 0, updatedChars: 0 };

    let people: Array<{ id: number; name: string; character: string | null }> = [];
    try {
      people = await this.mediaRepo.getPeopleByMediaId(mediaId);
    } catch {
      return { updatedNames: 0, updatedChars: 0 };
    }

    if (people.length === 0) return { updatedNames: 0, updatedChars: 0 };

    const uniqueNames = new Set<string>();
    const uniqueChars = new Set<string>();
    const nameToIds = new Map<string, number[]>();
    const charToIds = new Map<string, number[]>();

    for (const person of people) {
      if (person.name && !hasArabic(person.name)) {
        uniqueNames.add(person.name);
        const ids = nameToIds.get(person.name) || [];
        ids.push(person.id);
        nameToIds.set(person.name, ids);
      }
      if (person.character && !hasArabic(person.character)) {
        uniqueChars.add(person.character);
        const ids = charToIds.get(person.character) || [];
        ids.push(person.id);
        charToIds.set(person.character, ids);
      }
    }

    const nameArr = [...uniqueNames];
    const nameResults = await Promise.allSettled(nameArr.map((name) => this.translateText(name)));
    const nameTranslations = new Map<string, string>();
    for (let i = 0; i < nameArr.length; i++) {
      const name = nameArr[i]!;
      const result = nameResults[i];
      if (result && result.status === "fulfilled" && result.value && result.value !== name) {
        nameTranslations.set(name, result.value);
      }
    }

    const charArr = [...uniqueChars];
    const charResults = await Promise.allSettled(charArr.map((char) => this.translateText(char)));
    const charTranslations = new Map<string, string>();
    for (let i = 0; i < charArr.length; i++) {
      const char = charArr[i]!;
      const result = charResults[i];
      if (result && result.status === "fulfilled" && result.value && result.value !== char) {
        charTranslations.set(char, result.value);
      }
    }

    const nameUpdates: Array<{ id: number; value: string }> = [];
    for (const [name, translation] of nameTranslations) {
      const ids = nameToIds.get(name) || [];
      for (const id of ids) nameUpdates.push({ id, value: translation });
    }
    if (nameUpdates.length > 0)
      await runInWriterContext(() => this.mediaRepo.batchUpdatePersonNames(nameUpdates));

    const charUpdates: Array<{ id: number; value: string }> = [];
    for (const [char, translation] of charTranslations) {
      const ids = charToIds.get(char) || [];
      for (const id of ids) charUpdates.push({ id, value: translation });
    }
    if (charUpdates.length > 0)
      await runInWriterContext(() => this.mediaRepo.batchUpdatePersonCharacters(charUpdates));

    return { updatedNames: nameTranslations.size, updatedChars: charTranslations.size };
  }

  /**
   * يطبّق الحقول المترجمة المسموحة على عنصر وسائط واحد.
   *
   * يُفلتر الإدخال حسب `TRANSLATION_ALLOWED_COLUMNS` ثم يحدّث الصف عبر
   * `mediaRepo.update` داخل `runInWriterContext` (3.5.10) — كتابة الترجمة تذهب
   * على اتصال الكاتب بدل الرئيسي المشترك (نفس العزل الموصوف في `translatePeople`).
   *
   * @param mediaId - معرّف عنصر الوسائط.
   * @param updateData - خريطة الحقول المترجمة (قد تتضمن مفاتيح خارج المسموح تُفلتَر).
   */
  async updateItemFields(mediaId: number, updateData: Record<string, unknown>): Promise<void> {
    if (Object.keys(updateData).length === 0) return;
    const safeData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (TRANSLATION_ALLOWED_COLUMNS.has(k)) safeData[k] = v;
    }
    if (Object.keys(safeData).length === 0) return;
    await runInWriterContext(() => this.mediaRepo.update(mediaId, safeData));
  }

  async processItemTranslation(
    mediaId: number,
    item: Record<string, unknown>,
    statusCallback: (id: number, status: Record<string, unknown>) => void,
  ): Promise<void> {
    const startTime = Date.now();

    statusCallback(mediaId, {
      status: "processing",
      startedAt: new Date().toISOString(),
      updatedFields: [],
      updatedPeople: null,
    });

    try {
      const updateData = await this.translateItemFields(item);
      const peopleResult = await this.translatePeople(mediaId);

      if (Object.keys(updateData).length > 0) {
        await this.updateItemFields(mediaId, updateData);
        getEventBus().emit("media:changed", { id: mediaId });
      }
      if (peopleResult.updatedNames > 0 || peopleResult.updatedChars > 0) {
        getEventBus().emit("media:changed", { id: mediaId });
      }

      statusCallback(mediaId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        updatedFields: Object.keys(updateData),
        updatedPeople: peopleResult,
      });
    } catch (err) {
      statusCallback(mediaId, {
        status: "failed",
        error: (err as Error).message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * يترجم دفعة من عناصر الوسائط في الخلفية (حتى 500 عنصر).
   *
   * كل كتابة عنصر تذهب على اتصال الكاتب (عبر `translatePeople`/`updateItemFields`
   * الملفوفَين بـ `runInWriterContext`) ويُطلق قفل الكتابة بين العناصر عبر
   * `setImmediate` (3.5.10) — كتابات العملاء تجد نوافذ تنفيذ أثناء الدفعة بدل
   * التجميد خلف كاتب مستمر.
   *
   * @param mediaIds - قائمة معرّفات الوسائط للترجمة.
   * @param session - كائن الجلسة الحيّ الذي يحدّثه الأسلوب (التقدّم/النتائج/الإلغاء).
   */
  async processBatch(
    mediaIds: number[],
    session: {
      cancelled?: boolean;
      completed?: boolean;
      error?: string;
      results: Array<Record<string, unknown>>;
      successCount: number;
      failCount: number;
      progress: number;
    },
  ): Promise<void> {
    for (let i = 0; i < mediaIds.length; i++) {
      if (session.cancelled || this._rateLimited) break;

      const mediaId = mediaIds[i]!;
      const result: Record<string, unknown> = {
        id: mediaId,
        success: false,
        updatedFields: [],
        updatedPeople: null,
      };

      try {
        const item = await this.mediaRepo.getById(mediaId);
        if (!item) {
          result.error = "Not found";
        } else {
          const updateData = await this.translateItemFields(item as Record<string, unknown>);
          const peopleResult = await this.translatePeople(mediaId);

          if (Object.keys(updateData).length > 0) {
            await this.updateItemFields(mediaId, updateData);
            getEventBus().emit("media:changed", { id: mediaId });
          }
          if (peopleResult.updatedNames > 0 || peopleResult.updatedChars > 0) {
            getEventBus().emit("media:changed", { id: mediaId });
          }

          if (this._rateLimited) {
            result.error = "Rate limited";
            result.rateLimited = true;
            result.updatedFields = Object.keys(updateData);
            result.updatedPeople = peopleResult;
          } else {
            result.success = true;
            result.updatedFields = Object.keys(updateData);
            result.updatedPeople = peopleResult;
          }
        }
      } catch (err) {
        result.error = (err as Error).message || "Unknown error";
      }

      session.results.push(result);
      if (result.success) session.successCount++;
      else session.failCount++;
      session.progress = Math.round(((i + 1) / mediaIds.length) * 100);
      getEventBus().emit("translation_progress", {
        sessionId: (session as { id?: string }).id ?? "unknown",
        processed: i + 1,
        total: mediaIds.length,
        percentage: session.progress,
        successful: session.successCount,
        failed: session.failCount,
        currentId: mediaId,
      });

      // أطلق قفل الكتابة بين عناصر الدفعة (3.5.10): نفس نمط `setImmediate`
      // المعتمد في الماسح — يعطي كتابات العملاء نافذة تنفيذ بين العناصر.
      await new Promise((resolve) => setImmediate(resolve));
    }

    session.completed = !(session.cancelled || this._rateLimited);
    getEventBus().emit("translation_progress", {
      sessionId: (session as { id?: string }).id ?? "unknown",
      processed: mediaIds.length,
      total: mediaIds.length,
      percentage: 100,
      successful: session.successCount,
      failed: session.failCount,
      type: session.completed ? "completed" : "cancelled",
    });

    this._logSystemEvent(
      session.completed ? "translation_batch_completed" : "translation_batch_cancelled",
      {
        sessionId: (session as { id?: string }).id ?? "unknown",
        total: mediaIds.length,
        successful: session.successCount,
        failed: session.failCount,
      },
    );
  }

  /**
   * يسجّل نهاية تشغيل ترجمة مجمّعة في سجل الأنشطة بأمان: أي فشل في التسجيل
   * يُطبَع فقط ولا يعطّل عملية الترجمة نفسها.
   *
   * @param action - إجراء النظام (`translation_batch_completed` | `translation_batch_cancelled`).
   * @param details - تفاصيل الجلسة (معرّفها وعدد الناجح/الفاشل).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "translation",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[TranslationService] Failed to log ${action}:`, err.message);
      });
  }
}
