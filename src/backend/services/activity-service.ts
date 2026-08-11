import { ActivityRepository } from "../repositories/activity-repository";

export class ActivityService {
  constructor(private activityRepo: ActivityRepository) {}

  async logActivity(params: {
    userId?: number | null;
    deviceId?: string | null;
    action: string;
    targetId?: number | null;
    details?: unknown;
    ip?: string | null;
    userAgent?: string | null;
    module?: string;
    severity?: string;
  }) {
    return this.activityRepo.logActivity(params);
  }

  async getRecentActivities(limit = 30) {
    return this.activityRepo.getRecentActivities(limit);
  }

  /**
   * Fetches paginated activity events, optionally scoped to entity types.
   *
   * @param limit - Maximum number of rows (default 50).
   * @param offset - Pagination offset (default 0).
   * @param entityTypes - Optional filter: a single entity type or an array.
   * @returns Array of activity rows (newest first).
   */
  async getEvents(
    limit = 50,
    offset = 0,
    entityTypes?: "user" | "visitor" | "system" | Array<"user" | "visitor" | "system">,
  ) {
    return this.activityRepo.getEvents(limit, offset, entityTypes);
  }

  /**
   * Counts activity rows, optionally scoped to entity types.
   *
   * @param entityTypes - Optional filter: a single entity type or an array.
   * @returns Total matching row count.
   */
  async countEvents(
    entityTypes?: "user" | "visitor" | "system" | Array<"user" | "visitor" | "system">,
  ) {
    return this.activityRepo.countEvents(entityTypes);
  }

  /**
   * Permanently removes every row from the `activities` table.
   */
  async deleteAllEvents() {
    return this.activityRepo.deleteAllEvents();
  }

  async getUserActivities(userId: number, limit = 50) {
    return this.activityRepo.getUserActivities(userId, limit);
  }

  async deleteOldActivities(days = 30) {
    return this.activityRepo.deleteActivitiesOlderThan(days);
  }

  /**
   * يحذف سجلات أنشطة الزوار (`entity_type = 'visitor'`) الأقدم من 7 أيام —
   * زائر التصفّح (مشاهدات أقسام/صفحات) ضجيج عالي القيمة الصغيرة، لذا
   * يُنظَّف أسرع من أنشطة المستخدمين المسجّلين.
   *
   * @returns نتيجة عملية الحذف في قاعدة البيانات.
   */
  async deleteOldVisitorActivities() {
    return this.activityRepo.deleteOldVisitorActivities();
  }
}
