import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class ActivityRepository extends BaseRepository {
  constructor() {
    super("activities");
  }

  async logActivity({
    userId,
    actorUserId,
    deviceId,
    action,
    targetId,
    details,
    ip,
    userAgent,
    module: mod = "general",
    severity = "info",
    durationMs = null,
    entityType,
  }: {
    userId?: number | null;
    /**
     * الفاعل الحقيقي للحدث عند اختلافه عن المستخدم المتأثر (`userId`).
     * مثلاً: مدير يعدّل صورة رمزية لمستخدم آخر — `actorUserId` = المدير،
     * و`userId` = صاحب الصورة. عند الغياب يُعتمد `userId` نفسه كفاعل.
     */
    actorUserId?: number | null;
    deviceId?: string | null;
    action: string;
    targetId?: number | null;
    details?: unknown;
    ip?: string | null;
    userAgent?: string | null;
    module?: string;
    severity?: string;
    durationMs?: number | null;
    /**
     * Entity category: "user" (معرّف مستخدم)، "visitor" (زائر)، أو "system"
     * لأحداث النظام (نسخ قاعدة البيانات، تحذيرات الذاكرة، تحديث البيانات...).
     * عند الغياب يُشتق تلقائياً من `userId`.
     */
    entityType?: "user" | "visitor" | "system";
  }) {
    const db = await getDatabase();
    const entityTypeResolved = entityType ?? (userId ? "user" : "visitor");
    await db.run(
      `INSERT INTO activities
        (entity_type, user_id, actor_user_id, device_id, action, target_id, details, ip_address, user_agent, module, severity, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entityTypeResolved,
        userId ?? null,
        actorUserId ?? null,
        deviceId ?? null,
        action,
        targetId ?? null,
        details ? JSON.stringify(details) : null,
        ip ?? null,
        userAgent ?? null,
        mod,
        severity,
        durationMs ?? null,
        new Date().toISOString(),
      ],
    );
  }

  async getRecentActivities(limit = 30) {
    const db = await getDatabase();
    const rows = await db.all(
      `SELECT
        a.id, a.entity_type,
        CASE WHEN a.entity_type = 'user' THEN COALESCE(au.display_name, au.username, ut.display_name, ut.username, 'مستخدم')
             WHEN a.entity_type = 'system' THEN 'النظام'
             ELSE 'زائر'
        END as user_name,
        a.created_at as time, a.created_at, a.action, a.module, a.severity,
        a.details, a.ip_address, a.user_agent, a.device_id, a.target_id
      FROM activities a
      LEFT JOIN users ut ON a.user_id = ut.user_id
      LEFT JOIN users au ON a.actor_user_id = au.user_id
      ORDER BY a.created_at DESC
      LIMIT ?`,
      [limit],
    );
    return rows;
  }

  /**
   * Fetches paginated activity events from the `activities` table, optionally
   * filtered by one or more entity categories (user / visitor / system).
   *
   * @param limit - Maximum number of rows to return.
   * @param offset - Number of rows to skip (for pagination).
   * @param entityTypes - Optional filter: one of "user" | "visitor" | "system",
   *   or an array of them.
   * @returns Array of activity rows (newest first).
   */
  async getEvents(
    limit: number,
    offset: number,
    entityTypes?: "user" | "visitor" | "system" | Array<"user" | "visitor" | "system">,
  ) {
    const db = await getDatabase();
    const list = Array.isArray(entityTypes) ? entityTypes : entityTypes ? [entityTypes] : [];
    const where = list.length ? `WHERE a.entity_type IN (${list.map(() => "?").join(", ")})` : "";
    const params = [...list, limit, offset];
    return db.all(
      `SELECT
        a.id, a.entity_type,
        CASE WHEN a.entity_type = 'user' THEN COALESCE(au.display_name, au.username, ut.display_name, ut.username, 'مستخدم')
             WHEN a.entity_type = 'system' THEN 'النظام'
             ELSE 'زائر'
        END as user_name,
        a.created_at as time, a.created_at, a.action, a.module, a.severity,
        a.details, a.ip_address, a.user_agent, a.device_id, a.target_id
      FROM activities a
      LEFT JOIN users ut ON a.user_id = ut.user_id
      LEFT JOIN users au ON a.actor_user_id = au.user_id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`,
      params,
    );
  }

  /**
   * Counts activity rows, optionally scoped to one or more entity categories.
   *
   * @param entityTypes - Optional filter: one of "user" | "visitor" | "system",
   *   or an array of them.
   * @returns Number of matching rows.
   */
  async countEvents(
    entityTypes?: "user" | "visitor" | "system" | Array<"user" | "visitor" | "system">,
  ): Promise<number> {
    const db = await getDatabase();
    const list = Array.isArray(entityTypes) ? entityTypes : entityTypes ? [entityTypes] : [];
    const where = list.length ? `WHERE entity_type IN (${list.map(() => "?").join(", ")})` : "";
    const params = list;
    const row = (await db.get(`SELECT COUNT(*) as count FROM activities ${where}`, params)) as
      { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Permanently removes every row from the `activities` table.
   * Used by the admin "حذف كل الاحداث" action on the events page.
   */
  async deleteAllEvents() {
    await this.execute("DELETE FROM activities");
  }

  async getUserActivities(userId: number, limit = 50) {
    return this.query(
      "SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit],
    );
  }

  async getVisitorActivities(deviceId: string, limit = 50) {
    return this.query(
      "SELECT * FROM activities WHERE device_id = ? ORDER BY created_at DESC LIMIT ?",
      [deviceId, limit],
    );
  }

  async deleteActivitiesOlderThan(days = 30) {
    await this.execute(
      `DELETE FROM activities WHERE created_at < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }

  async deleteOldVisitorActivities() {
    await this.execute(
      `DELETE FROM activities WHERE entity_type = 'visitor' AND created_at < datetime('now', '-7 days')`,
    );
  }
}
