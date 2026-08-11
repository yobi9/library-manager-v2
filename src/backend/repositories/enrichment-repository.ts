import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class EnrichmentApprovalRepository extends BaseRepository {
  constructor() {
    super("pending_enrichment_approvals");
  }

  async createApproval(
    mediaId: number,
    mediaTitle: string,
    tmdbId: number,
    tmdbTitle: string,
    similarityScore: number,
    detailsJson: string,
  ) {
    const db = await getDatabase();
    await db.run(
      `INSERT OR REPLACE INTO pending_enrichment_approvals
        (media_id, media_title, tmdb_id, tmdb_title, similarity_score, details_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [mediaId, mediaTitle, tmdbId, tmdbTitle, similarityScore, detailsJson],
    );
  }

  async getPending(limit = 100) {
    const db = await getDatabase();
    return db.all(
      `SELECT * FROM pending_enrichment_approvals
       WHERE status = 'pending'
       ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
  }

  async getAllPending() {
    const db = await getDatabase();
    return db.all(
      "SELECT * FROM pending_enrichment_approvals WHERE status = 'pending'",
    );
  }

  async updateStatus(id: number, status: string) {
    const db = await getDatabase();
    await db.run(
      `UPDATE pending_enrichment_approvals
       SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id],
    );
  }
}
