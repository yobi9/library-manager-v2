import { BaseController, ControllerResult } from "./base-controller";
import { TmdbEnrichmentService, isBlockedHostname } from "../services/tmdb-enrichment-service";
import { MetadataService } from "../services/metadata-service";
import { getEventBus } from "../services/event-bus";
import { EnrichmentMediaRepository } from "../repositories/enrichment-media-repository";
import { EnrichmentApprovalRepository } from "../repositories/enrichment-repository";

const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000;

interface Session {
  id: string;
  total: number;
  status: string;
  startTime: Date;
  endTime?: Date;
  success?: number;
  failed?: number;
  pending?: number;
  error?: string;
  progress?: Record<string, unknown>;
}

export class EnrichmentController extends BaseController {
  private service: TmdbEnrichmentService;
  private metadataService: MetadataService;
  private sessions = new Map<string, Session>();
  private _cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    tmdbEnrichment: TmdbEnrichmentService,
    metadataService: MetadataService,
    enrichmentMediaRepo: EnrichmentMediaRepository,
    enrichmentApprovalRepo: EnrichmentApprovalRepository,
  ) {
    super();
    this.service = tmdbEnrichment;
    this.metadataService = metadataService;
    this._cleanupTimer = setInterval(() => this._cleanupStaleSessions(), SESSION_CLEANUP_INTERVAL);
    this._cleanupTimer.unref();
  }

  private _cleanupStaleSessions(): void {
    const cutoff = Date.now() - SESSION_CLEANUP_INTERVAL;
    for (const [id, session] of this.sessions) {
      if (session.endTime && session.endTime.getTime() < cutoff) this.sessions.delete(id);
    }
  }

  private _emitProgress(sessionId: string, progressData: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.progress = progressData;
      if (progressData.type === "completed") {
        session.status = "completed";
        session.endTime = new Date();
      }
    }
    getEventBus().emit("enrichment_progress", { sessionId, ...progressData });
  }

  async enrichItem(id: number, body: Record<string, unknown>): Promise<ControllerResult> {
    try {
      const result = await this.service.enrichItem(id, {
        downloadImages: body.downloadImages === true,
        storageMode: body.storageMode as string,
        downloadCastImages: body.downloadCastImages === true,
        tmdbId: body.tmdbId ? Number(body.tmdbId) : null,
        force: body.force === true,
      });
      return this.ok({ success: result.success, result });
    } catch (error) {
      return this.error((error as Error).message, 500);
    }
  }

  async enrichBatch(body: {
    mediaIds?: number[];
    options?: Record<string, unknown>;
  }): Promise<ControllerResult> {
    const { mediaIds, options = {} } = body;
    if (!mediaIds?.length) return this.error("mediaIds required", 400);

    const sessionId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      total: mediaIds.length,
      status: "processing",
      startTime: new Date(),
      progress: { processed: 0, percentage: 0, successful: 0, failed: 0, pending: 0 },
    });

    this._processBatchInBackground(sessionId, mediaIds, options);
    return this.ok({ sessionId, totalItems: mediaIds.length });
  }

  private async _processBatchInBackground(
    sessionId: string,
    mediaIds: number[],
    options: Record<string, unknown>,
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;
    try {
      const result = await this.service.enrichBatch(mediaIds, {
        ...options,
        sessionId,
        onProgress: (p: Record<string, unknown>) => this._emitProgress(sessionId, p),
      });
      Object.assign(session, {
        status: "completed",
        success: result.successful,
        failed: result.failed,
        pending: result.pending || 0,
        endTime: new Date(),
      });
      this._emitProgress(sessionId, { type: "completed", ...result });
    } catch (error) {
      Object.assign(session, {
        status: "failed",
        error: (error as Error).message,
        endTime: new Date(),
      });
      this._emitProgress(sessionId, { type: "failed", error: (error as Error).message });
    } finally {
      setTimeout(() => this.sessions.delete(sessionId), 600000);
    }
  }

  async enrichByFilter(body: Record<string, unknown>): Promise<ControllerResult> {
    const {
      onlyEmpty = false,
      downloadImages = false,
      storageMode = "local",
      downloadCastImages = false,
      ...filters
    } = body;

    const sessionId = `filter_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      total: 0,
      status: "preparing",
      startTime: new Date(),
      progress: { processed: 0, percentage: 0, successful: 0, failed: 0, pending: 0 },
    });

    setImmediate(async () => {
      try {
        const result = await this.service.getItemsByFilter({ ...filters, onlyEmpty });
        const mediaIds = (result.items || [])
          .map((i) => (i.media_id || i.id) as number)
          .filter(Boolean);
        const session = this.sessions.get(sessionId);
        if (session) {
          session.total = mediaIds.length;
          session.status = mediaIds.length ? "processing" : "completed";
          if (!mediaIds.length) {
            session.endTime = new Date();
            this._emitProgress(sessionId, {
              type: "completed",
              processed: 0,
              total: 0,
              successful: 0,
              failed: 0,
            });
            return;
          }
        }
        await this._processBatchInBackground(sessionId, mediaIds, {
          downloadImages,
          storageMode,
          downloadCastImages,
        });
      } catch (error) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.status = "failed";
          session.error = (error as Error).message;
          session.endTime = new Date();
          this._emitProgress(sessionId, { type: "failed", error: (error as Error).message });
        }
      }
    });

    return this.ok({ sessionId, message: "Processing started in background" });
  }

  async getSessionStatus(sessionId: string): Promise<ControllerResult> {
    const session = this.sessions.get(sessionId);
    if (!session) return this.error("Session not found", 404);
    return this.ok({ session });
  }

  async getStats(): Promise<ControllerResult> {
    const stats = this.service.getStats();
    return this.ok({ stats, activeSessions: this.sessions.size });
  }

  async testConnection(body: { apiKey?: string }): Promise<ControllerResult> {
    try {
      const result = body.apiKey
        ? await this.service.testApiKey(body.apiKey)
        : await this.service.testConnection();
      return this.ok({
        message: "TMDB connection successful",
        testMovie: (result as Record<string, unknown>).title,
      });
    } catch (error) {
      return this.error((error as Error).message, 500);
    }
  }

  async searchTmdb(body: {
    query?: string;
    type?: string;
    year?: number;
  }): Promise<ControllerResult> {
    const { query, type = "movie", year } = body;
    if (!query || query.length < 2) return this.error("Query too short", 400);
    const result = await (
      this.service as unknown as {
        _searchTMDB: (q: string, y?: number, t?: string) => Record<string, unknown>;
      }
    )._searchTMDB(query, year, type);
    return this.ok({ results: result ? [result] : [] });
  }

  async resetStats(): Promise<ControllerResult> {
    this.service.resetStats();
    return this.ok({ message: "Stats reset" });
  }

  async getItemsNeedingEnrichment(queryParams: {
    limit?: string;
    offset?: string;
    libraryId?: string;
    type?: string;
    onlyEmpty?: string;
  }): Promise<ControllerResult> {
    const limit = parseInt(queryParams.limit || "50");
    const offset = parseInt(queryParams.offset || "0");
    const { items, total } = await this.service.getItemsByFilter(
      {
        libraryId: queryParams.libraryId,
        type: queryParams.type,
        onlyEmpty: (queryParams.onlyEmpty || "true") === "true",
      },
      limit,
      offset,
    );
    return this.ok({ items, total, limit, offset });
  }

  /**
   * تحديث مفتاح TMDB API وحفظه في إعدادات النظام (بدل الذاكرة فقط).
   *
   * @param body - يحتوي `apiKey` (نص بطول 10 أحرف كحد أدنى).
   * @param userId - معرّف المستخدم المسؤول (اختياري — لسجل تدقيق الإعدادات).
   * @param ip - عنوان IP الخاص بالتغيير (اختياري — لسجل تدقيق الإعدادات).
   * @returns رسالة نجاح أو خطأ `400` لمفتاح غير صالح.
   */
  async updateApiKey(
    body: { apiKey?: string },
    userId?: number,
    ip?: string,
  ): Promise<ControllerResult> {
    const { apiKey } = body;
    if (!apiKey || apiKey.length < 10) return this.error("Invalid API key", 400);
    try {
      await this.service.saveApiKey(apiKey, userId, ip);
      return this.ok({ message: "API key updated" });
    } catch (error) {
      return this.error((error as Error).message, 500);
    }
  }

  async uploadImageFromUrl(body: {
    mediaId?: number;
    imageUrl?: string;
    type?: string;
    storageMode?: string;
  }): Promise<ControllerResult> {
    const { mediaId, imageUrl, type, storageMode = "local" } = body;
    if (!mediaId || !imageUrl || !type)
      return this.error("Missing required fields: mediaId, imageUrl, type", 400);

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return this.error("Invalid URL", 400);
    }
    if (!["http:", "https:"].includes(parsed.protocol))
      return this.error("Only HTTP/HTTPS URLs allowed", 400);

    const hostname = parsed.hostname.toLowerCase();
    // حارس موحّد مع الخدمة: يقفل RFC1918 كاملة (بما فيها 172.16.0.0/12) والروابط
    // المحلية — القائمة النصية السابقة كانت تغطي 172.16. فقط فتمرّ 172.17–172.31.
    if (isBlockedHostname(hostname)) return this.error("URL target not allowed", 403);

    const result = await this.service.uploadImageFromUrl(mediaId, imageUrl, type, storageMode);
    return this.ok({ path: result.path });
  }

  async updateMetadataManually(
    id: number,
    body: Record<string, unknown>,
  ): Promise<ControllerResult> {
    const result = await this.metadataService.updateMetadataManually(id, body);
    if (result.statusCode) return this.error(result.error as string, result.statusCode as number);
    return this.ok(result);
  }

  async getPendingApprovals(limitStr?: string): Promise<ControllerResult> {
    const limit = parseInt(limitStr || "100");
    const pending = await this.service.getPendingApprovals(limit);
    return this.ok({ pending });
  }

  async approveAllPending(body: Record<string, unknown>): Promise<ControllerResult> {
    const result = await this.service.approveAllPendingEnrichments({
      downloadImages: body.downloadImages === true,
      storageMode: body.storageMode as string,
      downloadCastImages: body.downloadCastImages === true,
    });
    return this.ok(result);
  }

  async approveEnrichment(
    approvalId: number,
    body: Record<string, unknown>,
  ): Promise<ControllerResult> {
    const result = await this.service.approveEnrichment(approvalId, {
      downloadImages: body.downloadImages === true,
      storageMode: body.storageMode as string,
      downloadCastImages: body.downloadCastImages === true,
    });
    return this.ok(result);
  }

  async rejectEnrichment(approvalId: number): Promise<ControllerResult> {
    const result = await this.service.rejectEnrichment(approvalId);
    return this.ok(result);
  }

  async resetItemMetadata(id: number): Promise<ControllerResult> {
    const result = await this.service.resetItemMetadata(id);
    return this.ok(result);
  }

  async cancelSession(sessionId: string): Promise<ControllerResult> {
    const session = this.sessions.get(sessionId);
    if (!session) return this.error("Session not found", 404);
    if (
      session.status === "completed" ||
      session.status === "failed" ||
      session.status === "cancelled"
    ) {
      return this.error(`Session already ${session.status}`, 400);
    }
    session.status = "cancelled";
    session.endTime = new Date();
    this.service.cancelSession(sessionId);
    setTimeout(() => this.sessions.delete(sessionId), 60000);
    return this.ok({ sessionId, status: "cancelled" });
  }
}
