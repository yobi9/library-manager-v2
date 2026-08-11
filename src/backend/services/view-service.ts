import { ViewTrackerService } from "./view-tracker";
import { ViewEventPublisher } from "./view-publisher";

/**
 * سياق المشاهدة القادم من طبقة الـ API — يصف من يشاهد (مستخدم مسجّل أو زائر)
 * ومن أي بيئة (هيدرز + معرّف جلسة الزائر).
 *
 * @remarks
 * المصدر: يُبنى في مسارات الـ API من `parseAuthFromRequest` + هيدر
 * `x-visitor-session-id` الذي يضعه الـ proxy على كل الطلبات.
 */
export interface ViewerContext {
  headers: Record<string, string | undefined>;
  user?: { user_id?: number; username?: string } | null;
  cookies?: Record<string, string | undefined>;
  visitor_session_id?: string;
}

export class ViewService {
  constructor(
    private tracker: ViewTrackerService,
    private publisher: ViewEventPublisher,
  ) {}

  private _identifyViewer(req: ViewerContext): { userId: number | null; visitorId: string | null } {
    let userId: number | null = null;
    let visitorId: string | null = null;
    if (req.user?.user_id) {
      userId = req.user.user_id;
    } else {
      visitorId = req.visitor_session_id || req.cookies?.visitor_session_id || null;
      if (!visitorId) visitorId = req.headers["x-device-id"] || "غير معروف";
    }
    return { userId, visitorId };
  }

  trackMediaView(req: ViewerContext, mediaId: number, itemTitle: string | null | undefined): void {
    if (!itemTitle) return;
    const { userId, visitorId } = this._identifyViewer(req);
    const viewerKey = userId ? `user:${userId}:${mediaId}` : `visitor:${visitorId}:${mediaId}`;
    if (!this.tracker.canEmit(viewerKey)) return;
    this.publisher.publishMediaView(
      req as unknown as Parameters<ViewEventPublisher["publishMediaView"]>[0],
      userId,
      visitorId,
      mediaId,
      itemTitle,
    );
  }

  trackSectionView(req: ViewerContext, sectionName: string): void {
    if (!sectionName) return;
    const { userId, visitorId } = this._identifyViewer(req);
    const viewerKey = userId
      ? `section:user:${userId}:${sectionName}`
      : `section:visitor:${visitorId}:${sectionName}`;
    if (!this.tracker.canEmit(viewerKey)) return;
    this.publisher.publishSectionView(
      req as unknown as Parameters<ViewEventPublisher["publishSectionView"]>[0],
      userId,
      visitorId,
      sectionName,
    );
  }
}
