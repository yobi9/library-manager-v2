import { getDatabase } from "../db/db";

export class DashboardRepository {
  async countAvailableMedia(): Promise<number> {
    const db = await getDatabase();
    const result = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE is_available = 1",
    )) as { count: number } | undefined;
    return result?.count ?? 0;
  }

  async getTotalStorageUsedBytes(): Promise<number> {
    const db = await getDatabase();
    const result = (await db.get(
      "SELECT COALESCE(SUM(file_size), 0) as total FROM media_files WHERE file_size > 0",
    )) as { total: number | string } | undefined;
    return Number(result?.total ?? 0);
  }

  async countUsers(): Promise<number> {
    const db = await getDatabase();
    const result = (await db.get("SELECT COUNT(*) as count FROM users")) as
      { count: number } | undefined;
    return result?.count ?? 0;
  }

  async getTotalViewSum(): Promise<number> {
    const db = await getDatabase();
    const result = (await db.get("SELECT COALESCE(SUM(views), 0) as total FROM media_items")) as
      { total: number } | undefined;
    return result?.total ?? 0;
  }

  async getDailyViewsFromActivities(days: number) {
    const db = await getDatabase();
    const rows = (await db.all(
      `SELECT DATE(created_at) as date, COUNT(*) as views
       FROM activities
       WHERE action = 'view_media' AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days],
    )) as { date: string; views: number }[];

    const result = new Array(days).fill(0) as number[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const row of rows) {
      const targetDate = new Date(row.date);
      const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < days) {
        result[days - 1 - diffDays] = row.views;
      }
    }
    return result;
  }

  async getMostWatchedLibraries(limit: number) {
    const db = await getDatabase();
    return db.all(
      `SELECT l.library_id as id, l.name as title, l.image as icon, COALESCE(SUM(m.views), 0) as views
       FROM libraries l
       LEFT JOIN media_items m ON l.library_id = m.library_id
       GROUP BY l.library_id
       ORDER BY views DESC LIMIT ?`,
      [limit],
    );
  }

  async getLeastWatchedLibraries(limit: number) {
    const db = await getDatabase();
    return db.all(
      `SELECT l.library_id as id, l.name as title, l.image as icon, COALESCE(SUM(m.views), 0) as views
       FROM libraries l
       LEFT JOIN media_items m ON l.library_id = m.library_id
       GROUP BY l.library_id
       ORDER BY views ASC LIMIT ?`,
      [limit],
    );
  }

  async getMostWatchedItems(limit: number) {
    const db = await getDatabase();
    return db.all(
      `SELECT m.media_id as id, m.title, m.type,   m.views
       FROM media_items m
       ORDER BY m.views DESC LIMIT ?`,
      [limit],
    );
  }

  async getLeastWatchedItems(limit: number) {
    const db = await getDatabase();
    return db.all(
      `SELECT m.media_id as id, m.title, m.type,   m.views
       FROM media_items m
       WHERE m.is_available = 1
       ORDER BY m.views ASC LIMIT ?`,
      [limit],
    );
  }

  /**
   * يجلب العناصر القديمة التي لم يشاهدها أحد على الإطلاق (views = 0) منذ عدد معيّن من الأيام.
   *
   * @param daysOld - العمر الأدنى باليوم (الحد الفاصل بـ created_at).
   * @param limit - أقصى عدد نتائج.
   * @param onlyAvailable - تحديد العناصر المتاحة فقط (is_available = 1) عند القيمة true.
   * @returns صفوف {id, title, type, views, added_date, library}.
   */
  async getOldUnwatchedItems(daysOld: number, limit: number, onlyAvailable: boolean) {
    const db = await getDatabase();
    const availabilityClause = onlyAvailable ? "AND m.is_available = 1" : "";
    return db.all(
      `SELECT m.media_id as id, m.title, m.type,  m.views,
              m.created_at as added_date, l.name as library
       FROM media_items m
       LEFT JOIN libraries l ON l.library_id = m.library_id
       WHERE m.views = 0
         AND m.created_at IS NOT NULL
         AND datetime(m.created_at) <= datetime('now', '-' || ? || ' days')
         ${availabilityClause}
       ORDER BY m.created_at ASC
       LIMIT ?`,
      [daysOld, limit],
    );
  }

  async getGeneralStats() {
    const db = await getDatabase();
    const mediaStats = await db.all(`
      SELECT type, COUNT(*) as count
      FROM media_items
      WHERE is_available = 1
      GROUP BY type
    `);
    const sectionsCount = (await db.get(`
      SELECT COUNT(*) as count FROM libraries
      WHERE status = 'active' AND (is_container = 0 OR type != 'main')
    `)) as { count: number } | undefined;
    return { mediaStats, sectionsCount: sectionsCount?.count ?? 0 };
  }
}
