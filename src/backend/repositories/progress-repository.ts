import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class ProgressRepository extends BaseRepository {
  constructor() {
    super("user_progress");
  }

  async getUserProgress(userId: number, mediaId: number) {
    const db = await getDatabase();
    return db.get(
      `SELECT progress_percent, is_finished, updated_at
       FROM user_progress WHERE user_id = ? AND media_id = ?`,
      [userId, mediaId],
    );
  }

  async getAllUserProgress(userId: number) {
    return this.query(
      `SELECT media_id, progress_percent, is_finished, updated_at
       FROM user_progress WHERE user_id = ? ORDER BY updated_at DESC`,
      [userId],
    );
  }

  async upsertProgress(
    userId: number,
    mediaId: number,
    progressPercent: number,
    isFinished = false,
  ) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const pct = Math.min(progressPercent, 100);
    const finished = isFinished ? 1 : 0;

    await db.run(
      "DELETE FROM user_progress WHERE user_id = ? AND media_id = ?",
      [userId, mediaId],
    );
    await db.run(
      `INSERT INTO user_progress (user_id, device_id, media_id, progress_percent, is_finished, updated_at, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [userId, mediaId, pct, finished, now, now],
    );
  }

  async deleteUserProgress(userId: number, mediaId: number) {
    await this.execute(
      "DELETE FROM user_progress WHERE user_id = ? AND media_id = ?",
      [userId, mediaId],
    );
  }
}
