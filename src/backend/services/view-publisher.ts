import { ActivityRepository } from "../repositories/activity-repository";
import { MediaRepository } from "../repositories/media-repository";
import { getEventBus } from "./event-bus";

export class ViewEventPublisher {
  private activityRepo: ActivityRepository | null;
  private eventBus: ReturnType<typeof getEventBus>;
  private mediaRepo: MediaRepository | null;
  private _active = 0;
  private _queue: Array<() => Promise<void>> = [];
  private readonly MAX_CONCURRENT = 5;

  constructor(activityRepo: ActivityRepository | null, eventBus: ReturnType<typeof getEventBus>, mediaRepo: MediaRepository | null) {
    this.activityRepo = activityRepo;
    this.eventBus = eventBus;
    this.mediaRepo = mediaRepo;
  }

  private async _limit<T>(fn: () => Promise<T>): Promise<T> {
    if (this._active < this.MAX_CONCURRENT) {
      this._active++;
      try { return await fn(); } finally { this._active--; this._processQueue(); }
    }
    return new Promise<T>((resolve, reject) => {
      this._queue.push(async () => { try { resolve(await fn()); } catch (e) { reject(e); } });
    });
  }

  private _processQueue(): void {
    while (this._queue.length > 0 && this._active < this.MAX_CONCURRENT) {
      const fn = this._queue.shift();
      if (!fn) break;
      this._active++;
      fn().finally(() => { this._active--; this._processQueue(); });
    }
  }

  publishMediaView(req: { headers: Record<string, string | undefined>; user?: { user_id?: number; username?: string; display_name?: string } | null }, userId: number | null, visitorId: string | null, mediaId: number, itemTitle: string): void {
    const eventData: Record<string, unknown> = { itemId: mediaId, itemTitle, timestamp: new Date().toISOString() };

    if (userId) {
      eventData.userId = userId;
      eventData.username = req?.user?.username || req?.user?.display_name || "مستخدم";
      eventData.entityType = "user";
    } else {
      eventData.deviceId = visitorId;
      eventData.entityType = "visitor";
      eventData.username = "زائر";
    }

    this._logToDb(req, userId, visitorId, mediaId, itemTitle);
    this._incrementViewAtomic(mediaId);

    if (userId) {
      this.eventBus.emit("user_view", eventData);
    } else {
      this.eventBus.emit("visitor_view", eventData);
    }
  }

  publishSectionView(req: { headers: Record<string, string | undefined>; user?: { user_id?: number; username?: string; display_name?: string } | null }, userId: number | null, visitorId: string | null, sectionName: string): void {
    const eventData: Record<string, unknown> = { itemId: null, itemTitle: sectionName, section: true, timestamp: new Date().toISOString() };

    if (userId) {
      eventData.userId = userId;
      eventData.username = req?.user?.username || req?.user?.display_name || "مستخدم";
      eventData.entityType = "user";
    } else {
      eventData.deviceId = visitorId;
      eventData.entityType = "visitor";
      eventData.username = "زائر";
    }

    this._logToDb(req, userId, visitorId, null, sectionName);

    if (userId) {
      this.eventBus.emit("user_view", eventData);
    } else {
      this.eventBus.emit("visitor_view", eventData);
    }
  }

  private _logToDb(req: { headers: Record<string, string | undefined> }, userId: number | null, visitorId: string | null, mediaId: number | null, title: string): void {
    if (!this.activityRepo) return;
    const ip = req.headers["x-forwarded-for"] || null;
    const userAgent = req.headers["user-agent"] || null;
    this._limit(() =>
      this.activityRepo!.logActivity({
        userId: userId ?? undefined,
        deviceId: visitorId ?? undefined,
        action: mediaId ? "view_media" : "view_section",
        targetId: mediaId ?? undefined,
        details: { title },
        ip: ip as string | undefined,
        userAgent: userAgent as string | undefined,
        module: "media",
        severity: "info",
      } as Parameters<ActivityRepository["logActivity"]>[0]),
    ).catch((err: Error) => {
      console.error("[ViewEventPublisher] Failed to log view activity:", err.message);
    });
  }

  private _incrementViewAtomic(mediaId: number): void {
    if (!this.mediaRepo || !mediaId) return;
    this._limit(() =>
      this.mediaRepo!.incrementViewCount(mediaId),
    ).catch((err: Error) => {
      console.error("[ViewEventPublisher] Failed to increment views count:", err.message);
    });
  }
}
