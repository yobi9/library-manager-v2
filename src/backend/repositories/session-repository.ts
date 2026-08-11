import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class UserSessionRepository extends BaseRepository {
  constructor() {
    super("user_sessions");
  }

  async createSession({
    userId,
    ip,
    userAgent,
    os,
  }: {
    userId: number;
    ip: string;
    userAgent: string;
    os?: string;
  }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.run(
      `INSERT INTO user_sessions
        (user_id, ip_address, user_agent, os, last_active, expires_at, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [userId, ip, userAgent, os ?? null, now, expiresAt.toISOString(), now],
    );
    return true;
  }

  async updateSessionActivity(sessionId: number) {
    await this.execute(
      "UPDATE user_sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?",
      [sessionId],
    );
  }

  async terminateSession(sessionId: number) {
    await this.execute(
      "UPDATE user_sessions SET is_active = 0, last_active = CURRENT_TIMESTAMP WHERE id = ?",
      [sessionId],
    );
  }

  async terminateAllUserSessions(userId: number) {
    await this.execute(
      "UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1",
      [userId],
    );
  }

  async getUserActiveSessions(userId: number) {
    return this.query(
      `SELECT * FROM user_sessions
       WHERE user_id = ? AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_active DESC`,
      [userId],
    );
  }

  async getUserAllSessions(userId: number) {
    return this.query(
      "SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.execute(
      `DELETE FROM user_sessions
       WHERE expires_at < CURRENT_TIMESTAMP
          OR (is_active = 0 AND last_active < datetime('now', '-7 days'))`,
    );
    return result.changes ?? 0;
  }

  async getSessionStats() {
    const db = await getDatabase();
    return db.get(`
      SELECT COUNT(*) as activeSessions,
             COUNT(DISTINCT user_id) as uniqueUsers
      FROM user_sessions
      WHERE is_active = 1 AND expires_at > CURRENT_TIMESTAMP
    `);
  }
}
