import { BaseController, type ControllerResult } from "./base-controller";
import type { ActivityService } from "../services/activity-service";
import type { SecurityService } from "../services/security-service";

/** أنواع الأحداث المقبولة في فلتر صفحة الأحداث. */
const ENTITY_TYPES = new Set(["user", "visitor", "system"]);

type EntityType = "user" | "visitor" | "system";

/**
 * متحكم أحداث الأدمن — يجمّع نقاط نهاية سجل النشاطات وأحداث الأمان خلف حاوية
 * `getControllers()` بدل تسريب الخدمات مباشرة في مسارات API.
 */
export class EventsController extends BaseController {
  constructor(
    private activityService: ActivityService,
    private securityService: SecurityService,
  ) {
    super();
  }

  /**
   * يُرجع سجل الأحداث المحفوظ من جدول `activities` مقسّماً إلى مجموعتين
   * (أحداث النظام + أحداث المستخدمين/الزوار) مع إجمالي كل مجموعة.
   *
   * @param options - خيارات الفلترة:
   *   - `type` ("user"/"visitor"/"system") يحدد محتوى الصندوقين بدقة،
   *   - `limit`/`offset` للترقيم.
   * @returns `{ system, user, totals: { system, user } }`.
   */
  async getHistory(options: {
    type?: string | null;
    limit: number;
    offset: number;
  }): Promise<ControllerResult> {
    try {
      const requestedType =
        options.type && ENTITY_TYPES.has(options.type) ? (options.type as EntityType) : undefined;

      // تجميع صريح (سلوك محفوظ من المسار السابق): `type` يحدد محتوى الصندوقين
      // بدقة (فارغ بدل `undefined` الذي كان يُرجع كل الصفوف عند تمرير
      // type=user أو type=visitor):
      // - بدون type     → system: [system]     ، user: [user, visitor]
      // - type=system   → system: [system]     ، user: [] (فارغ)
      // - type=user     → system: [] (فارغ)    ، user: [user, visitor]
      // - type=visitor  → system: [] (فارغ)    ، user: [visitor]
      const systemType: EntityType | undefined =
        requestedType === undefined || requestedType === "system" ? "system" : undefined;
      const userTypes: EntityType[] =
        requestedType === undefined || requestedType === "user"
          ? ["user", "visitor"]
          : requestedType === "visitor"
            ? ["visitor"]
            : [];

      const [systemRows, systemTotal, userRows, userTotal] = await Promise.all([
        systemType
          ? this.activityService.getEvents(options.limit, options.offset, systemType)
          : Promise.resolve([]),
        systemType ? this.activityService.countEvents(systemType) : Promise.resolve(0),
        userTypes.length > 0
          ? this.activityService.getEvents(options.limit, options.offset, userTypes)
          : Promise.resolve([]),
        userTypes.length > 0 ? this.activityService.countEvents(userTypes) : Promise.resolve(0),
      ]);

      return this.ok({
        system: systemRows,
        user: userRows,
        totals: { system: systemTotal, user: userTotal },
      });
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * يحذف كل صفوف سجل النشاطات (`activities`) نهائياً.
   *
   * @returns `{ success: true }` عند اكتمال الحذف.
   */
  async clearHistory(): Promise<ControllerResult> {
    try {
      await this.activityService.deleteAllEvents();
      return this.ok({ success: true });
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * يُرجع أحداث الأمان من جدول `security_events` (محاولات الدخول الفاشلة،
   * الحظر/فك الحظر) مع إجمالي الصفوف للترقيم.
   *
   * @param limit - أقصى عدد صفوف (افتراضي 50).
   * @param offset - نقطة البداية للترقيم (افتراضي 0).
   * @returns `{ rows, total }`.
   */
  async getSecurityEvents(limit: number, offset: number): Promise<ControllerResult> {
    try {
      const [rows, total] = await Promise.all([
        this.securityService.getAllSecurityEvents(limit, offset),
        this.securityService.countEvents(),
      ]);
      return this.ok({ rows, total });
    } catch (err) {
      return this.handleError(err);
    }
  }
}
