import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class SnapshotRepository extends BaseRepository {
  constructor() {
    super("library_snapshots");
  }

  async startScan(libraryId: number, scanId: string) {
    return this.create({
      library_id: libraryId,
      scan_id: scanId,
      operation: "start",
      media_count: 0,
      file_count: 0,
      folder_count: 0,
      total_size: 0,
      error_count: 0,
    });
  }

  /**
   * Marks a previously started scan as complete by flipping its `start` row to
   * `complete` with the final aggregated counters.
   *
   * @param libraryId - The library the scan belongs to.
   * @param scanId - The unique scan identifier written by `startScan`.
   * @param stats - Final counters (media/file/folder counts, size, duration and errors).
   * @returns The number of matched rows. `0` means no `start` row was found for
   *          this scan — it was never written, was cleared as stale, or was
   *          rolled back by an absorbed write inside a foreign savepoint.
   */
  async completeScan(
    libraryId: number,
    scanId: string,
    stats: {
      media_count: number;
      file_count?: number;
      folder_count?: number;
      total_size?: number;
      duration_ms?: number;
      error_count?: number;
    },
  ): Promise<number> {
    const db = await getDatabase();
    const result = await db.run(
      `UPDATE library_snapshots
       SET operation = 'complete',
           media_count = ?, file_count = ?, folder_count = ?,
           total_size = ?, duration_ms = ?, error_count = ?
       WHERE library_id = ? AND scan_id = ? AND operation = 'start'`,
      [
        stats.media_count,
        stats.file_count ?? 0,
        stats.folder_count ?? 0,
        stats.total_size ?? 0,
        stats.duration_ms ?? 0,
        stats.error_count ?? 0,
        libraryId,
        scanId,
      ],
    );
    return result.changes ?? 0;
  }

  async interruptScan(libraryId: number, scanId: string) {
    const db = await getDatabase();
    await db.run(
      `UPDATE library_snapshots SET operation = 'interrupted'
       WHERE library_id = ? AND scan_id = ? AND operation = 'start'`,
      [libraryId, scanId],
    );
  }

  /**
   * Deletes orphaned `start` rows left behind by scans that never completed —
   * typically after a hard process crash where no graceful failure path ran.
   * Called at the beginning of every new scan so a crash-orphaned row cannot
   * accumulate indefinitely. The cutoff is generous (24h by default) so a
   * legitimate long-running scan is never touched; if it is, the subsequent
   * `completeScan` simply reports a 0-changes match.
   *
   * @param olderThanSeconds - Delete `start` rows older than this many seconds.
   * @returns The number of deleted rows.
   */
  async clearStaleSnapshots(olderThanSeconds = 86_400): Promise<number> {
    const db = await getDatabase();
    const result = await db.run(
      `DELETE FROM library_snapshots
       WHERE operation = 'start' AND created_at < datetime('now', '-' || ? || ' seconds')`,
      [olderThanSeconds],
    );
    return result.changes ?? 0;
  }

  async getRecentScans(libraryId: number, limit = 10) {
    return this.query(
      `SELECT * FROM library_snapshots
       WHERE library_id = ? AND operation = 'complete'
       ORDER BY created_at DESC LIMIT ?`,
      [libraryId, limit],
    );
  }

  async deleteOldSnapshots(days = 30) {
    await this.execute(
      `DELETE FROM library_snapshots WHERE created_at < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }
}
