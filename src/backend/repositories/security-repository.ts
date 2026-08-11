import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class SecurityEventRepository extends BaseRepository {
  constructor() {
    super("security_events");
  }

  async logSecurityEvent({
    userId,
    eventType,
    severity = "info",
    details = null,
    ip = null,
    userAgent = null,
  }: {
    userId?: number | null;
    eventType: string;
    severity?: string;
    details?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const db = await getDatabase();
    await db.run(
      `INSERT INTO security_events (user_id, event_type, severity, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId ?? null,
        eventType,
        severity,
        details ? JSON.stringify(details) : null,
        ip,
        userAgent,
      ],
    );
  }

  async getAllSecurityEvents(limit = 50, offset = 0) {
    return this.query(
      `SELECT se.*, u.username, resolver.username as resolver_username
       FROM security_events se
       LEFT JOIN users u ON se.user_id = u.user_id
       LEFT JOIN users resolver ON se.resolved_by = resolver.user_id
       ORDER BY se.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async getUserSecurityEvents(userId: number, limit = 30) {
    return this.query(
      "SELECT * FROM security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit],
    );
  }

  async resolveSecurityEvent(eventId: number, resolvedByUserId: number) {
    await this.execute(
      `UPDATE security_events
       SET resolved = 1, resolved_at = datetime('now'), resolved_by = ?
       WHERE event_id = ?`,
      [resolvedByUserId, eventId],
    );
  }

  async countEvents(): Promise<number> {
    const row = (await this.queryOne("SELECT COUNT(*) as count FROM security_events")) as
      { count: number } | undefined;
    return row?.count ?? 0;
  }

  async deleteOldEvents(days = 90) {
    await this.execute(
      `DELETE FROM security_events WHERE created_at < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }
}
