import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  async findByUsername(username: string) {
    return this.getByField("username", username);
  }

  async getAuthUser(userId: number) {
    const db = await getDatabase();
    return db.get(
      "SELECT user_id, username, display_name, is_admin FROM users WHERE user_id = ?",
      [userId],
    );
  }

  async getTotalUsers(): Promise<number> {
    const row = (await this.queryOne(
      "SELECT COUNT(*) as count FROM users",
    )) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  async searchUsers(term: string) {
    return this.query(
      "SELECT * FROM users WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?",
      [`%${term}%`, `%${term}%`, `%${term}%`],
    );
  }

  async blockUser(userId: number, blocked: boolean) {
    const db = await getDatabase();
    await db.run("UPDATE users SET is_blocked = ? WHERE user_id = ?", [
      blocked ? 1 : 0,
      userId,
    ]);
    return true;
  }

  async updateUserStatus(userId: number, active: boolean) {
    return this.update(userId, { is_active: active ? 1 : 0 });
  }

  async getUsersWithStats(limit = 50, offset = 0) {
    const row = (await this.queryOne(
      "SELECT COUNT(*) as count FROM users",
    )) as { count: number };
    const rows = await this.query(
      `SELECT u.*,
        COUNT(DISTINCT up.media_id) as watched_count,
        (SELECT MAX(last_active) FROM user_sessions WHERE user_id = u.user_id) as last_login,
        (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.user_id AND is_active = 1) as active_sessions
      FROM users u
      LEFT JOIN user_progress up ON u.user_id = up.user_id AND up.is_finished = 1
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return { rows, total: row.count };
  }

  async getSystemStats() {
    const db = await getDatabase();
    return db.get(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_admin = 1) as admin_users,
        (SELECT COUNT(*) FROM user_sessions WHERE is_active = 1) as active_sessions,
        (SELECT COUNT(*) FROM users WHERE is_blocked = 1) as blocked_users
    `);
  }
}
