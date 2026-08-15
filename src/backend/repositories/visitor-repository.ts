import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class VisitorRepository extends BaseRepository {
  constructor() {
    super("visitor_events");
  }

  async getVisitors() {
    return this.query(`
      SELECT v.id, v.device_id as uid, v.ip_address, v.device_type,
             v.user_agent as operator, v.last_seen as last_active,
             v.created_at, v.is_online as connection_status
      FROM visitors v
      ORDER BY v.last_seen DESC
    `);
  }

  async getVisitorLogs(limit = 10, offset = 0) {
    return this.query(
      `SELECT ve.session_id as uid, ve.ip_address, ve.user_agent as operator,
             v.device_type, ve.created_at as last_active, ve.created_at,
             v.is_online as connection_status
      FROM visitor_events ve
      JOIN visitors v ON v.id = ve.visitor_id
      WHERE ve.event_type = 'visit'
      ORDER BY ve.created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async countVisitorLogs(): Promise<number> {
    const row = (await this.queryOne(
      "SELECT COUNT(*) as total FROM visitor_events WHERE event_type='visit'",
    )) as { total: number } | undefined;
    return row?.total ?? 0;
  }

  async updateVisitorActivity(
    sessionId: string,
    ip: string,
    userAgent: string,
    deviceType: string,
    deviceId: string,
  ) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const visitorDeviceId = deviceId || sessionId;

    // إدراج/تحديث ذري عبر `ON CONFLICT ... DO UPDATE ... RETURNING id`:
    // كان الإنشاء سابقاً SELECT ثم INSERT منفصلين (check-then-act) فيتنافس
    // طلبان متزامنان لنفس الجلسة على إنشاء نفس device_id فيفشل أحدهما بـ
    // `UNIQUE constraint failed: visitors.device_id`. الآن العملية واحدة غير
    // قابلة للسباق، و`RETURNING id` يغطي مساري الإنشاء والتحديث معاً.
    const row = (await db.get(
      `INSERT INTO visitors (device_id, device_type, user_agent, ip_address, is_online, first_seen, last_seen, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         last_seen = excluded.last_seen,
         ip_address = excluded.ip_address,
         user_agent = excluded.user_agent,
         device_type = excluded.device_type,
         is_online = 1
       RETURNING id`,
      [visitorDeviceId, deviceType, userAgent, ip, now, now, now],
    )) as { id: number } | undefined;
    const visitorId = row!.id;

    await db.run(
      `INSERT INTO visitor_events (visitor_id, event_type, session_id, user_agent, ip_address, created_at)
       VALUES (?, 'visit', ?, ?, ?, ?)`,
      [visitorId, sessionId, userAgent, ip, now],
    );
  }

  async getOnlineCount(): Promise<number> {
    const db = await getDatabase();
    const result = (await db.get(`
      SELECT COUNT(DISTINCT v.id) as online
      FROM visitors v
      WHERE v.is_online = 1 AND v.last_seen > datetime('now', '-5 minutes')
    `)) as { online: number } | undefined;
    return result?.online ?? 0;
  }

  async deleteInactiveVisitors(days = 15) {
    await this.execute(
      `DELETE FROM visitors WHERE last_seen < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }

  /**
   * يحذف أحداث الزيارات الأقدم من `days` يوماً.
   *
   * @remarks يقتصر التنظيف على `event_type = 'visit'` عمداً حتى لا تُمسح
   *          رسائل الزوار (`event_type = 'request'`) التي يعرضها الأدمن
   *          ويردّ عليها — فهي اتصال مستخدم وليست سجل تتبع.
   *
   * @param days - عدد أيام الاحتفاظ (افتراضياً 7).
   */
  async deleteOldVisitorEvents(days = 7) {
    await this.execute(
      `DELETE FROM visitor_events
       WHERE event_type = 'visit' AND created_at < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }

  async getDeviceBreakdown() {
    const db = await getDatabase();
    try {
      const rows = (await db.all(`
        SELECT
          CASE
            WHEN v.user_agent LIKE '%Windows%' THEN 'windows'
            WHEN v.user_agent LIKE '%Samsung%' OR v.user_agent LIKE '%SM-%' THEN 'samsung'
            WHEN v.user_agent LIKE '%Huawei%' OR v.user_agent LIKE '%HONOR%' THEN 'huawei'
            WHEN v.user_agent LIKE '%Android%' THEN 'android'
            WHEN v.user_agent LIKE '%iPhone%' OR v.user_agent LIKE '%iPad%' OR v.user_agent LIKE '%Mac%' THEN 'apple'
            WHEN v.user_agent LIKE '%SmartTV%' OR v.user_agent LIKE '%TV%' THEN 'smart_tv'
            ELSE 'other'
          END as device_type,
          COUNT(DISTINCT ve.session_id) as count
        FROM visitor_events ve
        JOIN visitors v ON v.id = ve.visitor_id
        WHERE ve.created_at > datetime('now', '-24 hours')
        GROUP BY device_type
      `)) as { device_type: string; count: number }[];
      const result: Record<string, number> = {
        windows: 0,
        samsung: 0,
        huawei: 0,
        android: 0,
        apple: 0,
        smart_tv: 0,
        other: 0,
      };
      for (const row of rows) {
        if (row.device_type in result) {
          result[row.device_type] = row.count;
        }
      }
      return result;
    } catch {
      return { windows: 0, samsung: 0, huawei: 0, android: 0, apple: 0, smart_tv: 0, other: 0 };
    }
  }

  async getVisitorRequests() {
    return this.query(`
      SELECT ve.id, ve.user_id as userId, v.device_id, ve.message,
             strftime('%Y-%m-%dT%H:%M:%SZ', ve.created_at) as createdAt,
             ve.status, ve.reply,
             strftime('%Y-%m-%dT%H:%M:%SZ', ve.reply_created_at) as replyCreatedAt,
             ve.ip_address, ve.user_agent
      FROM visitor_events ve
      LEFT JOIN visitors v ON v.id = ve.visitor_id
      WHERE ve.event_type = 'request'
      ORDER BY ve.created_at DESC
    `);
  }

  async addVisitorRequest(
    userId: string,
    message: string,
    ip?: string | null,
    userAgent?: string | null,
  ) {
    const db = await getDatabase();
    // نفس نمط الإدراج الذري: `ON CONFLICT(device_id) DO NOTHING` لا يرمي
    // `UNIQUE constraint` عند التزامن، ونقرأ المعرّف من `RETURNING` أو نعيد
    // الاستعلام عند التصادم (صف موجود مسبقاً).
    const now = new Date().toISOString();
    const inserted = (await db.get(
      `INSERT INTO visitors (device_id, is_online, first_seen, last_seen, created_at)
       VALUES (?, 0, ?, ?, ?)
       ON CONFLICT(device_id) DO NOTHING
       RETURNING id`,
      [userId, now, now, now],
    )) as { id: number } | undefined;

    let visitorId = inserted?.id;
    if (!visitorId) {
      const existing = (await this.queryOne("SELECT id FROM visitors WHERE device_id = ?", [
        userId,
      ])) as { id: number } | undefined;
      visitorId = existing!.id;
    }

    return db.run(
      `INSERT INTO visitor_events (visitor_id, event_type, user_id, message, ip_address, user_agent)
       VALUES (?, 'request', ?, ?, ?, ?)`,
      [visitorId, userId, message, ip ?? null, userAgent ?? null],
    );
  }

  async addReplyToRequest(requestId: number, reply: string) {
    await this.execute(
      `UPDATE visitor_events
       SET reply = ?, reply_created_at = CURRENT_TIMESTAMP, status = 'resolved'
       WHERE id = ? AND event_type = 'request'`,
      [reply, requestId],
    );
  }

  async deleteRequest(requestId: number) {
    await this.execute("DELETE FROM visitor_events WHERE id = ? AND event_type = 'request'", [
      requestId,
    ]);
  }

  async deleteAllVisitorRequests() {
    await this.execute("DELETE FROM visitor_events WHERE event_type = 'request'");
  }
}
