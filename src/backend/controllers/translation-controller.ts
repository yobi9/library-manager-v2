import { BaseController, ControllerResult } from "./base-controller";
import { TranslationService } from "../services/translation-service";
import { TranslationCacheRepository } from "../repositories/translation-cache-repository";
import { MediaService } from "../services/media-service";

const STALE_CLEANUP_INTERVAL = 5 * 60 * 1000;
const STALE_TTL = 10 * 60 * 1000;
const SESSION_DELETE_DELAY = 60 * 1000;

function generateId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class TranslationController extends BaseController {
  private translationService: TranslationService;
  private cacheRepo: TranslationCacheRepository;
  private mediaService: MediaService;
  private activeSessions = new Map<string, Record<string, unknown>>();
  private translationStatuses = new Map<number, Record<string, unknown>>();

  constructor(
    translationService: TranslationService,
    cacheRepo: TranslationCacheRepository,
    mediaService: MediaService,
  ) {
    super();
    this.translationService = translationService;
    this.cacheRepo = cacheRepo;
    this.mediaService = mediaService;
    setInterval(() => this._cleanupStaleEntries(), STALE_CLEANUP_INTERVAL).unref();
  }

  private _cleanupStaleEntries(): void {
    const cutoff = Date.now() - STALE_TTL;
    for (const [mediaId, status] of this.translationStatuses) {
      const ts = (status.completedAt || status.failedAt) as string | undefined;
      if (ts && new Date(ts).getTime() < cutoff) this.translationStatuses.delete(mediaId);
    }
    for (const [id, session] of this.activeSessions) {
      if (session.completed) {
        const results = session.results as Array<Record<string, unknown>> | undefined;
        if (results?.length) {
          const last = results[results.length - 1];
          if (last?.timestamp && new Date(last.timestamp as string).getTime() < cutoff)
            this.activeSessions.delete(id);
        }
      }
    }
  }

  async translateItem(mediaId: number): Promise<ControllerResult> {
    if (this.translationService.isRateLimited) {
      return this.error("Rate limited", 429);
    }

    const item = await this.translationService.getItemForTranslation(mediaId);
    if (!item) return this.notFound("Item not found");

    this.translationService
      .processItemTranslation(mediaId, item, (id, status) => {
        this.translationStatuses.set(id, status);
      })
      .catch(() => {
        this.translationStatuses.set(mediaId, {
          status: "failed",
          error: "Background error",
          failedAt: new Date().toISOString(),
        });
      });

    setTimeout(() => this.translationStatuses.delete(mediaId), STALE_TTL);

    return this.ok(
      { mediaId, message: "Translation started in background" },
      "تم بدء الترجمة في الخلفية",
    );
  }

  async getTranslationStatus(mediaId: number): Promise<ControllerResult> {
    const status = this.translationStatuses.get(mediaId);
    if (!status) return this.notFound("No translation job found for this media ID");
    return this.ok({ mediaId, ...status });
  }

  async translateBatch(body: { mediaIds?: number[] }): Promise<ControllerResult> {
    const rawIds = body.mediaIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0)
      return this.error("mediaIds array required", 400);

    if (this.translationService.isRateLimited) {
      return this.error("Rate limited", 429);
    }

    const maxItems = 500;
    const mediaIds = rawIds.slice(0, maxItems);
    const sessionId = this._startBatch(mediaIds);

    return this.ok({ sessionId, message: "Batch started", total: mediaIds.length });
  }

  /**
   * Starts background translation of every item matching an optional filter.
   *
   * @param body - Optional libraryId/type filters.
   * @returns Session id and the resolved item count (capped at 500).
   */
  async translateByFilter(body: { libraryId?: string; type?: string }): Promise<ControllerResult> {
    if (this.translationService.isRateLimited) {
      return this.error("Rate limited", 429);
    }

    const result = await this.mediaService.getMediaByFilter({
      libraryId: body.libraryId ? Number(body.libraryId) : undefined,
      type: body.type && body.type !== "all" ? body.type : undefined,
      filterBy: "all",
      page: 1,
      limit: 100000,
    });

    const mediaIds = (result.items as Array<{ media_id: number }>)
      .map((i) => i.media_id)
      .filter(Boolean);
    if (mediaIds.length === 0)
      return this.ok({ sessionId: null, total: 0, message: "لا توجد عناصر تطابق الفلتر" });

    const maxItems = 500;
    const sessionId = this._startBatch(mediaIds.slice(0, maxItems));

    return this.ok({
      sessionId,
      message: "Batch started",
      total: Math.min(mediaIds.length, maxItems),
    });
  }

  /**
   * Registers a batch translation session and runs it in the background.
   *
   * @param mediaIds - Media IDs to translate (already capped).
   * @returns The generated session id.
   */
  private _startBatch(mediaIds: number[]): string {
    const sessionId = generateId();
    const session: Record<string, unknown> = {
      id: sessionId,
      cancelled: false,
      completed: false,
      progress: 0,
      total: mediaIds.length,
      successCount: 0,
      failCount: 0,
      results: [] as Array<Record<string, unknown>>,
    };
    this.activeSessions.set(sessionId, session);

    this.translationService
      .processBatch(mediaIds, session as Parameters<typeof this.translationService.processBatch>[1])
      .catch((err: Error) => {
        session.error = err.message || "Fatal error";
        session.completed = true;
      })
      .finally(() => {
        setTimeout(() => this.activeSessions.delete(sessionId), SESSION_DELETE_DELAY).unref();
      });

    return sessionId;
  }

  async getBatchStatus(sessionId: string): Promise<ControllerResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return this.notFound("Session not found or expired");
    return this.ok({
      sessionId,
      total: session.total,
      progress: session.progress,
      completed: session.completed,
      cancelled: session.cancelled,
      successCount: session.successCount,
      failCount: session.failCount,
      results: session.results,
    });
  }

  async cancelBatch(sessionId: string): Promise<ControllerResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return this.notFound("Session not found");
    session.cancelled = true;
    this.translationService.cancelAll();
    return this.ok({ message: "Batch translation cancelled" });
  }

  async getHealth(): Promise<ControllerResult> {
    const ts = this.translationService;
    const cacheStats = await this.cacheRepo.stats().catch(() => ({ cachedEntries: 0 }));
    return this.ok({
      provider: (ts as unknown as { provider?: { name: string } }).provider?.name || "none",
      isAvailable: ts.isAvailable,
      isRateLimited: ts.isRateLimited,
      cooldownRemaining: ts.stats.cooldownRemaining,
      queueSize: ts.stats.queued,
      activeJobs: ts.stats.running,
      cachedTranslations: cacheStats.cachedEntries,
      activeSessions: this.activeSessions.size,
    });
  }
}
